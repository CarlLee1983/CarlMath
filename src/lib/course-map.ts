import type { CourseMap, Issue } from "./course-map-model.ts";
import { parseCourseMap } from "./course-map-parse.ts";
import { validateRules } from "./course-map-rules.ts";

export { createCourseIndex } from "./course-map-index.ts";
export type { CourseIndex, NextStep } from "./course-map-index.ts";
export type { CourseMap, Issue, IssueCode, Stage, Unit } from "./course-map-model.ts";

/**
 * 載入並驗證課程地圖：先檢查結構（必填欄位、型別），通過後再檢查規則
 * （id、先修、親子共學年級）。結構有 error 時 courseMap 為 null 且不跑規則；
 * 有規則 error 時 courseMap 仍會回傳，由呼叫端依 issues 決定。不丟例外。
 */
export function checkCourseMap(yamlText: string): { courseMap: CourseMap | null; issues: Issue[] } {
  const { courseMap, issues: structureIssues } = parseCourseMap(yamlText);
  if (!courseMap) return { courseMap, issues: structureIssues };
  return { courseMap, issues: validateRules(courseMap) };
}
