import type { Issue } from "./course-map-model.ts";
import { lessonIssue } from "./lesson-issue.ts";

/** 要檢查不等號的一份文字：課程地圖、教材 MDX 或教具。`unitOf` 依行號（1 起算）回報這行屬於哪個單元。 */
export interface NotationSource {
  path: string;
  text: string;
  unitOf: (line: number) => string | undefined;
}

/** KaTeX 的雙線與 `\geq`、`\leq` 都改寫成 `\ge`、`\le`（ADR 0006）；後面不能接字母，`\geq` 才不會誤中 `\geqq`、`\geqslant` */
const KATEX = [
  { pattern: /\\geqq(?![a-zA-Z])/, found: "\\geqq", use: "\\ge" },
  { pattern: /\\leqq(?![a-zA-Z])/, found: "\\leqq", use: "\\le" },
  { pattern: /\\geq(?![a-zA-Z])/, found: "\\geq", use: "\\ge" },
  { pattern: /\\leq(?![a-zA-Z])/, found: "\\leq", use: "\\le" },
];
const CHARS = [
  { found: "≧", use: "≥" },
  { found: "≦", use: "≤" },
];
/** 一元一次不等式那一句說明，唯一可以寫雙線字元的地方；只拿掉這句本身，同一段的其他文字照常檢查 */
const NOTE = "有些國中課本寫成 ≧、≦";

/** 全站不等號一律用 ≤ ≥：KaTeX 的 `\geqq`、`\leqq`、`\geq`、`\leq` 與 ≧ ≦ 字元都回報，只放行那一句說明。 */
export function inequalitySignIssues(sources: NotationSource[]): Issue[] {
  return sources.flatMap(({ path, text, unitOf }) =>
    text.split("\n").flatMap((line, i) => {
      const at = `${path} 第 ${i + 1} 行`;
      const unit = unitOf(i + 1);
      const katex = KATEX.filter(({ pattern }) => pattern.test(line)).map(({ found, use }) =>
        lessonIssue("notation-inequality-sign", `${at} 用了 \`${found}\`，不等號一律寫 \`${use}\`（見 ADR 0006）`, unit),
      );
      const checked = line.replaceAll(NOTE, "");
      const chars = CHARS.filter(({ found }) => checked.includes(found)).map(({ found, use }) =>
        lessonIssue("notation-inequality-sign", `${at} 用了「${found}」，不等號一律寫「${use}」（見 ADR 0006）`, unit),
      );
      return [...katex, ...chars];
    }),
  );
}

/** 課程地圖 YAML 每一行屬於哪個單元：往上找最近的 `- id:`。階段的 `- id:` 在第 0 欄、單元的有縮排，所以階段層級的行回報 undefined。 */
export function courseMapUnitOf(text: string): (line: number) => string | undefined {
  const owners: (string | undefined)[] = [];
  let current: string | undefined;
  for (const line of text.split("\n")) {
    const m = line.match(/^(\s*)- id:\s*(\S+)/);
    if (m) current = m[1].length === 0 ? undefined : m[2];
    owners.push(current);
  }
  return (line) => owners[line - 1];
}
