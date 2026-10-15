import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadContent } from "../src/lib/content.ts";

// 建立內容根目錄：課程地圖用 valid fixture（單元 u-one … u-six），lessons 是 { 相對路徑: 檔案內容 }。
function withContent(lessons, run) {
  const root = mkdtempSync(join(tmpdir(), "carlmath-load-"));
  try {
    copyFileSync("tests/fixtures/course-maps/valid.yaml", join(root, "course-map.yaml"));
    for (const [path, text] of Object.entries(lessons)) {
      const file = join(root, "lessons", path);
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(file, text);
    }
    return run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

// 這些測試用的單元（u-one、u-two、u-three）在 valid.yaml 都是親子共學單元，教材要符合親子篇的 9 段 H2，才不會被教材規則擋下。
const familyHeadings = ["給家長的話", "情境開場", "開始前", "大人先懂", "常見迷思", "親子活動", "練習與解析", "隔天再問", "下一步"];
const lesson = (unit) => `---\nunit: ${unit}\n---\n\n${familyHeadings.map((h) => `## ${h}\n\n內文\n`).join("\n")}`;
const errorCodes = (loaded) => loaded.issues.filter((i) => i.level === "error").map((i) => i.code);

test("巢狀目錄的教材依 frontmatter unit 判定為已撰寫", () => {
  withContent({ "a/b/x.mdx": lesson("u-two") }, (root) => {
    const loaded = loadContent(root);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.index.isWritten("u-two"), true);
    assert.equal(loaded.index.isWritten("u-one"), false);
  });
});

test("開頭有 BOM 的教材仍被認得", () => {
  withContent({ "bom.mdx": `﻿${lesson("u-three")}` }, (root) => {
    const loaded = loadContent(root);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.index.isWritten("u-three"), true);
  });
});

test("沒有 unit 的教材回報 lesson-unit-missing 並帶檔案路徑", () => {
  withContent({ "nounit.mdx": "---\ndescription: 沒有 unit\n---\n內文\n" }, (root) => {
    const loaded = loadContent(root);
    assert.equal(loaded.ok, false);
    const issue = loaded.issues.find((i) => i.code === "lesson-unit-missing");
    assert.equal(issue?.level, "error");
    assert.match(issue.message, /nounit\.mdx/);
  });
});

test("教材 unit 不在課程地圖上回報 lesson-unit-unknown 並帶檔案路徑與 unit", () => {
  withContent({ "ghost.mdx": lesson("no-such-unit") }, (root) => {
    const loaded = loadContent(root);
    assert.equal(loaded.ok, false);
    const issue = loaded.issues.find((i) => i.code === "lesson-unit-unknown");
    assert.equal(issue?.level, "error");
    assert.equal(issue.unitId, "no-such-unit");
    assert.match(issue.message, /ghost\.mdx/);
  });
});

test("同一個 unit 有兩篇教材回報 lesson-unit-duplicate", () => {
  withContent({ "one.mdx": lesson("u-one"), "two.mdx": lesson("u-one") }, (root) => {
    const loaded = loadContent(root);
    assert.equal(loaded.ok, false);
    assert.deepEqual(errorCodes(loaded), ["lesson-unit-duplicate"]);
    assert.equal(loaded.issues[0].unitId, "u-one");
    assert.match(loaded.issues[0].message, /one\.mdx/);
    assert.match(loaded.issues[0].message, /two\.mdx/);
  });
});

test("frontmatter 的 YAML 壞掉時丟出含檔名且帶 cause 的錯誤", () => {
  withContent({ "bad.mdx": "---\nunit: [unclosed\n---\n內文\n" }, (root) => {
    assert.throws(
      () => loadContent(root),
      (e) => /bad\.mdx/.test(e.message) && e.cause !== undefined,
    );
  });
});

test("課程地圖有 error 時 ok 為 false 且不含 index", () => {
  const root = mkdtempSync(join(tmpdir(), "carlmath-load-"));
  try {
    copyFileSync("tests/fixtures/course-maps/prerequisite-after.yaml", join(root, "course-map.yaml"));
    const loaded = loadContent(root);
    assert.equal(loaded.ok, false);
    assert.equal("index" in loaded, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
