import { parseFrontmatter } from "@astrojs/markdown-remark";
import type { Root, RootContent } from "mdast";
import remarkMath from "remark-math";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { parse as parseYaml } from "yaml";

/** 解析過的一篇教材：frontmatter 與正文（已去掉 frontmatter）的結構摘要。 */
export interface ParsedLesson {
  /** 相對於內容根目錄的路徑，用於訊息 */
  path: string;
  /** 檔案的絕對路徑，用來解析相對 import */
  file: string;
  /** frontmatter 的 `unit`；缺漏或不是字串時為 undefined */
  unit: string | undefined;
  frontmatter: Record<string, unknown>;
  /** 全部 H2 的文字，依出現順序 */
  h2: string[];
  /** 每個 JSX 元素的名稱，依出現順序（`<>` fragment 為空字串，`<A.B>` 為 "A.B"） */
  jsxNames: string[];
  imports: ImportStatement[];
  /** 每個 `<Misconception>` 的分隔線（`---`）數量，依出現順序：`direct` 是直接子層，`nested` 是更深層（如引用、清單裡） */
  misconceptionBreaks: { direct: number; nested: number }[];
  /** `export` 語句的數量（教材不允許） */
  exportCount: number;
  /** 計算篇幅用的文字片段：文字節點與行內程式碼，不含 `<Answer>` 內的解析、數學式與 import */
  prose: string[];
}

export interface ImportStatement {
  source: string;
  specifiers: { kind: "default" | "named" | "namespace"; local: string }[];
}

/** remark-mdx 附在 ESM 節點上的 estree 中，本檔用得到的部分。 */
interface EstreeStatement {
  type: string;
  source?: { value: unknown };
  specifiers?: { type: string; local: { name: string } }[];
}

// remark-math 讓 `$…$` 與 `$$…$$` 成為數學節點，不會被當成文字；remark-mdx 負責 JSX 與 import。
const processor = unified().use(remarkParse).use(remarkMath).use(remarkMdx);

type AnyNode = RootContent | Root;

type JsxElement = Extract<AnyNode, { type: "mdxJsxFlowElement" | "mdxJsxTextElement" }>;

function isJsxElement(node: AnyNode): node is JsxElement {
  return node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement";
}

function childrenOf(node: AnyNode): AnyNode[] {
  return "children" in node ? (node.children as AnyNode[]) : [];
}

/** 深度優先走訪（含自己），依文件順序。 */
function* walk(node: AnyNode): Generator<AnyNode> {
  yield node;
  for (const child of childrenOf(node)) yield* walk(child);
}

function countBreaks(element: JsxElement): { direct: number; nested: number } {
  const direct = element.children.filter((child) => child.type === "thematicBreak").length;
  const total = [...walk(element)].filter((node) => node.type === "thematicBreak").length;
  return { direct, nested: total - direct };
}

/** 正文的文字片段（文字節點與行內程式碼），略過 `<Answer>` 整棵子樹；數學式與 ESM 本來就不是文字節點。 */
function proseOf(node: AnyNode): string[] {
  if (isJsxElement(node) && node.name === "Answer") return [];
  if (node.type === "text" || node.type === "inlineCode") return [node.value];
  return childrenOf(node).flatMap(proseOf);
}

/** 節點內所有文字節點與行內程式碼的字串，依序串起。 */
function textOf(node: AnyNode): string {
  if ("value" in node && (node.type === "text" || node.type === "inlineCode")) return node.value;
  return childrenOf(node).map(textOf).join("");
}

/**
 * 解析一篇教材。frontmatter 或 MDX 語法無法解析時帶檔案路徑重拋。
 * frontmatter 以 YAML 1.2 解析（日期保持字串），才能檢查 `2026-13-45` 這類不存在的日期。
 */
export function parseLesson(path: string, file: string, text: string): ParsedLesson {
  let frontmatter: Record<string, unknown>;
  let body: string;
  try {
    const parsed = parseFrontmatter(text);
    body = parsed.content;
    const yaml: unknown = parseYaml(parsed.rawFrontmatter);
    frontmatter = typeof yaml === "object" && yaml !== null && !Array.isArray(yaml) ? (yaml as Record<string, unknown>) : {};
  } catch (e) {
    throw new Error(`教材 ${path} 的 frontmatter 無法解析：${(e as Error).message}`, { cause: e });
  }
  let tree: Root;
  try {
    tree = processor.parse(body);
  } catch (e) {
    throw new Error(`教材 ${path} 的 MDX 無法解析：${(e as Error).message}`, { cause: e });
  }
  const nodes = [...walk(tree)];
  const h2 = nodes.flatMap((node) => (node.type === "heading" && node.depth === 2 ? [textOf(node).trim()] : []));
  const jsxNames = nodes.flatMap((node) => (isJsxElement(node) ? [node.name ?? ""] : []));
  const statements = nodes.flatMap((node) => (node.type === "mdxjsEsm" ? ((node.data?.estree?.body ?? []) as EstreeStatement[]) : []));
  const imports = statements.flatMap((st) => (st.type === "ImportDeclaration" ? [toImport(st)] : []));
  const misconceptionBreaks = nodes.flatMap((node) =>
    isJsxElement(node) && node.name === "Misconception" ? [countBreaks(node)] : [],
  );
  const exportCount = statements.filter((st) => st.type.startsWith("Export")).length;
  return { path, file, unit: typeof frontmatter.unit === "string" ? frontmatter.unit : undefined, frontmatter, h2, jsxNames, imports, misconceptionBreaks, exportCount, prose: proseOf(tree) };
}

const SPECIFIER_KIND = { ImportDefaultSpecifier: "default", ImportNamespaceSpecifier: "namespace" } as const;

function toImport(statement: EstreeStatement): ImportStatement {
  return {
    source: String(statement.source?.value),
    specifiers: (statement.specifiers ?? []).map((sp) => ({
      kind: SPECIFIER_KIND[sp.type as keyof typeof SPECIFIER_KIND] ?? "named",
      local: sp.local.name,
    })),
  };
}
