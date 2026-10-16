/** 天平教具的參數驗證與版面計算。純函式，不依賴 Astro；元件只負責把結果畫成 SVG。 */

export type Side = "left" | "right";

/** 一盤的內容：x 盒子與 1 的砝碼各幾個 */
export interface PanInput {
  /** x 盒子的個數（係數），非負整數 */
  x: number;
  /** 1 的砝碼個數，非負整數 */
  units: number;
}

/** 一盤拿掉的物件，沒寫的視為 0 */
export interface PanRemovedInput {
  x?: number;
  units?: number;
}

export interface BalanceScaleInput {
  left: PanInput;
  right: PanInput;
  /** 那一邊較重；不給時畫成平衡 */
  tilt?: Side;
  /** 每盤拿掉的物件，畫成虛線框 */
  removed?: { left?: PanRemovedInput; right?: PanRemovedInput };
}

export interface BalanceItem {
  kind: "x" | "unit";
  /** 拿掉的畫成虛線框、不塗色 */
  removed: boolean;
  /** 物件中心 */
  cx: number;
  cy: number;
}

export interface BalancePan {
  side: Side;
  /** 秤盤中心的 x，也是橫樑該端的 x */
  cx: number;
  /** 橫樑該端的 y */
  endY: number;
  /** 吊桿（橫樑端點下方的水平短桿）的 y */
  hangerY: number;
  /** 秤盤底線的 y */
  plateY: number;
  items: BalanceItem[];
}

export interface BalanceLayout {
  width: number;
  height: number;
  tilt: Side | undefined;
  /** 物件的邊長（盒子邊長，也是砝碼直徑） */
  size: number;
  /** 秤盤與吊桿的寬 */
  panWidth: number;
  pivot: { x: number; y: number };
  beam: { x1: number; y1: number; x2: number; y2: number };
  base: { x1: number; x2: number; y: number };
  pans: [BalancePan, BalancePan];
}

const MAX_PER_PAN = 10;
const PER_ROW = 5;
const SIZE = 34;
const GAP = 6;
const WIDTH = 480;
const PAN_WIDTH = 200;
const BEAM_HALF = 120;
const TILT_DEGREES = 10;
const TOP = 8;
const HANGER_DROP = 16; // 橫樑端點到吊桿
const PLATE_PAD = 12; // 最上排物件到吊桿的空隙
const BASE_ROOM = 14; // 秤盤底到底座
const BASE_HALF = 50;
const EDGE = 3; // 底座線寬的邊

const SUBJECT = "<BalanceScale>";

const isCount = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 0;
const round = (n: number) => Math.round(n * 10) / 10;

function checkPan(name: Side, pan: PanInput): PanInput {
  const { x, units } = pan ?? ({} as PanInput);
  if (!isCount(x) || !isCount(units)) {
    throw new Error(`${SUBJECT} 的 ${name} 必須是 { x, units }，x、units 都是 0 以上的整數，目前是 ${JSON.stringify(pan)}`);
  }
  if (x + units < 1) throw new Error(`${SUBJECT} 的 ${name} 至少要有一個物件（x 盒子或砝碼）`);
  if (x + units > MAX_PER_PAN) {
    throw new Error(`${SUBJECT} 的 ${name} 一盤合計最多 ${MAX_PER_PAN} 個物件，目前有 ${x + units} 個`);
  }
  return { x, units };
}

function checkRemoved(name: Side, pan: PanInput, raw: PanRemovedInput | undefined): PanInput {
  if (raw === undefined) return { x: 0, units: 0 };
  const x = raw.x ?? 0;
  const units = raw.units ?? 0;
  if (!isCount(x) || !isCount(units)) {
    throw new Error(`${SUBJECT} 的 removed.${name} 必須是 { x?, units? }，數量是 0 以上的整數，目前是 ${JSON.stringify(raw)}`);
  }
  if (x > pan.x) throw new Error(`${SUBJECT} 的 removed.${name}.x 是 ${x}，超過 ${name} 盤原有的 ${pan.x} 個 x 盒子`);
  if (units > pan.units) throw new Error(`${SUBJECT} 的 removed.${name}.units 是 ${units}，超過 ${name} 盤原有的 ${pan.units} 個砝碼`);
  return { x, units };
}

/** 物件的排列順序：x 盒子在前、砝碼在後；各自留下的在前、拿掉的在後 */
function itemKinds(pan: PanInput, removed: PanInput): { kind: "x" | "unit"; removed: boolean }[] {
  const group = (kind: "x" | "unit", total: number, gone: number) =>
    Array.from({ length: total }, (_, i) => ({ kind, removed: i >= total - gone }));
  return [...group("x", pan.x, removed.x), ...group("unit", pan.units, removed.units)];
}

/** 驗證天平的參數並算出橫樑、秤盤與每個物件的位置；任何不合規則的參數都丟出中文錯誤。 */
export function resolveBalanceScale(input: BalanceScaleInput): BalanceLayout {
  const left = checkPan("left", input.left);
  const right = checkPan("right", input.right);
  if (input.tilt !== undefined && input.tilt !== "left" && input.tilt !== "right") {
    throw new Error(`${SUBJECT} 的 tilt 必須是 "left" 或 "right"，目前是 ${JSON.stringify(input.tilt)}`);
  }
  const tilt = input.tilt;
  const removedLeft = checkRemoved("left", left, input.removed?.left);
  const removedRight = checkRemoved("right", right, input.removed?.right);

  // 兩盤用同樣的高度，傾斜時只有橫樑端點上下移動
  const rowsOf = (pan: PanInput) => Math.ceil((pan.x + pan.units) / PER_ROW);
  const rows = Math.max(rowsOf(left), rowsOf(right));
  const stackHeight = rows * SIZE + (rows - 1) * GAP;

  const radians = (TILT_DEGREES * Math.PI) / 180;
  const dx = round(BEAM_HALF * Math.cos(radians));
  const dy = round(BEAM_HALF * Math.sin(radians));

  const pivot = { x: WIDTH / 2, y: TOP + (tilt ? dy : 0) };
  // 較重的一邊往下
  const endY = (side: Side) => pivot.y + (tilt === undefined ? 0 : tilt === side ? dy : -dy);
  const endX = (side: Side) => round(pivot.x + (side === "left" ? -dx : dx));

  const buildPan = (side: Side, contents: PanInput, removed: PanInput): BalancePan => {
    const cx = endX(side);
    const hangerY = endY(side) + HANGER_DROP;
    const plateY = hangerY + PLATE_PAD + stackHeight;
    const kinds = itemKinds(contents, removed);
    const items = kinds.map((item, i): BalanceItem => {
      const row = Math.floor(i / PER_ROW);
      const inRow = Math.min(PER_ROW, kinds.length - row * PER_ROW);
      const rowWidth = inRow * SIZE + (inRow - 1) * GAP;
      return {
        ...item,
        cx: round(cx - rowWidth / 2 + SIZE / 2 + (i % PER_ROW) * (SIZE + GAP)),
        cy: plateY - SIZE / 2 - row * (SIZE + GAP),
      };
    });
    return { side, cx, endY: endY(side), hangerY, plateY, items };
  };
  const pans: [BalancePan, BalancePan] = [buildPan("left", left, removedLeft), buildPan("right", right, removedRight)];

  const baseY = Math.max(pans[0].plateY, pans[1].plateY) + BASE_ROOM;
  return {
    width: WIDTH,
    height: baseY + EDGE,
    tilt,
    size: SIZE,
    panWidth: PAN_WIDTH,
    pivot,
    beam: { x1: pans[0].cx, y1: pans[0].endY, x2: pans[1].cx, y2: pans[1].endY },
    base: { x1: WIDTH / 2 - BASE_HALF, x2: WIDTH / 2 + BASE_HALF, y: baseY },
    pans,
  };
}
