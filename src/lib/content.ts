import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parseFrontmatter } from "@astrojs/markdown-remark";
import { checkCourseMap, createCourseIndex } from "./course-map.ts";
import type { CourseIndex, CourseMap, Issue } from "./course-map.ts";

/** `ok` 為 true 表示沒有 error 等級的 issue（可能仍有 warning），此時課程地圖與查詢物件一定可用。 */
export type LoadedContent =
  | { ok: true; courseMap: CourseMap; index: CourseIndex; issues: Issue[] }
  | { ok: false; issues: Issue[] };

interface LessonFile {
  /** 相對於內容根目錄的路徑，用於訊息 */
  path: string;
  unit: string | undefined;
}

/** 掃描 `<root>/lessons/**\/*.mdx`，讀出各檔 frontmatter 的 `unit`。frontmatter 無法解析時帶檔案路徑重拋。 */
function scanLessons(root: string): LessonFile[] {
  const lessonsDir = join(root, "lessons");
  if (!existsSync(lessonsDir)) return [];
  const files = readdirSync(lessonsDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
  return files.map((file) => {
    const path = relative(root, file);
    try {
      const { unit } = parseFrontmatter(readFileSync(file, "utf8")).frontmatter;
      return { path, unit: typeof unit === "string" ? unit : undefined };
    } catch (e) {
      throw new Error(`教材 ${path} 的 frontmatter 無法解析：${(e as Error).message}`, { cause: e });
    }
  });
}

/** 教材與課程地圖的最小對應檢查：每篇教材要有 unit、unit 要在地圖上、同一個 unit 只能有一篇。 */
function lessonIssues(lessons: LessonFile[], mapUnitIds: Set<string>): Issue[] {
  const issues: Issue[] = [];
  const firstPathOf = new Map<string, string>();
  for (const { path, unit } of lessons) {
    if (unit === undefined) {
      issues.push({ level: "error", code: "lesson-unit-missing", message: `教材 ${path} 的 frontmatter 沒有 unit` });
    } else if (!mapUnitIds.has(unit)) {
      issues.push({ level: "error", code: "lesson-unit-unknown", message: `教材 ${path} 的 unit「${unit}」不在課程地圖上`, unitId: unit });
    } else if (firstPathOf.has(unit)) {
      issues.push({
        level: "error",
        code: "lesson-unit-duplicate",
        message: `單元「${unit}」有兩篇教材：${firstPathOf.get(unit)}、${path}`,
        unitId: unit,
      });
    } else {
      firstPathOf.set(unit, path);
    }
  }
  return issues;
}

/**
 * 內容載入的單一入口：讀 `<root>/course-map.yaml` 並驗證，掃描教材 frontmatter 的 `unit`
 * 得到「已撰寫」的單元，並做教材與地圖的最小對應檢查，建立課程查詢物件。
 * 讀不到課程地圖檔、教材 frontmatter 無法解析時丟出例外；其餘問題以 issues 回報。
 */
export function loadContent(root: string): LoadedContent {
  const file = join(root, "course-map.yaml");
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    throw new Error(`讀不到課程地圖 ${file}：${(e as Error).message}`, { cause: e });
  }
  const { courseMap, issues } = checkCourseMap(text);
  if (!courseMap) return { ok: false, issues };

  const lessons = scanLessons(root);
  const mapUnitIds = new Set(courseMap.stages.flatMap((stage) => stage.units.map((unit) => unit.id)));
  const allIssues = [...issues, ...lessonIssues(lessons, mapUnitIds)];
  if (allIssues.some((issue) => issue.level === "error")) return { ok: false, issues: allIssues };

  const index = createCourseIndex(courseMap, lessons.flatMap((lesson) => (lesson.unit ? [lesson.unit] : [])));
  return { ok: true, courseMap, index, issues: allIssues };
}

/** 一行一個 issue，與驗證 CLI 的輸出格式一致。 */
export function formatIssue(issue: Issue): string {
  return [issue.level.padEnd(7), issue.code, issue.unitId ?? "-", issue.message].join("\t");
}

/** build 用：有 error 時丟出例外並列出全部 issues，否則回傳可用的課程查詢物件。 */
export function loadValidContent(root: string): { courseMap: CourseMap; index: CourseIndex } {
  const loaded = loadContent(root);
  if (!loaded.ok) throw new Error(`內容有誤，build 中止：\n${loaded.issues.map(formatIssue).join("\n")}`);
  return loaded;
}
