import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Issue, Unit } from "./course-map-model.ts";
import { lessonIssue } from "./lesson-issue.ts";
import type { ImportStatement, ParsedLesson } from "./lesson-parse.ts";

/** 閱讀頁提供的元件（06／07 票實作），教材不必 import。 */
const BUILT_IN_COMPONENTS = new Set(["Answer", "Figure", "Misconception", "SkipCheck", "ParentNote", "Activity"]);

/** 站內共用教具的目錄（結尾帶分隔符）；教材以 `@figures/<元件名>.astro` 別名 import（tsconfig 的 paths）。 */
const SITE_FIGURES_DIR = fileURLToPath(new URL("../components/figures/", import.meta.url));
const SITE_FIGURE_ALIAS = /^@figures\/([^/\\]+)\.astro$/;
const SAME_DIR_FIGURE = /^\.\/[^/\\]+Figure\.astro$/;
const PASCAL_CASE = /^[A-Z][A-Za-z0-9]*$/;

/**
 * 合法的教具 import：只有預設 import、區域名稱是 PascalCase 且不蓋掉內建元件，並且來源是下列其一：
 * - 同目錄的一次性教具 `./XxxFigure.astro`，名稱必須以 Figure 結尾；
 * - 站內共用教具 `@figures/Xxx.astro`，名稱必須沿用元件原名（如 `NumberLine`）。
 * 用相對路徑匯入共用教具不合格：寫法會隨教材所在深度改變，正式內容與 fixture 無法共用範例。
 */
function isFigureImport(statement: ImportStatement): boolean {
  const [specifier, ...rest] = statement.specifiers;
  if (!specifier || rest.length > 0 || specifier.kind !== "default") return false;
  const { local } = specifier;
  if (!PASCAL_CASE.test(local) || BUILT_IN_COMPONENTS.has(local)) return false;
  const { source } = statement;
  if (SAME_DIR_FIGURE.test(source)) return local.endsWith("Figure");
  return SITE_FIGURE_ALIAS.exec(source)?.[1] === local;
}

/** import 來源對應的教具檔絕對路徑。 */
function figureFile(lesson: ParsedLesson, source: string): string {
  const alias = SITE_FIGURE_ALIAS.exec(source);
  return alias ? join(SITE_FIGURES_DIR, `${alias[1]}.astro`) : resolve(dirname(lesson.file), source);
}

/** 教材合法 import 的教具檔（絕對路徑）；教具規則用它找出教具檔屬於哪個單元。 */
export function importedFigureFiles(lesson: ParsedLesson): string[] {
  return lesson.imports.filter(isFigureImport).map((st) => figureFile(lesson, st.source));
}

/** 訊息用的 import 摘要：區域名稱與來源，例如 `NL from "@figures/NumberLine.astro"`。 */
function importLabel({ specifiers, source }: ImportStatement): string {
  const names = specifiers.map((s) => s.local).join(", ");
  return names ? `${names} from ${JSON.stringify(source)}` : JSON.stringify(source);
}

/** MDX 元件白名單、教具 import 規則、`<Misconception>` 的分隔線數量，以及親子篇不得使用 `<SkipCheck>`。 */
export function componentIssues(lesson: ParsedLesson, unit: Unit | undefined): Issue[] {
  const { path, unit: unitId } = lesson;
  const issues: Issue[] = [];
  const figureLocals = new Set<string>();
  for (const statement of lesson.imports) {
    if (isFigureImport(statement)) {
      figureLocals.add(statement.specifiers[0]!.local);
      continue;
    }
    issues.push(
      lessonIssue(
        "lesson-import-forbidden",
        `教材 ${path} 的 import ${importLabel(statement)} 不允許：只能預設 import 教具元件，來源須是同目錄的 ./*Figure.astro（名稱以 Figure 結尾）或 @figures/<元件名>.astro（沿用元件原名）`,
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
  // 元件渲染時以渲染後的 <hr> 切成兩半，所以分隔線必須恰好一條、位在直接子層，不得巢狀。
  for (const { direct, nested } of lesson.misconceptionBreaks) {
    if (direct === 1 && nested === 0) continue;
    const detail = nested > 0 ? `直接子層有 ${direct} 條，另有 ${nested} 條巢狀在引用或清單裡（不得巢狀）` : `目前有 ${direct} 條`;
    issues.push(
      lessonIssue(
        "lesson-misconception-shape",
        `教材 ${path} 的 <Misconception> 內必須恰有一條分隔線（---）分開錯誤範例與正確範例，${detail}`,
        unitId,
      ),
    );
  }
  return issues;
}
