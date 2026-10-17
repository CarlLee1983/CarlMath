import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveFunctionGraph } from "../src/lib/function-graph.ts";

const base = { id: "test", xRange: [-3, 3], yRange: [-3, 3], fn: { linear: [1, 0] } };

test("函數圖拒絕無效視窗與未知函數宣告，不把零係數當一次函數", () => {
  for (const xRange of [[2, 2], [1, 3], [-Infinity, 3], [0, NaN]]) {
    assert.throws(() => resolveFunctionGraph({ ...base, xRange }), /FunctionGraph.*xRange/);
  }
  for (const fn of [{ linear: [0, 1] }, { linear: [Infinity, 1] }, { linear: [1] }, { quadratic: [1, 0, 0] }, { constant: 2, linear: [1, 0] }, () => 2]) {
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
