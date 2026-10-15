import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 把 fixture 當成內容根目錄的 course-map.yaml，執行 pnpm validate:content。
function validate(fixtureName) {
  const root = mkdtempSync(join(tmpdir(), "carlmath-content-"));
  try {
    copyFileSync(`tests/fixtures/course-maps/${fixtureName}.yaml`, join(root, "course-map.yaml"));
    const result = spawnSync("pnpm", ["--silent", "validate:content"], {
      env: { ...process.env, CARLMATH_CONTENT_DIR: root },
      encoding: "utf8",
    });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("合格的課程地圖 exit 0 並印出摘要", () => {
  const { status, stdout } = validate("valid");
  assert.equal(status, 0);
  assert.match(stdout, /2 個階段/);
  assert.match(stdout, /6 個單元/);
  assert.match(stdout, /親子共學 3 個/);
});

test("有 error 的課程地圖 exit 1 並印出違規代碼與單元 id", () => {
  const { status, stdout } = validate("prerequisite-after");
  assert.equal(status, 1);
  assert.match(stdout, /error\s+prerequisite-after\s+u-one/);
});

test("結構壞掉的課程地圖也 exit 1", () => {
  const { status, stdout } = validate("empty-grades");
  assert.equal(status, 1);
  assert.match(stdout, /error\s+empty-grades\s+u-two/);
});

test("只有 warning 時 exit 0 且仍印出該提醒", () => {
  const { status, stdout } = validate("empty-content-no-note");
  assert.equal(status, 0);
  assert.match(stdout, /warning\s+empty-content-without-note\s+u-one/);
});
