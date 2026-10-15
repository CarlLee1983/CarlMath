import type { Issue, Unit } from "./course-map-model.ts";
import { componentIssues } from "./lesson-components.ts";
import { lessonFrontmatterSchema } from "./lesson-frontmatter.ts";
import { lessonIssue } from "./lesson-issue.ts";
import { lengthIssues } from "./lesson-length.ts";
import type { ParsedLesson } from "./lesson-parse.ts";
import { structureIssues } from "./lesson-structure.ts";

/**
 * frontmatter 依共用 schema 檢查：多餘欄位 → `lesson-frontmatter-extra`（每個欄位一則），其餘 → `lesson-frontmatter-invalid`。
 * `unit` 本身的缺漏與是否在地圖上由 content.ts 檢查，這裡略過。
 */
function frontmatterIssues(lesson: ParsedLesson): Issue[] {
  const { path, unit, frontmatter } = lesson;
  const result = lessonFrontmatterSchema.safeParse(frontmatter);
  if (result.success) return [];
  return result.error.issues.flatMap((issue) => {
    if (issue.code === "unrecognized_keys") {
      return issue.keys.map((key) =>
        lessonIssue(
          "lesson-frontmatter-extra",
          `教材 ${path} 的 frontmatter 有不允許的欄位「${key}」（只允許 unit、description、updated；標題與先修從課程地圖取）`,
          unit,
        ),
      );
    }
    const field = String(issue.path[0]);
    if (field === "unit") return [];
    const current = JSON.stringify(frontmatter[field]);
    return [lessonIssue("lesson-frontmatter-invalid", `教材 ${path} 的 ${field} 不合法（${issue.message}），目前是 ${current}；updated 須為 YYYY-MM-DD`, unit)];
  });
}

/** 單篇教材的全部規則。`unit` 是教材對應的地圖單元；unit 缺漏或不在地圖上時為 undefined，只跑不需要單元資料的規則。 */
export function lessonRuleIssues(lesson: ParsedLesson, unit: Unit | undefined): Issue[] {
  return [
    ...frontmatterIssues(lesson),
    ...(unit ? structureIssues(lesson, unit) : []),
    ...componentIssues(lesson, unit),
    ...(unit ? lengthIssues(lesson, unit) : []),
  ];
}
