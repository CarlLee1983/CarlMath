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
