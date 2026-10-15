import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Issue, Unit } from "./course-map-model.ts";
import { lessonIssue } from "./lesson-issue.ts";
import type { ImportStatement, ParsedLesson } from "./lesson-parse.ts";

/** 閱讀頁提供的元件（06／07 票實作），教材不必 import。 */
const BUILT_IN_COMPONENTS = new Set(["Answer", "Figure", "Misconception", "SkipCheck", "ParentNote", "Activity"]);

/** 站內共用教具的目錄（結尾帶分隔符，直接做前綴比對）；教材以相對路徑 import 這個目錄下的 .astro。 */
const SITE_FIGURES_DIR = fileURLToPath(new URL("../components/figures/", import.meta.url));
const SAME_DIR_FIGURE = /^\.\/[^/\\]+Figure\.astro$/;
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;

/**
 * 合法的教具 import：只有預設 import、區域名稱是 PascalCase 且不蓋掉內建元件，並且來源是下列其一：
 * - 同目錄的一次性教具 `./XxxFigure.astro`，名稱必須以 Figure 結尾；
 * - 站內共用教具：相對路徑解析後落在 `src/components/figures/` 下的 .astro，用原名 import（如 `NumberLine`）。
 */
function isFigureImport(lesson: ParsedLesson, statement: ImportStatement): boolean {
  const [specifier, ...rest] = statement.specifiers;
  if (!specifier || rest.length > 0 || specifier.kind !== "default") return false;
  const { local } = specifier;
  if (!PASCAL_CASE.test(local) || BUILT_IN_COMPONENTS.has(local)) return false;
  const { source } = statement;
  if (SAME_DIR_FIGURE.test(source)) return local.endsWith("Figure");
  return source.startsWith(".") && source.endsWith(".astro") && resolve(dirname(lesson.file), source).startsWith(SITE_FIGURES_DIR);
}

/** 教材合法 import 的教具檔（絕對路徑）；教具規則用它找出教具檔屬於哪個單元。 */
export function importedFigureFiles(lesson: ParsedLesson): string[] {
  return lesson.imports.filter((st) => isFigureImport(lesson, st)).map((st) => resolve(dirname(lesson.file), st.source));
}

/** MDX 元件白名單、教具 import 規則，以及親子篇不得使用 `<SkipCheck>`。 */
export function componentIssues(lesson: ParsedLesson, unit: Unit | undefined): Issue[] {
  const { path, unit: unitId } = lesson;
  const issues: Issue[] = [];
  const figureLocals = new Set<string>();
  for (const statement of lesson.imports) {
    if (isFigureImport(lesson, statement)) {
      figureLocals.add(statement.specifiers[0]!.local);
      continue;
    }
    issues.push(
      lessonIssue(
        "lesson-import-forbidden",
        `教材 ${path} 的 import ${JSON.stringify(statement.source)} 不允許：只能預設 import 教具元件，來源須是同目錄的 ./*Figure.astro（名稱以 Figure 結尾）或 src/components/figures/ 下的 .astro（PascalCase 原名）`,
        unitId,
      ),
    );
  }
  if (lesson.exportCount > 0) issues.push(lessonIssue("lesson-export-forbidden", `教材 ${path} 不允許 export`, unitId));
  for (const name of new Set(lesson.jsxNames)) {
    if (BUILT_IN_COMPONENTS.has(name) || figureLocals.has(name)) continue;
    issues.push(
      lessonIssue(
        "lesson-component-forbidden",
        `教材 ${path} 使用了不允許的元件 <${name}>（只允許 ${[...BUILT_IN_COMPONENTS].join("、")} 與合法 import 的教具元件）`,
        unitId,
      ),
    );
  }
  if (unit?.family && lesson.jsxNames.includes("SkipCheck")) {
    issues.push(lessonIssue("lesson-skipcheck-in-family", `親子篇教材 ${path} 不得使用 <SkipCheck>`, unitId));
  }
  return issues;
}
