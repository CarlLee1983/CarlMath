import type { Issue, Unit } from "./course-map-model.ts";
import { lessonIssue } from "./lesson-issue.ts";
import type { ParsedLesson } from "./lesson-parse.ts";

/** 一般篇第 7 段的標題；`<SkipCheck>` 的錨點用它（Astro 以標題文字當 id）。 */
export const PRACTICE_HEADING = "練習";
const GENERAL_HEADINGS = ["情境開場", "先修回顧", "直覺", "推理", "範例", "常見迷思", PRACTICE_HEADING, "提取題", "下一步"];
const FAMILY_HEADINGS = ["給家長的話", "情境開場", "開始前", "大人先懂", "常見迷思", "親子活動", "練習與解析", "隔天再問", "下一步"];
const WARMUP = "暖身";
const REVIEW = "先修回顧";

/** 單元該有的 9 段 H2：親子篇固定；一般篇沒有先修的單元，第 2 段是「暖身」。 */
function expectedHeadings(unit: Unit): string[] {
  if (unit.family) return FAMILY_HEADINGS;
  return GENERAL_HEADINGS.map((h) => (h === REVIEW && unit.prerequisites.length === 0 ? WARMUP : h));
}

/** 檢查 H2 齊全、依序、無多餘；每個問題各一則 error，訊息指出缺哪段、哪段順序錯或哪段多出。 */
export function structureIssues(lesson: ParsedLesson, unit: Unit): Issue[] {
  const expected = expectedHeadings(unit);
  const issue = (message: string): Issue => lessonIssue("lesson-structure", `教材 ${lesson.path} ${message}`, unit.id);
  if (lesson.h2.length === 0) return [issue(`沒有任何 H2，應依序為：${expected.map((h) => `「${h}」`).join("")}`)];

  const issues: Issue[] = [];
  // 「暖身」與「先修回顧」用錯時只回報一次，並視為正確的那個繼續檢查順序。
  const wrong = expected.includes(WARMUP) ? REVIEW : WARMUP;
  const right = wrong === WARMUP ? REVIEW : WARMUP;
  const present: string[] = [];
  for (const heading of lesson.h2) {
    if (heading === wrong && expected.includes(right) && !lesson.h2.includes(right)) {
      const reason = right === WARMUP ? "單元沒有先修" : "單元有先修";
      issues.push(issue(`${reason}，第 2 段應為「${right}」，目前是「${wrong}」`));
      present.push(right);
    } else if (!expected.includes(heading)) {
      issues.push(issue(`多出不在規格內的 H2「${heading}」`));
    } else if (present.includes(heading)) {
      issues.push(issue(`H2「${heading}」重複出現`));
    } else {
      present.push(heading);
    }
  }
  expected.forEach((heading, i) => {
    if (!present.includes(heading)) issues.push(issue(`缺少 H2「${heading}」（應為第 ${i + 1} 段）`));
  });
  const expectedPresent = expected.filter((h) => present.includes(h));
  const mismatch = present.findIndex((h, i) => h !== expectedPresent[i]);
  if (mismatch !== -1) {
    issues.push(
      issue(`H2 順序錯誤：依序排列時，第 ${mismatch + 1} 個應為「${expectedPresent[mismatch]}」，目前是「${present[mismatch]}」`),
    );
  }
  return issues;
}
