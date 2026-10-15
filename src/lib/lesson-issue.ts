import type { Issue, IssueCode } from "./course-map-model.ts";

/** 教材與教具規則共用的 issue 組裝；預設為 error。 */
export function lessonIssue(code: IssueCode, message: string, unitId?: string, level: Issue["level"] = "error"): Issue {
  return { level, code, message, unitId };
}
