import type { Issue, Unit } from "./course-map-model.ts";
import { lessonIssue } from "./lesson-issue.ts";
import type { ParsedLesson } from "./lesson-parse.ts";

const GENERAL_RANGE = { min: 2000, max: 3500 };
const FAMILY_RANGE = { min: 2500, max: 4000 };

/** 字數 = 中日韓漢字數 + 拉丁單字數 + 數字串數（`3.14` 算一個數字串）。 */
function countWords(chunks: string[]): number {
  const text = chunks.join("\n");
  const han = text.match(/\p{Script=Han}/gu)?.length ?? 0;
  const latin = text.match(/\p{Script=Latin}+(?:['’-]\p{Script=Latin}+)*/gu)?.length ?? 0;
  const numbers = text.match(/\p{Nd}+(?:[.,]\p{Nd}+)*/gu)?.length ?? 0;
  return han + latin + numbers;
}

/** 篇幅提醒（warning，不擋）：一般篇 2,000–3,500 字，親子篇 2,500–4,000 字，不含 `<Answer>` 內的解析。 */
export function lengthIssues(lesson: ParsedLesson, unit: Unit): Issue[] {
  const { min, max } = unit.family ? FAMILY_RANGE : GENERAL_RANGE;
  const count = countWords(lesson.prose);
  if (count >= min && count <= max) return [];
  const range = `${min.toLocaleString("en-US")}–${max.toLocaleString("en-US")}`;
  const verdict = count < min ? "過短" : "過長";
  const message = `教材 ${lesson.path} ${verdict}：字數 ${count}（${unit.family ? "親子篇" : "一般篇"}建議 ${range}，不含 <Answer> 內的解析與數學式）`;
  return [lessonIssue("lesson-length-out-of-range", message, unit.id, "warning")];
}
