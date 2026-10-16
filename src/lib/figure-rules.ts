import { resolve } from "node:path";
import { parse } from "@astrojs/compiler-rs";
import postcss from "postcss";
import type { Issue } from "./course-map-model.ts";
import { importedFigureFiles } from "./lesson-components.ts";
import { lessonIssue } from "./lesson-issue.ts";
import type { ParsedLesson } from "./lesson-parse.ts";

/** 已讀入的教具檔：`path` 供訊息，`file` 用來對應 import 它的教材。 */
export interface FigureSource {
  path: string;
  file: string;
  text: string;
}

/** SVG 顏色屬性；CSS 另外還檢查 background 與 border／outline 的顏色。 */
const COLOR_ATTRIBUTES = new Set(["fill", "stroke", "stop-color", "color", "flood-color", "lighting-color"]);
const COLOR_PROPERTIES = new Set([...COLOR_ATTRIBUTES, "background", "background-color", "border-color", "outline-color"]);
/** 顏色值的允許清單（ADR 0002：只用色票 token）；`url(#id)` 是漸層等的 id 參照，不是顏色。 */
const ALLOWED_COLOR_VALUE = /^(?:currentcolor|none|transparent|inherit|var\(\s*--[\w-]+\s*\)|url\(\s*#[\w-]+\s*\))$/i;
const HEX_COLOR_LITERAL = /^\s*#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\s*$/i;

/** compiler-rs 輸出的 ESTree 風格 JSON；只用到 JSXElement、JSXAttribute、JSXText、Literal。 */
interface AstNode {
  type: string;
  [key: string]: unknown;
}

function isNode(value: unknown): value is AstNode {
  return typeof value === "object" && value !== null && typeof (value as AstNode).type === "string";
}

function* walkAst(value: unknown): Generator<AstNode> {
  if (Array.isArray(value)) {
    for (const item of value) yield* walkAst(item);
  } else if (isNode(value)) {
    yield value;
    for (const child of Object.values(value)) yield* walkAst(child);
  }
}

function elementName(node: AstNode): string | undefined {
  const name = (node.openingElement as { name?: { type: string; name?: string } }).name;
  return name?.type === "JSXIdentifier" ? name.name : undefined;
}

function literalString(value: unknown): string | undefined {
  const literal = isNode(value) && value.type === "JSXExpressionContainer" ? value.expression : value;
  return isNode(literal) && literal.type === "Literal" && typeof literal.value === "string" ? literal.value : undefined;
}

/** 以 PostCSS 走訪 CSS（含巢狀規則與 @media）的每個宣告，回傳顏色屬性中不在允許清單的值。 */
function cssColorViolations(css: string, where: string, path: string): string[] {
  let root: postcss.Root;
  try {
    root = postcss.parse(css);
  } catch (e) {
    throw new Error(`教具 ${path} 的 ${where} 無法解析：${(e as Error).message}`, { cause: e });
  }
  const violations: string[] = [];
  root.walkDecls((decl) => {
    const value = decl.value.trim();
    if (COLOR_PROPERTIES.has(decl.prop.toLowerCase()) && !ALLOWED_COLOR_VALUE.test(value)) violations.push(`${decl.prop}: ${value}`);
  });
  return violations;
}

/** 解析單一教具檔，回傳該檔的全部問題（缺 title／desc、顏色不在色票內）。 */
function figureProblems({ path, text }: FigureSource): { code: Issue["code"]; message: string }[] {
  const { ast, diagnostics } = parse(text);
  const parseError = diagnostics.find((d) => d.severity === "error");
  if (parseError) throw new Error(`教具 ${path} 無法解析：${parseError.text}`);

  const problems: { code: Issue["code"]; message: string }[] = [];
  const notToken = (where: string, value: string) =>
    problems.push({
      code: "figure-color-not-token",
      message: `教具 ${path} 的 ${where} 顏色值 ${value} 不在色票內；只能用 currentColor、none、transparent、inherit、var(--token) 或 url(#id)`,
    });

  // frontmatter script 裡的 hex 色碼字串常值（例如 const c = "#f00"），否則可以經由屬性表達式繞過下面的檢查。
  for (const node of walkAst(ast.frontmatter)) {
    if (node.type === "Literal" && typeof node.value === "string" && HEX_COLOR_LITERAL.test(node.value)) notToken("script 常值", node.value);
  }

  let svgCount = 0;
  for (const node of walkAst(ast.body)) {
    if (node.type === "JSXAttribute") {
      const attr = node as unknown as { name: { name?: string }; value: unknown };
      const value = literalString(attr.value);
      if (value === undefined || !attr.name.name) continue;
      if (COLOR_ATTRIBUTES.has(attr.name.name) && !ALLOWED_COLOR_VALUE.test(value.trim())) {
        notToken(`${attr.name.name} 屬性`, value);
      } else if (attr.name.name === "style") {
        for (const violation of cssColorViolations(value, "行內 style", path)) notToken("行內 style", violation);
      }
      continue;
    }
    if (node.type !== "JSXElement") continue;
    const name = elementName(node);
    if (name === "style") {
      const css = (node.children as AstNode[]).map((child) => (child.type === "JSXText" ? String(child.value) : "")).join("");
      for (const violation of cssColorViolations(css, "<style>", path)) notToken("<style>", violation);
    } else if (name === "svg") {
      svgCount += 1;
      const inner = [...walkAst(node.children)].filter((n) => n.type === "JSXElement").map(elementName);
      for (const required of ["title", "desc"] as const) {
        if (!inner.includes(required)) {
          problems.push({ code: `figure-${required}-missing`, message: `教具 ${path} 的第 ${svgCount} 個 <svg> 缺少 <${required}>` });
        }
      }
    }
  }
  return problems;
}

/** 教具檔（絕對路徑）對應的單元：取第一篇 import 它的教材。教具規則與記法規則共用。 */
export function figureUnits(lessons: ParsedLesson[]): Map<string, string> {
  const unitOfFigure = new Map<string, string>();
  for (const lesson of lessons) {
    for (const file of importedFigureFiles(lesson)) {
      if (lesson.unit && !unitOfFigure.has(file)) unitOfFigure.set(file, lesson.unit);
    }
  }
  return unitOfFigure;
}

/** 教具規則：每個 `<svg>` 有 `<title>` 與 `<desc>`，顏色只用色票 token。unitId 取自 import 該教具的教材。 */
export function figureIssues(figures: FigureSource[], lessons: ParsedLesson[]): Issue[] {
  const unitOfFigure = figureUnits(lessons);
  return figures.flatMap((figure) =>
    figureProblems(figure).map(({ code, message }) => lessonIssue(code, message, unitOfFigure.get(resolve(figure.file)))),
  );
}
