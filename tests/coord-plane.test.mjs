import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveCoordPlane } from "../src/lib/coord-plane.ts";

test("坐標圖拒絕無效範圍及不能放進範圍的點", () => {
  const base = { id: "test", xRange: [-3, 3], yRange: [-3, 3] };
  for (const range of [[2, 2], [1, 3], [-Infinity, 3], [-10, 10]]) {
    assert.throws(() => resolveCoordPlane({ ...base, xRange: range }), /xRange/);
  }
  for (const at of [[NaN, 1], [1, Infinity], [4, 0]]) {
    assert.throws(() => resolveCoordPlane({ ...base, points: [{ at }] }), /points/);
  }
});

test("坐標圖保留四個點名額度，拒絕超量、重複與象限圖混用", () => {
  const base = { id: "names", xRange: [-3, 3], yRange: [-3, 3] };
  assert.doesNotThrow(() => resolveCoordPlane({ ...base, points: [{ at: [-2, 2], name: "A" }, { at: [2, 2], name: "B" }, { at: [-2, -2], name: "C" }, { at: [2, -2], name: "D" }] }));
  assert.throws(() => resolveCoordPlane({ ...base, points: "ABCDE".split("").map((name) => ({ at: [1, 1], name })) }), /最多 4/);
  assert.throws(() => resolveCoordPlane({ ...base, points: [{ at: [1, 1], name: "A" }, { at: [2, 2], name: "A" }] }), /不可重複/);
  assert.throws(() => resolveCoordPlane({ ...base, quadrants: true, points: [{ at: [1, 1] }] }), /quadrants/);
  assert.throws(() => resolveCoordPlane({ ...base, xRange: [0, 3], quadrants: true }), /quadrants/);
  assert.throws(() => resolveCoordPlane({ ...base, id: "" }), /id/);
  assert.doesNotThrow(() => resolveCoordPlane({ ...base, quadrants: true }));
});

test("線段端點沿用坐標範圍，輔助線旗標與象限模式不得混用", () => {
  const base = { id: "segments", xRange: [-3, 3], yRange: [-3, 3] };
  for (const segments of [
    [{ from: [NaN, 1], to: [1, 2] }],
    [{ from: [0], to: [1, 2] }],
    Array.from({ length: 13 }, () => ({ from: [0, 0], to: [1, 1] })),
    [{ from: [0, 0], to: [4, 0] }],
    [{ from: [0, 0], to: [1, Infinity] }],
    [{ from: [0, 0], to: [1, 1], auxiliary: "yes" }],
  ]) assert.throws(() => resolveCoordPlane({ ...base, segments }), /segments/);
  assert.throws(() => resolveCoordPlane({ ...base, quadrants: true, segments: [{ from: [0, 0], to: [1, 1] }] }), /quadrants/);
  assert.doesNotThrow(() => resolveCoordPlane({ ...base, segments: [{ from: [-0.5, 0], to: [1, 1], auxiliary: true }] }));
});

const circleBase = { id: "circle-test", xRange: [-2, 4], yRange: [-2, 4], circles: [{ center: [1, 1], radius: 2 }] };

test("坐標圓只接受單個完整圓、有限圓心與正有限半徑", () => {
  for (const circles of [null, {}, [{ center: [0], radius: 1 }], [{ center: [NaN, 0], radius: 1 }], [{ center: [0, 0], radius: 0 }], [{ center: [0, 0], radius: -1 }], [{ center: [0, 0], radius: Infinity }], [{ center: [0, 0], radius: Number.MIN_VALUE }], [{ center: [1, 1], radius: 4 }], [{ center: [1, 1], radius: 2 }, { center: [0, 0], radius: 1 }]]) {
    assert.throws(() => resolveCoordPlane({ ...circleBase, circles }), /circles/);
  }
  assert.throws(() => resolveCoordPlane({ ...circleBase, quadrants: true }), /quadrants/);
  assert.doesNotThrow(() => resolveCoordPlane({ ...circleBase, xRange: [-3, 3], yRange: [-3, 3], circles: [{ center: [0, 0], radius: 3 }] }));
});

test("坐標圓使用兩軸共同單位，不因不等長視窗變成橢圓", () => {
  const graph = resolveCoordPlane(circleBase);
  assert.equal(graph.unit, 60);
  assert.deepEqual(graph.circles, [{ x: 240, y: 234, radius: 120 }]);
  const unequal = resolveCoordPlane({ ...circleBase, xRange: [-3, 4], yRange: [-1, 4] });
  assert.equal(unequal.circles[0].radius, unequal.unit * 2);
  assert.equal(unequal.unit, 360 / 7);
  assert.deepEqual(resolveCoordPlane({ id: "old", xRange: [-3, 3], yRange: [-3, 3] }).circles, []);
});

test("教材圓心與圓周點和半徑維持正確，文字避圓周但可放在圓內", () => {
  const graph = resolveCoordPlane({ ...circleBase, points: [{ at: [1, 1], name: "A" }, { at: [3, 1], name: "B" }, { at: [1, 3], name: "C" }], segments: [{ from: [1, 1], to: [3, 1] }] });
  const circle = graph.circles[0];
  assert.deepEqual(graph.segments[0], { from: { x: 240, y: 234 }, to: { x: 360, y: 234 }, auxiliary: false });
  for (const p of graph.points.slice(1)) assert.equal(Math.hypot(p.x - circle.x, p.y - circle.y), circle.radius);
  const name = graph.texts.find((t) => t.text === "A");
  assert.ok(Math.hypot(name.x - circle.x, name.y - circle.y) < circle.radius);
  // Independent angular probes check rendered circumference, not its bounding square.
  for (const text of graph.texts) for (let i = 0; i < 10000; i++) {
    const theta = i * 2 * Math.PI / 10000, x = circle.x + circle.radius * Math.cos(theta), y = circle.y + circle.radius * Math.sin(theta);
    const w = text.text.length * 15 / 2 + 3;
    assert.ok(!(x >= text.x - w - 2 && x <= text.x + w + 2 && y >= text.y - 25 && y <= text.y + 7), `圓周穿過 ${text.text}`);
  }
});
