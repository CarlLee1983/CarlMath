import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadContent } from "../src/lib/content.ts";

// <Activity> 規則測試（接縫 1）：課程地圖只有一個親子單元與一個一般單元，教材由測試即時組出來。
const COURSE_MAP = `stages:
- id: stage-a
  title: 階段甲
  units:
  - id: ac-fam
    title: 親子單元
    coreQuestion: 親子單元的核心問題？
    prerequisites: []
    family: true
    curriculum108:
      grades: [1]
      content: [N-1-1]
  - id: ac-gen
    title: 一般單元
    coreQuestion: 一般單元的核心問題？
    prerequisites: []
    family: false
    curriculum108:
      grades: [3]
      content: [N-3-1]
`;

const FAMILY_HEADINGS = ["給家長的話", "情境開場", "開始前", "大人先懂", "常見迷思", "親子活動", "練習與解析", "隔天再問", "下一步"];
const GENERAL_HEADINGS = ["情境開場", "暖身", "直覺", "推理", "範例", "常見迷思", "練習", "提取題", "下一步"];
const FIELDS = ["目的", "材料", "步驟", "家長引導語", "卡關時", "回饋語範例"];

/** 組出一個 <Activity>；props 與欄位標題都可以覆寫來製造違規。 */
function activity({ props = 'title="客廳數線" minutes="5–10"', fields = FIELDS, material = "紙膠帶" } = {}) {
  const body = fields.map((h) => `### ${h}\n\n${h === "材料" ? material : `${h}的內容`}\n`).join("\n");
  return `<Activity ${props}>\n\n${body}\n</Activity>\n`;
}

/** 以 sections 覆寫指定 H2 的內文，組出一篇完整的教材。 */
function lesson(unit, headings, sections = {}) {
  const body = headings.map((h) => `## ${h}\n\n${sections[h] ?? "內文"}\n`).join("\n");
  return `---\nunit: ${unit}\n---\n\n${body}`;
}
const familyLesson = (activities, extra = {}) => lesson("ac-fam", FAMILY_HEADINGS, { 親子活動: activities.join("\n"), ...extra });

function load(lessons) {
  const root = mkdtempSync(join(tmpdir(), "carlmath-activity-"));
  try {
    writeFileSync(join(root, "course-map.yaml"), COURSE_MAP);
    mkdirSync(join(root, "lessons"));
    for (const [name, text] of Object.entries(lessons)) writeFileSync(join(root, "lessons", name), text);
    return loadContent(root).issues;
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}
const issuesOf = (lessonText, code) => load({ "a.mdx": lessonText }).filter((i) => i.code === code);

// ---- lesson-activity-shape ----

test("合格的 <Activity>（整數分鐘、a–b 區間、材料欄連到 /print/）沒有 shape 問題", () => {
  const text = familyLesson([
    activity({ props: 'title="客廳數線" minutes="10"' }),
    activity({ props: 'title="數字卡配對" minutes="5–15"', material: "[數字卡](/print/number-cards/)" }),
  ]);
  assert.deepEqual(issuesOf(text, "lesson-activity-shape"), []);
});

test("minutes 區間的破折號用 –（U+2013）或 - 都合格", () => {
  const text = familyLesson([activity({ props: 'title="活動" minutes="5-10"' }), activity({ props: 'title="活動" minutes="5–10"' })]);
  assert.deepEqual(issuesOf(text, "lesson-activity-shape"), []);
});

test("缺 title 回報 lesson-activity-shape", () => {
  const [issue, ...rest] = issuesOf(familyLesson([activity({ props: 'minutes="10"' })]), "lesson-activity-shape");
  assert.equal(issue?.level, "error");
  assert.equal(issue.unitId, "ac-fam");
  assert.equal(rest.length, 0);
  assert.match(issue.message, /title/);
  assert.match(issue.message, /a\.mdx/);
});

test("title 是空字串或不是字串字面值回報 lesson-activity-shape", () => {
  for (const props of ['title="  " minutes="10"', "title={3} minutes=\"10\""]) {
    const [issue] = issuesOf(familyLesson([activity({ props })]), "lesson-activity-shape");
    assert.equal(issue?.level, "error", props);
    assert.match(issue.message, /title/, props);
  }
});

test("minutes 缺漏、不在 5–15 內或格式不對回報 lesson-activity-shape", () => {
  const bad = ['title="活動"', 'title="活動" minutes="4"', 'title="活動" minutes="16"', 'title="活動" minutes="12-8"', 'title="活動" minutes="12–8"', 'title="活動" minutes="3–10"', 'title="活動" minutes="5–20"', 'title="活動" minutes="十分鐘"', 'title="活動" minutes="7.5"', 'title="活動" minutes={10}'];
  for (const props of bad) {
    const [issue, ...rest] = issuesOf(familyLesson([activity({ props })]), "lesson-activity-shape");
    assert.equal(issue?.level, "error", props);
    assert.equal(rest.length, 0, props);
    assert.match(issue.message, /minutes/, props);
  }
});

test("六個 H3 缺漏、順序錯、多出或重複都回報 lesson-activity-shape", () => {
  const cases = {
    缺一個: [FIELDS.filter((h) => h !== "卡關時"), /缺少.*卡關時/],
    順序錯: [["材料", "目的", ...FIELDS.slice(2)], /順序/],
    多出其他: [[...FIELDS, "補充"], /多出.*補充/],
    重複: [[...FIELDS, "目的"], /多出.*目的|重複/],
  };
  for (const [name, [fields, pattern]] of Object.entries(cases)) {
    const [issue, ...rest] = issuesOf(familyLesson([activity({ fields })]), "lesson-activity-shape");
    assert.equal(issue?.level, "error", name);
    assert.equal(rest.length, 0, name);
    assert.match(issue.message, pattern, name);
  }
});

test("六個 H3 之前有內容、或內容裡有其他層級的標題回報 lesson-activity-shape", () => {
  const withLead = familyLesson([`<Activity title="活動" minutes="10">\n\n先說幾句。\n\n${FIELDS.map((h) => `### ${h}\n\n內容\n`).join("\n")}\n</Activity>\n`]);
  assert.equal(issuesOf(withLead, "lesson-activity-shape").length, 1);
  const withH4 = familyLesson([activity().replace("紙膠帶", "#### 小標\n\n紙膠帶")]);
  assert.equal(issuesOf(withH4, "lesson-activity-shape").length, 1);
});

test("<Activity> 出現在親子篇「親子活動」以外的段落，或出現在一般篇，回報 lesson-activity-shape", () => {
  const elsewhere = familyLesson([activity()], { 大人先懂: activity() });
  const [issue, ...rest] = issuesOf(elsewhere, "lesson-activity-shape");
  assert.equal(issue?.level, "error");
  assert.equal(rest.length, 0);
  assert.match(issue.message, /大人先懂/);

  const onGeneral = lesson("ac-gen", GENERAL_HEADINGS, { 範例: activity() });
  const [general] = issuesOf(onGeneral, "lesson-activity-shape");
  assert.equal(general?.level, "error");
  assert.equal(general.unitId, "ac-gen");
  assert.match(general.message, /親子篇/);
});

// ---- lesson-activity-count ----

const countIssues = (text) => issuesOf(text, "lesson-activity-count");

test("「親子活動」段有 1 個或 3 個 <Activity> 沒有 count 問題", () => {
  assert.deepEqual(countIssues(familyLesson([activity()])), []);
  assert.deepEqual(countIssues(familyLesson([activity(), activity(), activity()])), []);
});

test("「親子活動」段沒有 <Activity> 回報 lesson-activity-count", () => {
  const [issue, ...rest] = countIssues(familyLesson([]));
  assert.equal(issue?.level, "error");
  assert.equal(issue.unitId, "ac-fam");
  assert.equal(rest.length, 0);
  assert.match(issue.message, /有 0 個/);
});

test("「親子活動」段有 4 個 <Activity> 回報 lesson-activity-count", () => {
  const [issue, ...rest] = countIssues(familyLesson([activity(), activity(), activity(), activity()]));
  assert.equal(issue?.level, "error");
  assert.equal(rest.length, 0);
  assert.match(issue.message, /有 4 個/);
});

test("其他段落裡的 <Activity> 不算進「親子活動」的數量", () => {
  const text = familyLesson([activity(), activity(), activity()], { 大人先懂: activity() });
  assert.deepEqual(countIssues(text), []);
});

// ---- lesson-activity-printable ----

const printableIssues = (text) => issuesOf(text, "lesson-activity-printable");

test("至少一個 <Activity> 的材料欄連到 /print/ 沒有 printable 提醒", () => {
  const text = familyLesson([activity(), activity({ material: "紙膠帶，或[列印數字卡](/print/number-cards/)" })]);
  assert.deepEqual(printableIssues(text), []);
});

test("沒有任何材料欄連到 /print/ 回報 lesson-activity-printable（warning，不擋 build）", () => {
  const [issue, ...rest] = printableIssues(familyLesson([activity(), activity({ material: "[說明](/guide/)" })]));
  assert.equal(issue?.level, "warning");
  assert.equal(issue.unitId, "ac-fam");
  assert.equal(rest.length, 0);
  assert.match(issue.message, /\/print\//);
});

test("/print/ 連結不在材料欄時不算", () => {
  const text = familyLesson([activity().replace("步驟的內容", "[數字卡](/print/number-cards/)")]);
  assert.equal(printableIssues(text).length, 1);
});

test("printable 只有 warning：loadContent 仍然 ok", () => {
  const root = mkdtempSync(join(tmpdir(), "carlmath-activity-"));
  try {
    writeFileSync(join(root, "course-map.yaml"), COURSE_MAP);
    mkdirSync(join(root, "lessons"));
    writeFileSync(join(root, "lessons", "a.mdx"), familyLesson([activity()]));
    assert.equal(loadContent(root).ok, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
