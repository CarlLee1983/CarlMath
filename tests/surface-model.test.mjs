import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeDimensions } from "../src/lib/geometry-model.ts";
import { surfaceArea, faceAreas, netFaces } from "../src/lib/surface-model.ts";

const initial = { length: 3, width: 2, height: 2 };
const allDimensions = function* () {
  for (let length = 1; length <= 8; length++)
    for (let width = 1; width <= 8; width++)
      for (let height = 1; height <= 8; height++) yield { length, width, height };
};

test("所有尺寸的表面積等於三組相對面的面積總和", () => {
  assert.equal(surfaceArea(initial), 32);
  assert.equal(surfaceArea({ length: 4, width: 3, height: 2 }), 52);
  for (const d of allDimensions()) {
    assert.deepEqual(faceAreas(d), {
      base: d.length * d.width,
      front: d.length * d.height,
      side: d.width * d.height,
    });
    assert.equal(surfaceArea(d), 2 * (d.length * d.width + d.length * d.height + d.width * d.height));
  }
});

test("所有展開圖皆有六個不重疊的矩形，面積與尺寸完整保留", () => {
  for (const d of allDimensions()) {
    const faces = netFaces(d);
    assert.equal(faces.length, 6);
    assert.equal(new Set(faces.map((f) => f.id)).size, 6);
    const expectedAreas = Object.values(faceAreas(d)).flatMap((area) => [area, area]).sort((a, b) => a - b);
    assert.deepEqual(faces.map((f) => f.area).sort((a, b) => a - b), expectedAreas);
    assert.equal(faces.reduce((total, f) => total + f.area, 0), surfaceArea(d));
    const edgePairs = faces.map((f) => [f.width, f.height].sort((a, b) => a - b).join("x")).sort();
    const expectedPairs = [[d.length, d.width], [d.length, d.height], [d.width, d.height]]
      .flatMap((pair) => [pair, pair]).map((pair) => [...pair].sort((a, b) => a - b).join("x")).sort();
    assert.deepEqual(edgePairs, expectedPairs);
    for (const [i, a] of faces.entries()) {
      assert.ok(typeof a.id === "string" && a.id.length > 0);
      assert.ok(typeof a.label === "string" && a.label.length > 0);
      assert.ok([a.x, a.y, a.width, a.height].every(Number.isFinite));
      assert.ok(a.width > 0 && a.height > 0);
      assert.equal(a.area, a.width * a.height);
      for (const b of faces.slice(i + 1)) {
        const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
        const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
        assert.ok(overlapX <= 0 || overlapY <= 0, `${JSON.stringify(d)}: ${a.id} overlaps ${b.id}`);
      }
    }
  }
});

test("正方體表面積為六倍邊長平方，計算不修改輸入", () => {
  for (let length = 1; length <= 8; length++) {
    const original = Object.freeze({ length, width: 2, height: 3 });
    const cube = Object.freeze(normalizeDimensions(original, true));
    assert.equal(surfaceArea(cube), 6 * length ** 2);
    assert.ok(netFaces(cube).every((f) => f.area === length ** 2));
    faceAreas(original);
    netFaces(original);
    surfaceArea(original);
    assert.deepEqual(original, { length, width: 2, height: 3 });
  }
});

test("所有表面積與展開圖 API 拒絕無效或缺少的邊長", () => {
  for (const key of ["length", "width", "height"]) {
    for (const value of [0, -1, 9, 1.5, NaN, Infinity, -Infinity, "3", null, undefined]) {
      for (const calculate of [surfaceArea, faceAreas, netFaces]) {
        assert.throws(() => calculate({ ...initial, [key]: value }), `${calculate.name} ${key}: ${String(value)}`);
      }
    }
    const missing = { ...initial };
    delete missing[key];
    for (const calculate of [surfaceArea, faceAreas, netFaces]) assert.throws(() => calculate(missing));
  }
});
