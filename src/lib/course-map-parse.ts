import { parse } from "yaml";
import { courseMapSchema, type CourseMap, type Issue } from "./course-map-model.ts";

type PathKey = string | number | symbol;

/** 解析 YAML 並以 schema 檢查結構；任何結構 error 時 courseMap 為 null。 */
export function parseCourseMap(yamlText: string): { courseMap: CourseMap | null; issues: Issue[] } {
  let raw: unknown;
  try {
    raw = parse(yamlText);
  } catch (e) {
    return { courseMap: null, issues: [{ level: "error", code: "invalid-yaml", message: `YAML 語法錯誤：${(e as Error).message}` }] };
  }
  const result = courseMapSchema.safeParse(raw);
  if (result.success) return { courseMap: result.data, issues: [] };
  return {
    courseMap: null,
    issues: result.error.issues.map((zodIssue) => toIssue(raw, zodIssue.path, zodIssue.code, zodIssue.message)),
  };
}

function valueAt(root: unknown, path: readonly PathKey[]): unknown {
  let current = root;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<PathKey, unknown>)[key];
  }
  return current;
}

function toIssue(raw: unknown, path: readonly PathKey[], zodCode: string, zodMessage: string): Issue {
  // 路徑形如 stages.<n>.units.<m>.<欄位...>；單元 id 從原始資料取，單元本身沒有 id 時不帶
  const inUnit = path[0] === "stages" && path[2] === "units" && typeof path[3] === "number";
  const rawUnitId = inUnit ? valueAt(raw, path.slice(0, 4).concat("id")) : undefined;
  const unitId = typeof rawUnitId === "string" ? rawUnitId : undefined;
  const fieldPath = path.join(".");
  const where = inUnit ? `單元 ${unitId ?? `（第 ${Number(path[3]) + 1} 個）`}` : "課程地圖";
  const base = unitId === undefined ? {} : { unitId };

  if (zodCode === "too_small" && path.at(-1) === "grades") {
    return { level: "error", code: "empty-grades", message: `${where} 的 ${fieldPath} 不可為空`, ...base };
  }
  const found = valueAt(raw, path);
  if (found === undefined || found === null) {
    return { level: "error", code: "missing-field", message: `${where} 缺少必填欄位 ${fieldPath}`, ...base };
  }
  return { level: "error", code: "invalid-type", message: `${where} 的 ${fieldPath} 型別錯誤：${zodMessage}`, ...base };
}
