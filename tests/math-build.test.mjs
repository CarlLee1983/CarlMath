import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { buildWith } from "./helpers/build.mjs";

test("未定義的 KaTeX 指令讓 build 以非零狀態結束", () => {
  const { status, output } = buildWith("tests/fixtures/broken-math");
  assert.notEqual(status, 0);
  assert.match(output, /KaTeX parse error: Undefined control sequence: \\fracc/);
});

test("數學模式直接寫中文讓 build 以非零狀態結束", () => {
  const { status, output } = buildWith("tests/fixtures/broken-cjk");
  assert.notEqual(status, 0);
  assert.match(output, /unicodeTextInMathMode/);
});

test("輸出 HTML 殘留 katex-error 時 build 失敗並指出頁面", () => {
  const { status, output } = buildWith(resolve("tests/fixtures/raw-katex-error"));
  assert.notEqual(status, 0);
  assert.match(output, /katex-error/);
  assert.match(output, /units\/raw-error\/index\.html/);
});
