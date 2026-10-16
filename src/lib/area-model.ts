/** 面積模型教具的參數驗證與版面計算。純函式，不依賴 Astro；元件只負責把結果畫成 SVG。 */
import { decimalText } from "./number-line-scale.ts";
import { mul, parseRational } from "./rational.ts";
import { textWidthAt } from "./stacked-fraction.ts";

/** 一段邊長：正數（整數或小數）依比例畫；字母式字串（如 "x"、"2a"）用固定的示意長度畫 */
export type AreaSegmentInput = number | string;

export interface AreaModelInput {
  /** 橫邊拆成的幾段，1 到 3 段，由左往右 */
  cols: AreaSegmentInput[];
  /** 縱邊拆成的幾段，1 到 3 段，由上往下 */
  rows: AreaSegmentInput[];
  /** 含字母的格的面積字串，areas[列][行]；含字母的格必須給，兩邊都是數字的格一律寫 null（由元件算，不能覆寫） */
  areas?: (string | null | undefined)[][];
  /** 兩邊都是數字的格寫什麼：`"product"`（預設）是乘積，`"expression"` 是「橫邊 × 縱邊」的算式，兩者都由元件產生 */
  cellText?: "product" | "expression";
  /** 要強調的那一列（0 起算）：這一列的格加粗框並淡淡塗色 */
  highlightRow?: number;
}

export interface AreaModelSegment {
  /** 圖上標在邊上的文字 */
  label: string;
  kind: "number" | "letter";
  /** 沿這條邊的起點（viewBox 單位） */
  start: number;
  /** 這一段的長度（viewBox 單位） */
  size: number;
  /** 邊上文字的錨點（橫邊水平置中、縱邊靠右，對齊由元件的樣式決定） */
  labelX: number;
  labelY: number;
}

export interface AreaModelCell {
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** 格內的面積文字 */
  area: string;
  /** 面積文字的錨點（水平置中） */
  textX: number;
  textY: number;
  highlighted: boolean;
}

export interface AreaModelLayout {
  /** viewBox 寬高 */
  width: number;
  height: number;
  cols: AreaModelSegment[];
  rows: AreaModelSegment[];
  /** 依列、行排序 */
  cells: AreaModelCell[];
  /** 有任何字母段時為 true：字母段的長度只是示意，<desc> 必須寫明不按比例 */
  schematic: boolean;
}

export interface TextRun {
  text: string;
  /** 英文字母用斜體 */
  italic: boolean;
}

const SUBJECT = "<AreaModel>";
const MAX_SEGMENTS = 3;
const MAX_CELLS = 4;

// 版面（viewBox 單位）：寬 480，左緣留給縱邊的數字，上緣留給橫邊的數字
const WIDTH = 480;
const LEFT = 56;
const TOP = 36;
const GRID_W = 400;
const BOTTOM = 12;
/** 縱邊全是數字段時的格高；有字母段的縱邊用實際段長加總 */
const GRID_H = { 1: 110, 2: 190, 3: 240 } as const;
const MIN_W = 56;
const MIN_H = 48;
/** 字母段不依比例，一律用固定的示意長度 */
const LETTER_W = 120;
const LETTER_H = 70;
/** 邊長文字離格子的距離：橫邊文字的基線在格子上緣之上，縱邊文字靠右停在格子左緣之左 */
const LABEL_GAP = 10;
/** 22px 的數字基線之上約 15、之下約 0；基線往下移這麼多，文字的視覺中心才落在格子的垂直中心 */
const BASELINE_SHIFT = 7;
/** 格內文字左右各留的空隙，免得字貼著格線 */
const TEXT_PAD = 4;
const TEXT_FONT = 22;

const LETTER_SEGMENT = /^(?:\d+(?:\.\d+)?)?[a-z]+$/;

type ParsedSegment = { label: string; kind: "number" | "letter"; value: number };

function parseSegments(name: "cols" | "rows", raw: unknown): ParsedSegment[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_SEGMENTS) {
    const count = Array.isArray(raw) ? `目前有 ${raw.length} 段` : `目前是 ${JSON.stringify(raw)}`;
    throw new Error(`${SUBJECT} 的 ${name} 必須是 1 到 ${MAX_SEGMENTS} 段的陣列，${count}`);
  }
  return raw.map((seg: unknown, i) => {
    const where = `${SUBJECT} 的 ${name}[${i}]`;
    if (typeof seg === "number") {
      if (!Number.isFinite(seg) || seg <= 0) throw new Error(`${where} 的長度必須是正數，不接受零或負數，目前是 ${seg}`);
      const label = decimalText(parseRational(seg, where));
      if (label === undefined) throw new Error(`${where} 的位數太多，無法寫成小數，目前是 ${seg}`);
      return { label, kind: "number" as const, value: seg };
    }
    if (typeof seg === "string") {
      const text = seg.trim();
      if (text === "") throw new Error(`${where} 不能是空字串，請寫正數或字母式（如 "x"、"2a"）`);
      if (!LETTER_SEGMENT.test(text)) throw new Error(`${where} 的字串必須是小寫英文字母式（如 "x"、"2a"），目前是 ${JSON.stringify(seg)}`);
      return { label: text, kind: "letter" as const, value: 0 };
    }
    throw new Error(`${where} 必須是正數或字母式字串（如 "x"、"2a"），目前是 ${JSON.stringify(seg)}`);
  });
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** 依比例切開 avail，太窄的段先固定在下限，剩下的再按比例分 */
function split(values: number[], avail: number, min: number): number[] {
  const sizes = values.map(() => 0);
  let free = values.map((_, i) => i);
  let left = avail;
  for (;;) {
    const total = free.reduce((s, i) => s + values[i]!, 0);
    const small = free.filter((i) => (values[i]! / total) * left < min);
    if (small.length === 0) {
      free.forEach((i) => (sizes[i] = (values[i]! / total) * left));
      return sizes;
    }
    small.forEach((i) => (sizes[i] = min));
    left -= small.length * min;
    free = free.filter((i) => !small.includes(i));
    if (free.length === 0) return sizes;
  }
}

/** 字母段取固定的示意長度，數字段依比例分剩下的長度；全是字母段時總長就是各段示意長度的和，不填滿 avail */
function layoutEdge(segs: ParsedSegment[], avail: number, letterSize: number, min: number): number[] {
  const numeric = segs.map((_, i) => i).filter((i) => segs[i]!.kind === "number");
  const rest = avail - (segs.length - numeric.length) * letterSize;
  const shares = numeric.length > 0 ? split(numeric.map((i) => segs[i]!.value), rest, min) : [];
  return segs.map((s, i) => (s.kind === "letter" ? letterSize : shares[numeric.indexOf(i)]!));
}

function checkAreas(raw: unknown, rowCount: number, colCount: number): (string | null)[][] {
  if (raw === undefined) return Array.from({ length: rowCount }, () => Array<string | null>(colCount).fill(null));
  const shape = `${rowCount} 列 × ${colCount} 行`;
  if (!Array.isArray(raw) || raw.length !== rowCount) {
    throw new Error(`${SUBJECT} 的 areas 必須是 ${rowCount} 列的陣列（areas[列][行]），不給的格寫 null`);
  }
  return raw.map((line: unknown, r) => {
    if (!Array.isArray(line) || line.length !== colCount) {
      throw new Error(`${SUBJECT} 的 areas[${r}] 必須有 ${colCount} 格，對應 ${shape}的每一行，不給的格寫 null`);
    }
    return line.map((cell: unknown, c) => {
      if (cell === undefined || cell === null) return null;
      if (typeof cell !== "string" || cell.trim() === "") {
        throw new Error(`${SUBJECT} 的 areas[${r}][${c}] 必須是非空字串或 null，目前是 ${JSON.stringify(cell)}`);
      }
      return cell.trim();
    });
  });
}

/** 兩個數字邊長的乘積，走精確有理數，0.1 × 0.2 是 0.02 而不是 0.020000000000000004 */
function productText(a: number, b: number, where: string): string {
  const text = decimalText(mul(parseRational(a, SUBJECT), parseRational(b, SUBJECT)));
  if (text === undefined) throw new Error(`${where}的面積位數太多，無法寫成小數，請改用較短的邊長`);
  return text;
}

/** 驗證面積模型的參數並算出版面；任何不合規則的參數都丟出中文錯誤。 */
export function resolveAreaModel(input: AreaModelInput): AreaModelLayout {
  const colSegs = parseSegments("cols", input.cols);
  const rowSegs = parseSegments("rows", input.rows);
  const cellCount = colSegs.length * rowSegs.length;
  if (cellCount > MAX_CELLS) {
    throw new Error(`${SUBJECT} 的格數最多 ${MAX_CELLS} 格，橫 ${colSegs.length} 段 × 縱 ${rowSegs.length} 段共 ${cellCount} 格，請拆成兩張圖`);
  }
  const { highlightRow } = input;
  if (highlightRow !== undefined && !(Number.isInteger(highlightRow) && highlightRow >= 0 && highlightRow < rowSegs.length)) {
    throw new Error(`${SUBJECT} 的 highlightRow 必須是 0 到 ${rowSegs.length - 1} 的整數（rows 有 ${rowSegs.length} 段），目前是 ${JSON.stringify(highlightRow)}`);
  }
  const cellText = input.cellText ?? "product";
  if (cellText !== "product" && cellText !== "expression") {
    throw new Error(`${SUBJECT} 的 cellText 必須是 "product" 或 "expression"，目前是 ${JSON.stringify(cellText)}`);
  }
  const areas = checkAreas(input.areas, rowSegs.length, colSegs.length);

  // 橫邊：有數字段時填滿 GRID_W；全是字母段時總長較短，置中在版面裡
  const colSizes = layoutEdge(colSegs, GRID_W, LETTER_W, MIN_W);
  const gridLeft = LEFT + (GRID_W - sum(colSizes)) / 2;
  // 縱邊：全是字母段時高度是各段示意長度的和，圖高跟著變，不留空白；其餘用固定格高
  const allLetterRows = rowSegs.every((s) => s.kind === "letter");
  const rowSizes = layoutEdge(rowSegs, allLetterRows ? rowSegs.length * LETTER_H : GRID_H[rowSegs.length as 1 | 2 | 3], LETTER_H, MIN_H);

  let x = gridLeft;
  const cols: AreaModelSegment[] = colSegs.map((s, i) => {
    const seg = { label: s.label, kind: s.kind, start: x, size: colSizes[i]!, labelX: x + colSizes[i]! / 2, labelY: TOP - LABEL_GAP };
    x += colSizes[i]!;
    return seg;
  });
  let y = TOP;
  const rows: AreaModelSegment[] = rowSegs.map((s, i) => {
    const seg = { label: s.label, kind: s.kind, start: y, size: rowSizes[i]!, labelX: gridLeft - LABEL_GAP, labelY: y + rowSizes[i]! / 2 + BASELINE_SHIFT };
    y += rowSizes[i]!;
    return seg;
  });

  const cells = rowSegs.flatMap((rs, r) =>
    colSegs.map((cs, c): AreaModelCell => {
      const where = `${SUBJECT} 第 ${r + 1} 列第 ${c + 1} 行`;
      const given = areas[r]![c]!;
      let area: string;
      if (rs.kind === "number" && cs.kind === "number") {
        if (given !== null) {
          throw new Error(`${where}的格兩邊都是數字，面積由元件自動算，不能在 areas[${r}][${c}] 給字串（要寫成算式請用 cellText="expression"）`);
        }
        area = cellText === "expression" ? `${cs.label} × ${rs.label}` : productText(rs.value, cs.value, where);
      } else {
        if (given === null) throw new Error(`${where}的格含字母，必須在 areas[${r}][${c}] 給面積字串（如 "3x"）`);
        area = given;
      }
      const col = cols[c]!;
      const row = rows[r]!;
      const usable = col.size - 2 * TEXT_PAD;
      const width = textWidthAt(area, TEXT_FONT);
      if (width > usable) {
        throw new Error(`${where}的面積文字「${area}」太寬，估計寬 ${Math.round(width)}，超過格內可用寬度 ${Math.round(usable)}，請縮短文字或把圖拆開`);
      }
      return {
        row: r,
        col: c,
        x: col.start,
        y: row.start,
        w: col.size,
        h: row.size,
        area,
        textX: col.start + col.size / 2,
        textY: row.start + row.size / 2 + BASELINE_SHIFT,
        highlighted: r === highlightRow,
      };
    }),
  );

  return {
    width: WIDTH,
    height: TOP + sum(rowSizes) + BOTTOM,
    cols,
    rows,
    cells,
    schematic: [...colSegs, ...rowSegs].some((s) => s.kind === "letter"),
  };
}

/** 有字母段時，<desc> 必須寫明不按比例，否則丟中文錯誤。 */
export function assertSchematicDesc(model: AreaModelLayout, desc: string): void {
  if (model.schematic && !desc.includes("不按比例")) {
    throw new Error(`${SUBJECT} 含字母段，字母段的長度只是示意，desc 必須寫明「不按比例」`);
  }
}

/** 把文字切成英文字母與其餘的片段；字母片段用斜體畫，數字與符號維持正體。 */
export function textRuns(text: string): TextRun[] {
  return text
    .split(/([A-Za-z]+)/)
    .filter((part) => part !== "")
    .map((part) => ({ text: part, italic: /^[A-Za-z]+$/.test(part) }));
}
