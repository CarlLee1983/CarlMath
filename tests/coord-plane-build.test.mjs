import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWith } from "./helpers/build.mjs";

for (const field of ["title", "desc"]) {
  test(`CoordPlane 缺少 ${field} 時在教材 build 邊界被拒絕`, () => {
    const { status, output } = buildWith(`tests/fixtures/coord-missing-${field}`);
    assert.notEqual(status, 0, output);
    assert.match(output, new RegExp(`<CoordPlane> 必須有 ${field}`));
  });
}
