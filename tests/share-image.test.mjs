import { test } from "node:test";
import assert from "node:assert/strict";
import { shareImageFileName, TEMPLATE_VERSION } from "../src/lib/share-image.ts";

const unit = { id: "number-line", stage: "階段一", title: "數線", question: "負數為什麼在零的左邊？" };

test("相同輸入得到相同檔名", () => {
  assert.equal(shareImageFileName(unit), shareImageFileName({ ...unit }));
});

test("檔名格式為 <id>-<hash>.png", () => {
  assert.match(shareImageFileName(unit), /^number-line-[0-9a-f]{10}\.png$/);
  assert.match(shareImageFileName({ id: "default", title: "CarlMath", question: "標語" }), /^default-[0-9a-f]{10}\.png$/);
});

test("改階段、標題或核心問題，檔名都會改變", () => {
  const base = shareImageFileName(unit);
  for (const changed of [{ stage: "階段二" }, { title: "數線二" }, { question: "零的左邊是什麼？" }]) {
    assert.notEqual(shareImageFileName({ ...unit, ...changed }), base);
  }
});

test("改模板版本，檔名會改變", () => {
  assert.equal(shareImageFileName(unit, TEMPLATE_VERSION), shareImageFileName(unit));
  assert.notEqual(shareImageFileName(unit, TEMPLATE_VERSION + 1), shareImageFileName(unit));
});
