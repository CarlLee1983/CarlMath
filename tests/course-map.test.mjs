import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parse, stringify } from "yaml";
import { checkCourseMap, createCourseIndex } from "../src/lib/course-map.ts";

const fixtureText = (name) => readFileSync(`tests/fixtures/course-maps/${name}.yaml`, "utf8");
const check = (name) => checkCourseMap(fixtureText(name)).issues;

// 以合格 fixture 為底，套用修改後轉回 YAML 文字（stage-a 的第二個單元是 u-two）。
function mutated(change) {
  const map = parse(fixtureText("valid"));
  change(map.stages[0], map.stages[0].units[1]);
  return stringify(map);
}

// 斷言恰有一筆指定 code 的 error，且 unitId 正確。
function assertIssue(issues, code, unitId) {
  const found = issues.filter((issue) => issue.code === code);
  assert.equal(found.length, 1, `應恰有一筆 ${code}，實得 ${JSON.stringify(issues)}`);
  assert.equal(found[0].level, "error");
  assert.equal(found[0].unitId, unitId);
}

test("合格的課程地圖沒有任何違規", () => {
  assert.deepEqual(check("valid"), []);
});

test("id 重複回報 duplicate-id", () => {
  assertIssue(check("duplicate-id"), "duplicate-id", "u-two");
});

test("先修不存在回報 prerequisite-missing", () => {
  assertIssue(check("prerequisite-missing"), "prerequisite-missing", "u-two");
});

test("先修排在後面回報 prerequisite-after，與不存在分開", () => {
  const issues = check("prerequisite-after");
  assertIssue(issues, "prerequisite-after", "u-one");
  assert.equal(issues.some((issue) => issue.code === "prerequisite-missing"), false);
});

test("親子共學單元年級最小值超過 6 回報 family-grade-out-of-range", () => {
  const issues = check("family-out-of-range");
  assertIssue(issues, "family-grade-out-of-range", "u-two");
  assert.match(issues[0].message, /6/);
});

for (const [grades, ok] of [[[6], true], [[5, 7], true], [[7], false]]) {
  test(`親子共學邊界：grades ${JSON.stringify(grades)} ${ok ? "合格" : "違規"}`, () => {
    const { issues } = checkCourseMap(mutated((_stage, unit) => {
      unit.family = true;
      unit.curriculum108.grades = grades;
    }));
    if (ok) assert.deepEqual(issues, []);
    else assertIssue(issues, "family-grade-out-of-range", "u-two");
  });
}

test("id 格式不符回報 invalid-id", () => {
  assertIssue(check("invalid-id"), "invalid-id", "U_Two");
});

const requiredStageFields = ["id", "title", "units"];
for (const key of requiredStageFields) {
  test(`階段缺必填欄位 ${key} 回報 missing-field`, () => {
    const { courseMap, issues } = checkCourseMap(mutated((stage) => delete stage[key]));
    assert.equal(courseMap, null);
    assertIssue(issues, "missing-field", undefined);
    assert.match(issues[0].message, new RegExp(key));
  });
}

const requiredUnitFields = [
  ["id", undefined],
  ["title", "u-two"],
  ["coreQuestion", "u-two"],
  ["prerequisites", "u-two"],
  ["family", "u-two"],
  ["curriculum108", "u-two"],
  ["curriculum108.grades", "u-two"],
  ["curriculum108.content", "u-two"],
];
for (const [path, unitId] of requiredUnitFields) {
  test(`單元缺必填欄位 ${path} 回報 missing-field`, () => {
    const { courseMap, issues } = checkCourseMap(mutated((_stage, unit) => {
      const keys = path.split(".");
      const last = keys.pop();
      delete keys.reduce((obj, k) => obj[k], unit)[last];
    }));
    assert.equal(courseMap, null);
    assertIssue(issues, "missing-field", unitId);
    assert.match(issues[0].message, new RegExp(path.replace(".", "\\.")));
  });
}

test("curriculum108.content 可以是空陣列", () => {
  const { courseMap } = checkCourseMap(mutated((_stage, unit) => {
    unit.curriculum108.content = [];
    unit.curriculum108.note = "超出範圍";
  }));
  assert.notEqual(courseMap, null);
});

test("階段缺 units 的 fixture 回報 missing-field", () => {
  assertIssue(check("missing-stage-units"), "missing-field", undefined);
});

test("grades 為空陣列回報 empty-grades", () => {
  assertIssue(check("empty-grades"), "empty-grades", "u-two");
});

test("欄位型別錯誤回報 invalid-type", () => {
  assertIssue(check("invalid-type"), "invalid-type", "u-two");
});

test("YAML 語法錯誤以 issue 回報而非丟例外", () => {
  const { courseMap, issues } = checkCourseMap(fixtureText("not-yaml"));
  assert.equal(courseMap, null);
  assert.equal(issues[0].code, "invalid-yaml");
});

test("content 為空又沒有 note 只是提醒級，地圖仍可使用", () => {
  const { courseMap, issues } = checkCourseMap(fixtureText("empty-content-no-note"));
  assert.notEqual(courseMap, null);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].level, "warning");
  assert.equal(issues[0].code, "empty-content-without-note");
  assert.equal(issues[0].unitId, "u-one");
});

// ---- 推導（createCourseIndex） ----

function indexOf(name, written = []) {
  const { courseMap } = checkCourseMap(fixtureText(name));
  return createCourseIndex(courseMap, written);
}
const ids = (units) => units.map((u) => u.id);

test("建議閱讀順序涵蓋全部單元，全站序號從 1 起", () => {
  const index = indexOf("valid");
  assert.deepEqual(ids(index.units), ["u-one", "u-two", "u-three", "u-four", "u-five", "u-six"]);
  assert.equal(index.sequenceOf("u-one"), 1);
  assert.equal(index.sequenceOf("u-four"), 4);
  assert.equal(index.sequenceOf("u-six"), 6);
});

test("單元所屬階段", () => {
  const index = indexOf("valid");
  assert.equal(index.stageOf("u-two").id, "stage-a");
  assert.equal(index.stageOf("u-four").id, "stage-b");
});

test("上一個與下一個單元，頭尾為 null（跨階段照全站順序）", () => {
  const index = indexOf("valid");
  assert.equal(index.previous("u-one"), null);
  assert.equal(index.previous("u-four").id, "u-three");
  assert.equal(index.next("u-three").id, "u-four");
  assert.equal(index.next("u-six"), null);
});

test("直接先修只列 prerequisites 寫的單元", () => {
  const index = indexOf("valid");
  assert.deepEqual(ids(index.prerequisites("u-five")), ["u-three", "u-four"]);
  assert.deepEqual(ids(index.prerequisites("u-one")), []);
});

test("遞移先修依建議閱讀順序排列且不含自己", () => {
  const index = indexOf("valid");
  assert.deepEqual(ids(index.transitivePrerequisites("u-five")), ["u-one", "u-two", "u-three", "u-four"]);
  assert.deepEqual(ids(index.transitivePrerequisites("u-six")), ["u-one", "u-two", "u-three"]);
  assert.deepEqual(ids(index.transitivePrerequisites("u-one")), []);
});

test("直接反向依賴依建議閱讀順序", () => {
  const index = indexOf("valid");
  assert.deepEqual(ids(index.dependents("u-one")), ["u-two", "u-four"]);
  assert.deepEqual(ids(index.dependents("u-three")), ["u-five", "u-six"]);
  assert.deepEqual(ids(index.dependents("u-six")), []);
});

test("建議年級是課綱年級的最小到最大", () => {
  const index = indexOf("valid");
  assert.deepEqual(index.gradeRange("u-two"), { min: 1, max: 2 });
  assert.deepEqual(index.gradeRange("u-five"), { min: 7, max: 8 });
  assert.deepEqual(index.gradeRange("u-six"), { min: 5, max: 5 });
});

test("撰寫狀態由教材單元 id 集合推導", () => {
  const index = indexOf("valid", ["u-one", "u-three"]);
  assert.equal(index.isWritten("u-one"), true);
  assert.equal(index.isWritten("u-two"), false);
  assert.equal(index.isWritten("u-three"), true);
});

test("查詢不存在的單元時丟出錯誤", () => {
  assert.throws(() => indexOf("valid").stageOf("u-ghost"), /u-ghost/);
});

test("nextStep：下一個單元依賴本單元時只預告下一個", () => {
  const step = indexOf("valid").nextStep("u-two");
  assert.equal(step.kind, "next");
  assert.deepEqual(ids(step.units), ["u-three"]);
});

test("nextStep：下一個單元不依賴本單元時列出全部反向依賴", () => {
  const step = indexOf("valid").nextStep("u-three");
  assert.equal(step.kind, "dependents");
  assert.deepEqual(ids(step.units), ["u-five", "u-six"]);
});

test("nextStep：本單元沒有反向依賴時只預告下一個", () => {
  const step = indexOf("valid").nextStep("u-five");
  assert.equal(step.kind, "next");
  assert.deepEqual(ids(step.units), ["u-six"]);
});

test("nextStep：最後一個單元沒有下一步", () => {
  const step = indexOf("valid").nextStep("u-six");
  assert.equal(step.kind, "next");
  assert.deepEqual(step.units, []);
});

// ---- 真實課程地圖 ----

function realIndex() {
  const { courseMap, issues } = checkCourseMap(readFileSync("content/course-map.yaml", "utf8"));
  assert.deepEqual(issues.filter((issue) => issue.level === "error"), []);
  return createCourseIndex(courseMap, []);
}

test("真實課程地圖沒有 error", () => {
  realIndex();
});

test("真實課程地圖：數線的下一步列出四個反向依賴", () => {
  const index = realIndex();
  assert.equal(index.next("number-line").id, "composing-ten");
  const step = index.nextStep("number-line");
  assert.equal(step.kind, "dependents");
  assert.deepEqual(ids(step.units), ["estimation-rounding", "fractions-on-number-line", "angles", "negative-numbers"]);
});

test("真實課程地圖：數數的下一步預告比多少", () => {
  const step = realIndex().nextStep("counting");
  assert.equal(step.kind, "next");
  assert.deepEqual(ids(step.units), ["comparing-quantities"]);
});
