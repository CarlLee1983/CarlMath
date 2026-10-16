import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadContent } from "../src/lib/content.ts";
import { uncoveredChars } from "../src/lib/share-image.ts";
import { buildWith } from "./helpers/build.mjs";

test("正式課程地圖全部單元的階段名、標題、核心問題，字型切片都有字（不論是否已撰寫）", () => {
  const loaded = loadContent(resolve("content"));
  assert.ok(loaded.ok);
  const { index } = loaded;
  assert.equal(index.units.length, 122);
  const missing = index.units.flatMap((unit) => {
    const chars = uncoveredChars([index.stageOf(unit.id).title, unit.title, unit.coreQuestion]);
    return chars.length ? [`${unit.id}：${chars.join("")}`] : [];
  });
  assert.deepEqual(missing, [], "課程地圖出現字型切片沒有的字，分享圖會在該單元撰寫時 build 失敗");
});

test("字型切片沒有的字會被偵測出來", () => {
  assert.deepEqual(uncoveredChars(["數線 π Σ"]), []);
  assert.deepEqual(uncoveredChars(["數線\u{1F600}"]), ["\u{1F600}"]);
});

test("build 只為已撰寫單元產分享圖，未撰寫單元（fx-fraction）沒有", () => {
  let names = [];
  const { status, output } = buildWith("tests/fixtures/site", (outDir) => {
    const dir = join(outDir, "og");
    names = existsSync(dir) ? readdirSync(dir) : [];
  });
  assert.equal(status, 0, output);
  assert.ok(names.some((name) => name.startsWith("fx-count-")), "已撰寫單元應有分享圖");
  assert.ok(names.some((name) => name.startsWith("default-")));
  assert.deepEqual(names.filter((name) => name.startsWith("fx-fraction-")), []);
});
