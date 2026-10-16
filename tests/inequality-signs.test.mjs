import { test } from "node:test";
import assert from "node:assert/strict";
import { loadContent } from "../src/lib/content.ts";

// 不等號規則（ADR 0006）：全站用 ≤ ≥，雙線寫法 build 失敗；只有一元一次不等式那一句說明可以寫 ≧ ≦ 字元。
const { issues } = loadContent("tests/fixtures/lessons/inequality");
const signIssues = issues.filter((i) => i.code === "notation-inequality-sign");
const issuesOf = (unitId) => signIssues.filter((i) => i.unitId === unitId);

test("KaTeX 的 \\geqq、\\leqq 各回報一則，點名檔案、行號並指向 ADR 0006", () => {
  const found = issuesOf("iq-katex");
  assert.equal(found.length, 2);
  for (const issue of found) {
    assert.equal(issue.level, "error");
    assert.match(issue.message, /katex\.mdx 第 \d+ 行/);
    assert.match(issue.message, /ADR 0006/);
  }
  assert.match(found[0].message, /\\geqq.*\\ge/);
  assert.match(found[1].message, /\\leqq.*\\le/);
});

test("正文的 ≦ 字元回報，並建議改成 ≤", () => {
  const [issue, ...rest] = issuesOf("iq-char");
  assert.equal(rest.length, 0);
  assert.match(issue.message, /「≦」.*「≤」/);
});

test("那一句說明的 ≧ ≦ 放行", () => {
  assert.deepEqual(issuesOf("iq-note"), []);
});

test("說明句只放行它自己：同一段其他地方的 ≦ 與 \\geqq 照常回報", () => {
  const found = issuesOf("iq-mixed");
  assert.equal(found.length, 2);
  assert.ok(found.some((i) => /\\geqq/.test(i.message)));
  assert.ok(found.some((i) => /「≦」/.test(i.message)));
});

test("\\geq 回報改成 \\ge，\\geqslant 不被當成 \\geq 或 \\geqq", () => {
  const [issue, ...rest] = issuesOf("iq-geq");
  assert.equal(rest.length, 0);
  assert.match(issue.message, /`\\geq`.*`\\ge`/);
});

test("寫成 \\ge、\\le 與 ≤ ≥ 的教材合格", () => {
  assert.deepEqual(issuesOf("iq-ok"), []);
});

test("教具檔也檢查，回報到 import 它的單元", () => {
  const [issue, ...rest] = issuesOf("iq-figure");
  assert.equal(rest.length, 0);
  assert.match(issue.message, /IqFigure\.astro 第 2 行/);
});

test("課程地圖的單元欄位回報到該單元，階段層級的行不歸給任何單元", () => {
  const [unitIssue, ...rest] = issuesOf("iq-map");
  assert.equal(rest.length, 0);
  assert.match(unitIssue.message, /course-map\.yaml 第 \d+ 行/);
  const [stageIssue, ...more] = issuesOf(undefined);
  assert.equal(more.length, 0);
  assert.match(stageIssue.message, /course-map\.yaml 第 4 行/);
});
