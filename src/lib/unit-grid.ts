/** 單位方格教具的參數驗證與外框計算。純函式，不依賴 Astro；元件只負責把結果畫成 SVG。 */

export type LabelSide = "top" | "bottom" | "left" | "right";

export interface UnitGridRect {
  /** 左上角所在的列，0 起算、由上往下 */
  row: number;
  /** 左上角所在的行，0 起算、由左往右 */
  col: number;
  /** 往下幾列，1 以上 */
  rows: number;
  /** 往右幾行，1 以上 */
  cols: number;
}

export interface UnitGridLabelInput {
  side: LabelSide;
  /** 整數是邊上的格數（視同刻度數字）；字串是文字標籤，1 到 3 個字 */
  text: string | number;
}

export interface UnitGridInput {
  /** 列數，1 到 12 的整數 */
  rows: number;
  /** 行數，1 到 10 的整數 */
  cols: number;
  /** 塗色的長方形區域 */
  rects?: UnitGridRect[];
  /** 逐格塗色，每格 [row, col]（0 起算） */
  cells?: [number, number][];
  /** 是否沿塗色區的實際邊界描主線外框，表示周長 */
  perimeter?: boolean;
  /** 邊上的標籤，每邊最多一個 */
  labels?: UnitGridLabelInput[];
}

/** 格線交點座標的線段：x 是行方向、y 是列方向，起點不大於終點 */
export interface OutlineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface UnitGridOutline {
  /** 同一直線上相連的單位邊合併後的線段 */
  segments: OutlineSegment[];
  /** 外框的單位邊數，也就是周長格數 */
  length: number;
}

export interface UnitGridLabel {
  side: LabelSide;
  kind: "count" | "text";
  text: string;
}

export interface UnitGridCell {
  row: number;
  col: number;
  shaded: boolean;
}

export interface UnitGrid {
  rows: number;
  cols: number;
  /** 整張方格的每一格，依列、行排序，帶是否塗色 */
  cells: UnitGridCell[];
  /** 塗色區的外接範圍（格線座標）；沒有塗色時是整個方格。標籤置中在這個範圍的邊上 */
  bounds: { row0: number; col0: number; row1: number; col1: number };
  outline: UnitGridOutline | undefined;
  labels: UnitGridLabel[];
}

const MAX_ROWS = 12;
const MAX_COLS = 10;
const MAX_TEXT_LABELS = 3;
const MAX_COUNT = 99;
const MAX_TEXT_CHARS = 3;
const SIDES: readonly string[] = ["top", "bottom", "left", "right"];

const SUBJECT = "<UnitGrid>";

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

function checkSize(name: "rows" | "cols", value: unknown, max: number): number {
  if (!isInt(value) || value < 1 || value > max) {
    throw new Error(`${SUBJECT} 的 ${name} 必須是 1 到 ${max} 的整數，目前是 ${JSON.stringify(value)}`);
  }
  return value;
}

function collectCells(rows: number, cols: number, rects: UnitGridRect[], cells: [number, number][]): UnitGridCell[] {
  const range = `${rows} 列 × ${cols} 行的方格範圍`;
  const painted = new Set<number>();
  rects.forEach((rect, i) => {
    const { row, col, rows: h, cols: w } = rect ?? ({} as UnitGridRect);
    if (!isInt(row) || !isInt(col) || !isInt(h) || !isInt(w) || row < 0 || col < 0 || h < 1 || w < 1) {
      throw new Error(`${SUBJECT} 的 rects[${i}] 必須是 { row, col, rows, cols }：row、col 是 0 以上的整數，rows、cols 是 1 以上的整數`);
    }
    if (row + h > rows || col + w > cols) throw new Error(`${SUBJECT} 的 rects[${i}] 超出 ${range}`);
    for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) painted.add(r * cols + c);
  });
  cells.forEach((cell, i) => {
    if (!Array.isArray(cell) || cell.length !== 2 || !isInt(cell[0]) || !isInt(cell[1])) {
      throw new Error(`${SUBJECT} 的 cells[${i}] 必須是 [row, col] 兩個整數`);
    }
    const [r, c] = cell;
    if (r < 0 || r >= rows || c < 0 || c >= cols) throw new Error(`${SUBJECT} 的 cells[${i}]（第 ${r} 列、第 ${c} 行）超出 ${range}`);
    painted.add(r * cols + c);
  });
  return Array.from({ length: rows * cols }, (_, k) => ({ row: Math.floor(k / cols), col: k % cols, shaded: painted.has(k) }));
}

/** 沿塗色區的實際邊界：塗色格與「沒塗或方格外」相鄰的每條單位邊，再把同一直線上相連的合併 */
function computeOutline(grid: UnitGridCell[], rows: number, cols: number): UnitGridOutline {
  const has = (r: number, c: number) => r >= 0 && r < rows && c >= 0 && c < cols && grid[r * cols + c]!.shaded;
  // 水平邊以 y（列線）分組、垂直邊以 x（行線）分組，各存沿線的起點座標
  const horizontal = new Map<number, number[]>();
  const vertical = new Map<number, number[]>();
  const add = (map: Map<number, number[]>, line: number, start: number) => map.set(line, [...(map.get(line) ?? []), start]);
  let length = 0;
  for (const { row: r, col: c, shaded } of grid) {
    if (!shaded) continue;
    if (!has(r - 1, c)) add(horizontal, r, c);
    if (!has(r + 1, c)) add(horizontal, r + 1, c);
    if (!has(r, c - 1)) add(vertical, c, r);
    if (!has(r, c + 1)) add(vertical, c + 1, r);
  }
  const segments: OutlineSegment[] = [];
  const merge = (map: Map<number, number[]>, make: (line: number, from: number, to: number) => OutlineSegment) => {
    for (const [line, starts] of [...map].sort((a, b) => a[0] - b[0])) {
      const sorted = [...starts].sort((a, b) => a - b);
      length += sorted.length;
      let from = sorted[0]!;
      let prev = from;
      for (const s of sorted.slice(1)) {
        if (s !== prev + 1) {
          segments.push(make(line, from, prev + 1));
          from = s;
        }
        prev = s;
      }
      segments.push(make(line, from, prev + 1));
    }
  };
  merge(horizontal, (y, x1, x2) => ({ x1, y1: y, x2, y2: y }));
  merge(vertical, (x, y1, y2) => ({ x1: x, y1, x2: x, y2 }));
  return { segments, length };
}

function resolveLabels(raw: UnitGridLabelInput[]): UnitGridLabel[] {
  const sideSeen = new Map<string, number>();
  const labels = raw.map((label, i): UnitGridLabel => {
    if (!label || !SIDES.includes(label.side)) {
      throw new Error(`${SUBJECT} 的 labels[${i}].side 必須是 "top"、"bottom"、"left" 或 "right"`);
    }
    const { text } = label;
    const isCount = isInt(text) && text >= 1 && text <= MAX_COUNT;
    const isText = typeof text === "string" && [...text.trim()].length >= 1 && [...text.trim()].length <= MAX_TEXT_CHARS;
    if (!isCount && !isText) {
      throw new Error(`${SUBJECT} 的 labels[${i}].text 必須是 1 到 ${MAX_COUNT} 的整數（格數）或 1 到 ${MAX_TEXT_CHARS} 個字的文字`);
    }
    const earlier = sideSeen.get(label.side);
    if (earlier !== undefined) throw new Error(`${SUBJECT} 的 labels[${i}] 與 labels[${earlier}] 標在同一邊（${label.side}），每邊最多一個標籤`);
    sideSeen.set(label.side, i);
    return { side: label.side, kind: isCount ? "count" : "text", text: isCount ? String(text) : (text as string).trim() };
  });
  const textCount = labels.filter((l) => l.kind === "text").length;
  if (textCount > MAX_TEXT_LABELS) throw new Error(`${SUBJECT} 圖內最多三個文字標籤，目前有 ${textCount} 個`);
  return labels;
}

/** 驗證單位方格的參數並算出塗色格、外框與標籤；任何不合規則的參數都丟出中文錯誤。 */
export function resolveUnitGrid(input: UnitGridInput): UnitGrid {
  const rows = checkSize("rows", input.rows, MAX_ROWS);
  const cols = checkSize("cols", input.cols, MAX_COLS);
  const cells = collectCells(rows, cols, input.rects ?? [], input.cells ?? []);
  const shaded = cells.filter((c) => c.shaded);
  if (input.perimeter !== undefined && typeof input.perimeter !== "boolean") {
    throw new Error(`${SUBJECT} 的 perimeter 必須是 true 或 false`);
  }
  if (input.perimeter && shaded.length === 0) throw new Error(`${SUBJECT} 要描周長外框，必須先有塗色的格子（rects 或 cells）`);
  const bounds =
    shaded.length === 0
      ? { row0: 0, col0: 0, row1: rows, col1: cols }
      : {
          row0: Math.min(...shaded.map((c) => c.row)),
          col0: Math.min(...shaded.map((c) => c.col)),
          row1: Math.max(...shaded.map((c) => c.row)) + 1,
          col1: Math.max(...shaded.map((c) => c.col)) + 1,
        };
  return {
    rows,
    cols,
    cells,
    bounds,
    outline: input.perimeter ? computeOutline(cells, rows, cols) : undefined,
    labels: resolveLabels(input.labels ?? []),
  };
}
