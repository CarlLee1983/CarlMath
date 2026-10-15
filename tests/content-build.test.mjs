import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadContent } from "../src/lib/content.ts";
import { buildWith } from "./helpers/build.mjs";

test("課程地圖有 error 時 build 以非零狀態結束並印出 issue code", () => {
  const { status, output } = buildWith("tests/fixtures/bad-map");
  assert.notEqual(status, 0);
  assert.match(output, /prerequisite-after/);
});

test("正式內容的 build 為課程地圖的每個單元各產生一個 /units/<id>/ 單元頁", () => {
  const { index } = loadContent(resolve("content"));
  let pages = [];
  const { status, output } = buildWith("content", (outDir) => {
    const unitsDir = join(outDir, "units");
    pages = readdirSync(unitsDir).filter((id) => existsSync(join(unitsDir, id, "index.html")));
  });
  assert.equal(status, 0, output);
  assert.deepEqual(pages.toSorted(), index.units.map((unit) => unit.id).toSorted());
});
