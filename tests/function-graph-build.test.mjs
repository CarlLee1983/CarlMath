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

test("二次函數的建置 SVG 使用精確 Q 曲線且不連接分支或製造裁切端點", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { status, output } = buildWith("tests/fixtures/function-quadratic", (outDir) => {
    const html = readFileSync(join(outDir, "units/broken/index.html"), "utf8");
    const curves = html.match(/<path\b[^>]*class="fg-curve"[^>]*>/g) ?? [];
    assert.equal(curves.length, 4);
    for (const path of curves) {
      assert.match(path, /d="M [^"]+ Q [^"]+"/);
      assert.doesNotMatch(path, /NaN|Infinity/);
    }
    assert.equal((html.match(/class="fg-endpoint"/g) ?? []).length, 1);
    assert.equal((html.match(/class="fg-point"/g) ?? []).length, 3);
  });
  assert.equal(status, 0, output);
});
