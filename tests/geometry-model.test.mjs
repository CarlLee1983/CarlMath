import { test } from "node:test";
import assert from "node:assert/strict";
import { volume, layerArea, normalizeDimensions } from "../src/lib/geometry-model.ts";

const initial = { length: 3, width: 2, height: 2 };

test("長方體的體積等於每層面積乘以層數", () => {
  assert.equal(layerArea(initial), 6);
  assert.equal(volume(initial), 12);
  for (let length = 1; length <= 8; length++) {
    for (let width = 1; width <= 8; width++) {
      for (let height = 1; height <= 8; height++) {
        const dimensions = { length, width, height };
        assert.equal(layerArea(dimensions), length * width);
        assert.equal(volume(dimensions), length * width * height);
        assert.equal(volume(dimensions), layerArea(dimensions) * height);
      }
    }
  }
});

test("正規化保留長方體尺寸且不修改輸入", () => {
  const dimensions = Object.freeze({ ...initial });
  assert.deepEqual(normalizeDimensions(dimensions), initial);
  assert.deepEqual(dimensions, initial);
});

test("正方體三個邊長都跟隨長度，含上下界", () => {
  for (let length = 1; length <= 8; length++) {
    const dimensions = Object.freeze({ length, width: 2, height: 3 });
    const cube = normalizeDimensions(dimensions, true);
    assert.deepEqual(cube, { length, width: length, height: length });
    assert.equal(volume(cube), length ** 3);
    assert.equal(layerArea(cube), length ** 2);
    assert.deepEqual(dimensions, { length, width: 2, height: 3 });
  }
});

test("無效尺寸不能悄悄四捨五入、截斷或轉換字串", () => {
  for (const key of ["length", "width", "height"]) {
    for (const value of [0, -1, 9, 1.5, NaN, Infinity, -Infinity, "3", null, undefined]) {
      for (const calculate of [normalizeDimensions, volume, layerArea]) {
        assert.throws(() => calculate({ ...initial, [key]: value }), `${key}: ${String(value)}`);
      }
    }
  }
});


test("缺少任一邊長都會拒絕", () => {
  for (const key of ["length", "width", "height"]) {
    const dimensions = { ...initial };
    delete dimensions[key];
    assert.throws(() => normalizeDimensions(dimensions));
    assert.throws(() => volume(dimensions));
    assert.throws(() => layerArea(dimensions));
  }
});
