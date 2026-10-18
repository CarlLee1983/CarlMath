import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveFunctionGraph } from "../src/lib/function-graph.ts";

const base = { id: "test", xRange: [-3, 3], yRange: [-3, 3], fn: { linear: [1, 0] } };

test("函數圖拒絕無效視窗與未知函數宣告，不把零係數當一次函數", () => {
  for (const xRange of [[2, 2], [1, 3], [-Infinity, 3], [0, NaN]]) {
    assert.throws(() => resolveFunctionGraph({ ...base, xRange }), /FunctionGraph.*xRange/);
  }
  for (const fn of [{ linear: [0, 1] }, { linear: [Infinity, 1] }, { linear: [1] }, { cubic: [1, 0, 0] }, { constant: 2, linear: [1, 0] }, () => 2]) {
    assert.throws(() => resolveFunctionGraph({ ...base, fn }), /FunctionGraph.*fn/);
  }
  assert.doesNotThrow(() => resolveFunctionGraph(base));
  assert.doesNotThrow(() => resolveFunctionGraph({ ...base, fn: { constant: 2 } }));
});

test("定義域開閉獨立於視窗；非法端點及無窮閉端被拒絕", () => {
  for (const domain of [null, {}, { from: 2, to: 1, openFrom: false, openTo: false }, { from: 1, to: 1, openFrom: false, openTo: true }, { from: null, to: 2, openFrom: false, openTo: false }, { from: -1, to: Infinity, openFrom: false, openTo: true }, { from: -1, to: 2, openFrom: "yes", openTo: false }]) {
    assert.throws(() => resolveFunctionGraph({ ...base, domain }), /domain/);
  }
  assert.doesNotThrow(() => resolveFunctionGraph({ ...base, domain: { from: -20, to: null, openFrom: false, openTo: true } }));
  assert.doesNotThrow(() => resolveFunctionGraph({ ...base, domain: { from: 1, to: 1, openFrom: false, openTo: false } }));
});

test("標記必須位於函數與定義域上，刻度不得過密或使用非法間距", () => {
  for (const points of [[{ at: [1, 2] }], [{ at: [4, 4] }], [{ at: [NaN, 0] }], [{ at: [1, 1], name: "O" }], [{ at: [1, 1], name: "A" }, { at: [2, 2], name: "A" }]]) {
    assert.throws(() => resolveFunctionGraph({ ...base, points }), /points/);
  }
  assert.throws(() => resolveFunctionGraph({ ...base, domain: { from: 1, to: 2, openFrom: true, openTo: false }, points: [{ at: [1, 1] }] }), /points/);
  for (const xStep of [0, -1, 0.5, Infinity, "2"]) assert.throws(() => resolveFunctionGraph({ ...base, xStep }), /xStep/);
  assert.throws(() => resolveFunctionGraph({ ...base, xRange: [-10, 10] }), /刻度/);
  assert.doesNotThrow(() => resolveFunctionGraph({ ...base, xRange: [-10, 10], xStep: 5, points: [{ at: [1, 1], name: "A" }] }));
});

test("拒絕不可靠的數值運算與沒有可見圖形的範圍", () => {
  assert.throws(() => resolveFunctionGraph({ ...base, xRange: [0, Number.MIN_VALUE] }), /範圍/);
  assert.throws(() => resolveFunctionGraph({ ...base, fn: { linear: [Number.MIN_VALUE, 0] } }), /fn/);
  assert.throws(() => resolveFunctionGraph({ ...base, fn: { constant: 10 } }), /視窗/);
  assert.throws(() => resolveFunctionGraph({ ...base, domain: { from: 10, to: 20, openFrom: false, openTo: false } }), /domain/);
});

test("數值精度把兩個視窗交點壓成同一點時拒絕，不畫錯誤的空圖", () => {
  assert.throws(() => resolveFunctionGraph({ ...base, fn: { linear: [1e308, 1e308] } }), /fn.*精度/);
});

test("真端點落在邊界仍保留，單點域只畫一點，裁切不製造端點", () => {
  const edge = resolveFunctionGraph({ ...base, fn: { linear: [-1, 0] }, domain: { from: -3, to: 3, openFrom: true, openTo: false } });
  assert.deepEqual(edge.endpoints, [{ x: 60, y: 54, open: true }, { x: 420, y: 414, open: false }]);
  const singleton = resolveFunctionGraph({ ...base, domain: { from: 1, to: 1, openFrom: false, openTo: false }, points: [{ at: [1, 1] }] });
  assert.equal(singleton.curve, undefined);
  assert.deepEqual(singleton.endpoints, [{ x: 300, y: 174, open: false }]);
  assert.deepEqual(singleton.points, []);
  const clipped = resolveFunctionGraph({ ...base, domain: { from: -10, to: 10, openFrom: true, openTo: false } });
  assert.deepEqual(clipped.endpoints, []);
});

test("過近的開閉端點或標記不能互相遮住，應請作者拆圖", () => {
  assert.throws(() => resolveFunctionGraph({ ...base, domain: { from: 1, to: 1.001, openFrom: true, openTo: false } }), /端點|標記/);
  assert.throws(() => resolveFunctionGraph({ ...base, domain: { from: 1, to: 2, openFrom: true, openTo: false }, points: [{ at: [1.001, 1.001] }] }), /端點|標記/);
});

test("曲線標記的浮點容差不能在小尺度視窗變成可見誤差", () => {
  assert.throws(() => resolveFunctionGraph({ ...base, yRange: [-1e-10, 1e-10], fn: { constant: 0 }, points: [{ at: [1, 5e-11], name: "A" }] }), /points.*不在函數曲線/);
});

const quadratic = { id: "quadratic-test", xRange: [-3, 3], yRange: [-1, 5], fn: { quadratic: [1, 0, 0] } };
const near = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} ≠ ${expected}`);
const bezier = (c, t) => ({ x: (1 - t) ** 2 * c.from.x + 2 * (1 - t) * t * c.control.x + t ** 2 * c.to.x,
  y: (1 - t) ** 2 * c.from.y + 2 * (1 - t) * t * c.control.y + t ** 2 * c.to.y });

test("二次族驗證係數、族唯一性及頂點運算，不接受退化一次函數", () => {
  for (const fn of [{ quadratic: [0, 1, 2] }, { quadratic: [1, 2] }, { quadratic: [1, 2, 3, 4] }, { quadratic: [1, NaN, 0] }, { quadratic: [Infinity, 0, 0] }, { quadratic: [1, 0, 0], constant: 0 }, { quadratic: "x²" }]) {
    assert.throws(() => resolveFunctionGraph({ ...quadratic, fn }), /FunctionGraph.*fn/);
  }
  for (const coefficients of [[1e308, 1e308, 1e308], [1e307, 0, 0], [Number.MIN_VALUE, 0, 0], [1, 1e200, 0], [1e-100, 1e100, 0]]) {
    assert.throws(() => resolveFunctionGraph({ ...quadratic, fn: { quadratic: coefficients } }), /fn.quadratic.*範圍|fn.quadratic.*精度|fn.quadratic.*溢位/);
  }
});

test("二次圖用精確 Bézier 表示，解析頂點、開口、平移與伸縮", () => {
  for (const coefficients of [[1, 0, 0], [1, -2, 3], [-1, 2, 3], [2, -4, 2], [0.5, 1, -1]]) {
    const input = { ...quadratic, fn: { quadratic: coefficients } };
    const graph = resolveFunctionGraph(input);
    const [a, b, c] = coefficients;
    near(graph.vertex.x, -b / (2 * a));
    near(graph.vertex.y, c - b * b / (4 * a));
    assert.equal(graph.curve, undefined);
    assert.ok(graph.quadraticCurves.length >= 1);
    for (const segment of graph.quadraticCurves) for (const t of [0, 0.125, 0.25, 0.5, 0.75, 0.875, 1]) {
      const p = bezier(segment, t);
      const x = (p.x - 60) / 60 - 3, y = 5 - (p.y - 54) / 60;
      near(y, a * x * x + b * x + c);
      assert.ok(p.x >= 60 - 1e-8 && p.x <= 420 + 1e-8 && p.y >= 54 - 1e-8 && p.y <= 414 + 1e-8);
    }
    assert.deepEqual(graph.endpoints, []);
  }
});

test("二次圖裁出左右兩支，不把不可見頂點或視窗邊界連成曲線或假端點", () => {
  const graph = resolveFunctionGraph({ ...quadratic, fn: { quadratic: [1, 0, -4] }, yRange: [-1, 3] });
  assert.equal(graph.quadraticCurves.length, 2);
  assert.ok(graph.quadraticCurves[0].to.x < graph.origin.x);
  assert.ok(graph.quadraticCurves[1].from.x > graph.origin.x);
  for (const c of graph.quadraticCurves) {
    near(Math.max(c.from.y, c.to.y), 414);
    near(Math.min(c.from.y, c.to.y), 54);
  }
  assert.deepEqual(graph.endpoints, []);
});

test("二次圖保留真正開閉端點、去除重複端點標記，單點域不畫曲線", () => {
  const graph = resolveFunctionGraph({ ...quadratic, domain: { from: -1, to: 2, openFrom: true, openTo: false }, points: [{ at: [2, 4], name: "B" }] });
  assert.deepEqual(graph.endpoints, [{ x: 180, y: 294, open: true }, { x: 360, y: 114, open: false }]);
  assert.deepEqual(graph.points, []);
  assert.ok(graph.texts.some((t) => t.text === "B"));
  const single = resolveFunctionGraph({ ...quadratic, domain: { from: 1, to: 1, openFrom: false, openTo: false } });
  assert.equal(single.curve, undefined);
  assert.deepEqual(single.quadraticCurves, []);
  assert.deepEqual(single.endpoints, [{ x: 300, y: 294, open: false }]);
  const clipped = resolveFunctionGraph({ ...quadratic, domain: { from: -3, to: 3, openFrom: true, openTo: false } });
  assert.deepEqual(clipped.endpoints, []);
});

test("二次圖切點、視窗邊界真端點與被開放定義域排除的交點", () => {
  const tangent = resolveFunctionGraph({ ...quadratic, yRange: [-3, 0] });
  assert.equal(tangent.quadraticCurves.length, 1);
  assert.deepEqual(tangent.quadraticCurves[0].from, tangent.quadraticCurves[0].to);
  assert.deepEqual(tangent.endpoints, []);
  assert.throws(() => resolveFunctionGraph({ ...quadratic, yRange: [-3, 0], domain: { from: 0, to: 3, openFrom: true, openTo: false } }), /沒有可見圖形/);
  const edge = resolveFunctionGraph({ ...quadratic, yRange: [0, 4], domain: { from: -2, to: 2, openFrom: true, openTo: false } });
  assert.deepEqual(edge.endpoints, [{ x: 120, y: 54, open: true }, { x: 360, y: 54, open: false }]);
  assert.throws(() => resolveFunctionGraph({ ...quadratic, fn: { quadratic: [1, 0, 10] } }), /沒有可見圖形/);
});

test("二次圖所有點必須落在曲線與定義域，微小視窗不可放寬誤差", () => {
  for (const points of [[{ at: [1, 2] }], [{ at: [0, 1] }], [{ at: [0, 0], name: "A" }, { at: [0.001, 0.000001], name: "B" }]]) {
    assert.throws(() => resolveFunctionGraph({ ...quadratic, points }), /points|標記/);
  }
  assert.throws(() => resolveFunctionGraph({ ...quadratic, domain: { from: -1, to: 2, openFrom: true, openTo: false }, points: [{ at: [-1, 1] }] }), /points/);
  assert.throws(() => resolveFunctionGraph({ ...quadratic, yRange: [-1e-10, 1e-10], fn: { quadratic: [1e-11, 0, 0] }, points: [{ at: [1, 6e-11] }] }), /points.*不在函數曲線/);
});

test("教材頂點與對稱點圖的所有文字避開真實拋物線，不能只檢查端點弦", () => {
  const graph = resolveFunctionGraph({ id: "lesson-parabola", xRange: [-2, 4], yRange: [0, 10], yStep: 2,
    fn: { quadratic: [1, -2, 3] }, points: [{ at: [1, 2], name: "A" }, { at: [0, 3], name: "B" }, { at: [2, 3], name: "C" }] });
  assert.deepEqual(graph.vertex, { x: 1, y: 2 });
  assert.equal(graph.points.length, 3);
  assert.equal(graph.texts.filter((t) => t.kind === "name").length, 3);
  // Independent dense probes are a regression oracle; production collision tests are analytical.
  for (const text of graph.texts) for (const segment of graph.quadraticCurves) for (let i = 0; i <= 1000; i++) {
    const p = bezier(segment, i / 1000), w = text.text.length * 15 / 2 + 3;
    assert.ok(!(p.x >= text.x - w - 2 && p.x <= text.x + w + 2 && p.y >= text.y - 25 && p.y <= text.y + 7), `曲線穿過 ${text.text}`);
  }
});
