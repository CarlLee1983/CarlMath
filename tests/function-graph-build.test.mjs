import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWith } from "./helpers/build.mjs";

for (const [fixture, message] of [["title", /<FunctionGraph> 必須有 title/], ["desc", /<FunctionGraph> 必須有 desc/], ["point", /<FunctionGraph> broken-function: points\[0\]\.at 不在函數曲線上/]]) {
  test(`FunctionGraph ${fixture} 錯誤會傳到教材建置邊界`, () => {
    const { status, output } = buildWith(`tests/fixtures/function-${fixture}`);
    assert.notEqual(status, 0, output);
    assert.match(output, message);
  });
}
