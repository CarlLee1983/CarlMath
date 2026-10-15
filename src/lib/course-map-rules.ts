import { allUnits, type CourseMap, type Issue, type IssueCode } from "./course-map-model.ts";

const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** 親子共學單元的課綱年級最小值上限（國小 6 年級） */
const FAMILY_MAX_GRADE = 6;

/** 驗證已通過結構檢查的課程地圖；先修存在且排在前面，等同無環。 */
export function validateRules(courseMap: CourseMap): Issue[] {
  const issues: Issue[] = [];
  const earlierIds = new Set<string>();
  const allIds = new Set(allUnits(courseMap).map((unit) => unit.id));
  const report = (level: Issue["level"], code: IssueCode, message: string, unitId: string) =>
    issues.push({ level, code, message, unitId });

  for (const unit of allUnits(courseMap)) {
    if (!ID_PATTERN.test(unit.id)) {
      report("error", "invalid-id", `id「${unit.id}」格式不符（小寫英數與連字號）`, unit.id);
    }
    if (earlierIds.has(unit.id)) report("error", "duplicate-id", `id「${unit.id}」重複`, unit.id);
    for (const prerequisite of unit.prerequisites) {
      if (!allIds.has(prerequisite)) {
        report("error", "prerequisite-missing", `先修「${prerequisite}」不存在`, unit.id);
      } else if (!earlierIds.has(prerequisite)) {
        report("error", "prerequisite-after", `先修「${prerequisite}」排在本單元之後`, unit.id);
      }
    }
    if (unit.family && Math.min(...unit.curriculum108.grades) > FAMILY_MAX_GRADE) {
      report("error", "family-grade-out-of-range", `標為親子共學，但課綱年級最小值超過 ${FAMILY_MAX_GRADE}`, unit.id);
    }
    if (unit.curriculum108.content.length === 0 && !unit.curriculum108.note) {
      report("warning", "empty-content-without-note", "curriculum108.content 為空，應以 note 說明原因", unit.id);
    }
    earlierIds.add(unit.id);
  }
  return issues;
}
