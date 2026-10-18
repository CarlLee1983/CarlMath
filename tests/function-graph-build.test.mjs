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

test("三次函數與坐標圓的建置 SVG 使用 C path 與等比例完整 circle", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { status, output } = buildWith("tests/fixtures/function-cubic", (outDir) => {
    const html = readFileSync(join(outDir, "units/broken/index.html"), "utf8");
    const curves = html.match(/<path\b[^>]*class="fg-curve"[^>]*>/g) ?? [];
    assert.equal(curves.length, 3);
    for (const path of curves) {
      assert.match(path, /d="M [^"]+ C [^"]+"/);
      assert.doesNotMatch(path, /NaN|Infinity/);
    }
    assert.equal((html.match(/class="fg-endpoint"/g) ?? []).length, 0);
    const circle = html.match(/<circle\b[^>]*class="cp-circle"[^>]*>/g) ?? [];
    assert.equal(circle.length, 1);
    assert.match(circle[0], /cx="240"/);
    assert.match(circle[0], /cy="234"/);
    assert.match(circle[0], /r="120"/);
  });
  assert.equal(status, 0, output);
});

test("指數增減圖的 SVG 誠實輸出有限的 M/L 近似且不製造端點", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { status, output } = buildWith("tests/fixtures/function-exponential", (outDir) => {
    const html = readFileSync(join(outDir, "units/broken/index.html"), "utf8");
    const curves = html.match(/<path\b[^>]*class="fg-curve"[^>]*>/g) ?? [];
    assert.equal(curves.length, 2);
    for (const path of curves) {
      assert.match(path, /d="M [^"]+ L [^"]+"/);
      assert.doesNotMatch(path, /NaN|Infinity| Q | C /);
      assert.ok((path.match(/ L /g) ?? []).length > 10);
    }
    assert.equal((html.match(/class="fg-endpoint"/g) ?? []).length, 0);
    assert.equal((html.match(/class="fg-point"/g) ?? []).length, 6);
  });
  assert.equal(status, 0, output);
});

test("對數正反對照與遞減圖的 SVG 保留自然域且不畫 y 軸端點", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { status, output } = buildWith("tests/fixtures/function-logarithmic", (outDir) => {
    const html = readFileSync(join(outDir, "units/broken/index.html"), "utf8");
    const curves = html.match(/<path\b[^>]*class="fg-curve"[^>]*>/g) ?? [];
    assert.equal(curves.length, 3);
    for (const path of curves) {
      assert.match(path, /d="M [^"]+ L [^"]+"/);
      assert.doesNotMatch(path, /NaN|Infinity| Q | C /);
    }
    assert.match(curves[1], /d="M 195 414 /);
    assert.match(curves[2], /d="M 187.5 54 /);
    assert.equal((html.match(/class="fg-endpoint"/g) ?? []).length, 0);
    assert.equal((html.match(/class="fg-point"/g) ?? []).length, 9);
  });
  assert.equal(status, 0, output);
});

test("三角 SVG 使用有界 M/L 路徑與 π 刻度，保留峰谷點且無假端點", async () => {
  const { readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { status, output } = buildWith("tests/fixtures/function-trig", (outDir) => {
    const html = readFileSync(join(outDir, "units/broken/index.html"), "utf8");
    const curves = html.match(/<path\b[^>]*class="fg-curve"[^>]*>/g) ?? [];
    assert.equal(curves.length, 3);
    for (const path of curves) {
      assert.match(path, /d="M [^"]+ L [^"]+"/);
      assert.doesNotMatch(path, /NaN|Infinity| Q | C /);
    }
    for (const label of ["−π", "π", "2π"]) assert.equal((html.match(new RegExp(">" + label + "</text>", "g")) ?? []).length, 3);
    assert.equal((html.match(/class="fg-endpoint"/g) ?? []).length, 0);
    assert.equal((html.match(/class="fg-point"/g) ?? []).length, 6);
  });
  assert.equal(status, 0, output);
});
