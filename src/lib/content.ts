import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { checkCourseMap, createCourseIndex } from "./course-map.ts";
import type { CourseIndex, CourseMap, Issue, Unit } from "./course-map.ts";
import { allUnits } from "./course-map-model.ts";
import { figureIssues, figureUnits, type FigureSource } from "./figure-rules.ts";
import { courseMapUnitOf, inequalitySignIssues, type NotationSource } from "./inequality-signs.ts";
import { lessonIssue } from "./lesson-issue.ts";
import { parseLesson, type ParsedLesson } from "./lesson-parse.ts";
import { lessonRuleIssues } from "./lesson-rules.ts";

/** `ok` 為 true 表示沒有 error 等級的 issue（可能仍有 warning），此時課程地圖與查詢物件一定可用。 */
export type LoadedContent =
  | { ok: true; courseMap: CourseMap; index: CourseIndex; issues: Issue[] }
  | { ok: false; issues: Issue[] };

/** 目錄下（遞迴）檔名以 `suffix` 結尾的檔案，已排序；目錄不存在時回傳空陣列。 */
function listFiles(dir: string, suffix: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

/** 掃描並解析 `<root>/lessons/**\/*.mdx`，連同原文一起回傳（記法規則逐行檢查原文）。教材無法解析時帶檔案路徑丟出例外。 */
function scanLessons(root: string): { lesson: ParsedLesson; text: string }[] {
  return listFiles(join(root, "lessons"), ".mdx").map((file) => {
    const text = readFileSync(file, "utf8");
    return { lesson: parseLesson(relative(root, file), file, text), text };
  });
}

/** 讀入教材目錄中所有 `*Figure.astro` 教具檔。 */
function scanFigures(root: string): FigureSource[] {
  return listFiles(join(root, "lessons"), "Figure.astro").map((file) => ({
    path: relative(root, file),
    file,
    text: readFileSync(file, "utf8"),
  }));
}

/** 教材與課程地圖的對應檢查（每篇教材要有 unit、unit 要在地圖上、同一個 unit 只能有一篇），再加上單篇教材的規則。 */
function lessonIssues(lessons: ParsedLesson[], unitsById: Map<string, Unit>): Issue[] {
  const issues: Issue[] = [];
  const firstPathOf = new Map<string, string>();
  for (const { path, unit } of lessons) {
    if (unit === undefined) {
      issues.push(lessonIssue("lesson-unit-missing", `教材 ${path} 的 frontmatter 沒有 unit`));
    } else if (!unitsById.has(unit)) {
      issues.push(lessonIssue("lesson-unit-unknown", `教材 ${path} 的 unit「${unit}」不在課程地圖上`, unit));
    } else if (firstPathOf.has(unit)) {
      issues.push(lessonIssue("lesson-unit-duplicate", `單元「${unit}」有兩篇教材：${firstPathOf.get(unit)}、${path}`, unit));
    } else {
      firstPathOf.set(unit, path);
    }
  }
  // 對應問題排在前面，單篇教材規則（frontmatter、結構、元件、篇幅）接在後面。
  return [...issues, ...lessons.flatMap((lesson) => lessonRuleIssues(lesson, lesson.unit ? unitsById.get(lesson.unit) : undefined))];
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

  const scanned = scanLessons(root);
  const lessons = scanned.map(({ lesson }) => lesson);
  const figures = scanFigures(root);
  const unitOfFigure = figureUnits(lessons);
  const notationSources: NotationSource[] = [
    { path: "course-map.yaml", text, unitOf: courseMapUnitOf(text) },
    ...scanned.map(({ lesson, text: lessonText }) => ({ path: lesson.path, text: lessonText, unitOf: () => lesson.unit })),
    ...figures.map((figure) => ({ path: figure.path, text: figure.text, unitOf: () => unitOfFigure.get(resolve(figure.file)) })),
  ];
  const unitsById = new Map(allUnits(courseMap).map((unit) => [unit.id, unit]));
  const allIssues = [...issues, ...lessonIssues(lessons, unitsById), ...figureIssues(figures, lessons), ...inequalitySignIssues(notationSources)];
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
