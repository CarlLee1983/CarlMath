/**
 * 平面圖形教具的版面計算與參數驗證（ADR 0003）。純函式，不依賴 Astro；元件只負責把結果畫成 SVG。
 * 作者以抽象座標（y 軸朝上）寫頂點；這裡等比縮放到 viewBox 寬 480、翻轉 y 軸，算出標籤與記號的位置，
 * 並依頂點座標驗證度數標籤（相差超過 1° 就丟錯）。
 */

/** 抽象座標：[x, y]，y 軸朝上 */
export type ShapePoint = [number, number];

export interface ShapeSide {
  /** 第 side 條邊，從頂點 side 到頂點 side + 1（最後一條接回頂點 0） */
  side: number;
  /** 邊長標籤；含數字算邊長（「4」「100 公尺」），否則算文字標籤（「底」）。不驗證比例 */
  label?: string | number;
  /** 等邊記號：邊中點的 1–3 條短斜線，同組的邊畫同樣的條數 */
  equal?: number;
  /** 平行記號：邊上的 1–2 個箭頭，同組的邊畫同樣的個數 */
  parallel?: number;
}

export interface ShapeAngle {
  /** 頂點編號 */
  at: number;
  /** 度數標籤：數字會依座標驗證，"?" 表示未知角、不驗證 */
  degrees?: number | "?";
  /** 直角記號（小方框），取代角弧；座標不是 90° 時丟錯 */
  right?: boolean;
}

export interface ShapePolygon {
  vertices: ShapePoint[];
  /** 頂點字母，數量須與 vertices 相同 */
  names?: string[];
  /** 整塊塗 --accent */
  filled?: boolean;
  sides?: ShapeSide[];
  angles?: ShapeAngle[];
}

export interface ShapeCircle {
  center: ShapePoint;
  radius: number;
  /** 畫出半徑（圓心向右）或直徑（水平） */
  show?: "radius" | "diameter";
  /** 線段上方的標籤，須搭配 show；規則同邊長標籤 */
  label?: string | number;
}

export interface ShapeGuide {
  from: ShapePoint;
  to: ShapePoint;
  /** 輔助線旁的標籤（例如「高」）；規則同邊長標籤 */
  label?: string | number;
  /** 在 to（垂足）畫直角記號；to 須落在某個多邊形的邊上，且輔助線與該邊垂直（±1°） */
  right?: true;
}

export interface ShapeInput {
  polygons?: ShapePolygon[];
  circles?: ShapeCircle[];
  guides?: ShapeGuide[];
}

/** 驗證後的輔助線：right 時帶著垂足所在邊的方向（抽象座標，朝較遠的那個頂點） */
interface CheckedGuide extends ShapeGuide {
  footDir?: Pt;
}

/** 畫面上的座標：[x, y] */
type Pt = [number, number];

export interface ShapeText {
  kind: "length" | "degree" | "letter" | "note";
  text: string;
  /** 水平中心 */
  x: number;
  /** 文字基線 */
  y: number;
  /** 垂直中心 */
  cy: number;
  /** 估計寬度 */
  width: number;
}

export interface ShapeLayout {
  width: 480;
  height: number;
  polygons: { points: Pt[]; filled: boolean }[];
  circles: { cx: number; cy: number; r: number; segment?: { x1: number; y1: number; x2: number; y2: number } }[];
  guides: { x1: number; y1: number; x2: number; y2: number }[];
  /** 角弧的 SVG path */
  arcs: string[];
  /** 直角記號：小方框的 4 個頂點 */
  rightMarks: Pt[][];
  /** 等邊記號：每條短斜線的兩端 */
  equalMarks: { x1: number; y1: number; x2: number; y2: number }[];
  /** 平行記號：每個箭頭的 SVG path */
  parallelMarks: string[];
  texts: ShapeText[];
}

const SUBJECT = "<Shape>";
const WIDTH = 480;
const MAX_NUMBERS = 6; // 邊長與度數合計
const MAX_LETTERS = 4;
const MAX_NOTES = 3;
const ANGLE_TOLERANCE = 1; // 度
const BASE_MARGIN = 24; // 圖形離左右邊界的最小距離
const EDGE_PAD = 8; // 上下留白
const NUMBER_FONT = 22;
const NOTE_FONT = 20;
const LABEL_GAP = 10; // 標籤離邊的距離
const ARC_RADIUS = 28;
const RIGHT_SIZE = 16;
const TICK_LENGTH = 14;
const TICK_GAP = 8;
const CHEVRON_GAP = 10;

const isPoint = (p: unknown): p is ShapePoint => Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === "number" && Number.isFinite(n));
const isInt = (n: unknown, min: number, max: number) => typeof n === "number" && Number.isInteger(n) && n >= min && n <= max;
const describe = (value: unknown) => (typeof value === "string" ? JSON.stringify(value) : String(value));

/** 含數字的標籤是邊長（22），否則是文字標籤（20） */
const isNumeric = (label: string | number) => typeof label === "number" || /\d/.test(label);

/** 估計文字寬度：中日韓字寬等於字級，其餘約 0.6 倍 */
const textWidthOf = (text: string, font: number) => [...text].reduce((sum, ch) => sum + (ch.codePointAt(0)! > 0x2e7f ? font : font * 0.6), 0);

const unit = (dx: number, dy: number): Pt => {
  const len = Math.hypot(dx, dy);
  return [dx / len, dy / len];
};

/** 驗證後的多邊形：補上方向與各頂點的內角資訊 */
interface Corner {
  /** 內角兩邊的方向（抽象座標、單位向量），從 a 逆時針轉到 b 就是內角 */
  a: Pt;
  b: Pt;
  /** 內角，度 */
  degrees: number;
}

function cornerOf(vertices: ShapePoint[], ccw: boolean, i: number): Corner {
  const n = vertices.length;
  const [p, prev, next] = [vertices[i]!, vertices[(i + n - 1) % n]!, vertices[(i + 1) % n]!];
  const toPrev = unit(prev[0] - p[0], prev[1] - p[1]);
  const toNext = unit(next[0] - p[0], next[1] - p[1]);
  const [a, b] = ccw ? [toNext, toPrev] : [toPrev, toNext];
  const turn = Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
  return { a, b, degrees: ((turn < 0 ? turn + 2 * Math.PI : turn) * 180) / Math.PI };
}

const signedArea = (vertices: ShapePoint[]) => vertices.reduce((sum, [x, y], i) => {
  const [nx, ny] = vertices[(i + 1) % vertices.length]!;
  return sum + (x * ny - nx * y) / 2;
}, 0);

const round1 = (n: number) => Math.round(n * 10) / 10;

interface CheckedPolygon extends ShapePolygon {
  ccw: boolean;
  corners: Corner[];
}

/** 垂足 to 所在的邊：依序找第一個多邊形的第一條既含 to 又與輔助線垂直的邊，回傳朝該邊較遠頂點的單位方向 */
function footDirection(g: ShapeGuide, polygons: CheckedPolygon[], where: string): Pt {
  const guideDir = unit(g.from[0] - g.to[0], g.from[1] - g.to[1]);
  let firstOnEdge: { text: string; degrees: number } | undefined;
  for (const [pi, poly] of polygons.entries()) {
    const { vertices } = poly;
    for (const [i, a] of vertices.entries()) {
      const b = vertices[(i + 1) % vertices.length]!;
      const [ex, ey] = [b[0] - a[0], b[1] - a[1]];
      const len = Math.hypot(ex, ey);
      const t = ((g.to[0] - a[0]) * ex + (g.to[1] - a[1]) * ey) / (len * len);
      const dist = Math.hypot(a[0] + t * ex - g.to[0], a[1] + t * ey - g.to[1]);
      if (t < -1e-9 || t > 1 + 1e-9 || dist > len * 1e-6) continue;
      const cos = Math.abs(guideDir[0] * (ex / len) + guideDir[1] * (ey / len));
      const degrees = (Math.acos(Math.min(1, cos)) * 180) / Math.PI;
      if (Math.abs(90 - degrees) <= ANGLE_TOLERANCE) {
        // 朝較遠的頂點：t < 0.5 往 b，否則往 a
        return t < 0.5 ? [ex / len, ey / len] : [-ex / len, -ey / len];
      }
      firstOnEdge ??= { text: `polygons[${pi}] 的邊 ${i}`, degrees };
    }
  }
  if (!firstOnEdge) throw new Error(`${where}.right 要求 to 落在某個多邊形的邊上，但 [${g.to.join(", ")}] 不在任何邊上`);
  throw new Error(`${where}.right 要求輔助線與 ${firstOnEdge.text}垂直，但夾角約是 ${round1(firstOnEdge.degrees)}°，與 90° 相差超過 ${ANGLE_TOLERANCE}°`);
}

/** 驗證參數；回傳補上方向與內角的多邊形。任何不合規則的參數都丟出中文錯誤。 */
function validate(input: ShapeInput): { polygons: CheckedPolygon[]; circles: ShapeCircle[]; guides: CheckedGuide[] } {
  const polygons = input.polygons ?? [];
  const circles = input.circles ?? [];
  const guides = input.guides ?? [];
  if (polygons.length + circles.length === 0) throw new Error(`${SUBJECT} 至少要有一個 polygons 或 circles`);

  const checked = polygons.map((poly, pi): CheckedPolygon => {
    const where = `${SUBJECT} 的 polygons[${pi}]`;
    const { vertices } = poly;
    if (!Array.isArray(vertices) || vertices.length < 3) {
      throw new Error(`${where}.vertices 至少要有 3 個頂點，目前有 ${Array.isArray(vertices) ? vertices.length : 0} 個`);
    }
    vertices.forEach((v, vi) => {
      if (!isPoint(v)) throw new Error(`${where}.vertices[${vi}] 必須是 [x, y] 兩個有限數字`);
    });
    const area = signedArea(vertices);
    if (Math.abs(area) < 1e-9) throw new Error(`${where} 面積為 0，頂點不能全在同一條直線上`);
    if (poly.names && poly.names.length !== vertices.length) {
      throw new Error(`${where}.names 必須和 vertices 一樣長（${vertices.length} 個），目前有 ${poly.names.length} 個`);
    }
    const last = vertices.length - 1;
    (poly.sides ?? []).forEach((s, si) => {
      if (!isInt(s.side, 0, last)) throw new Error(`${where}.sides[${si}].side 必須是 0 到 ${last} 的邊編號，目前是 ${describe(s.side)}`);
      if (s.equal !== undefined && !isInt(s.equal, 1, 3)) throw new Error(`${where}.sides[${si}].equal 必須是 1 到 3 的整數，目前是 ${describe(s.equal)}`);
      if (s.parallel !== undefined && !isInt(s.parallel, 1, 2)) throw new Error(`${where}.sides[${si}].parallel 必須是 1 到 2 的整數，目前是 ${describe(s.parallel)}`);
    });
    const ccw = area > 0;
    const corners = vertices.map((_, i) => cornerOf(vertices, ccw, i));
    (poly.angles ?? []).forEach((angle, ai) => {
      const at = `${where}.angles[${ai}]`;
      if (!isInt(angle.at, 0, last)) throw new Error(`${at}.at 必須是 0 到 ${last} 的頂點編號，目前是 ${describe(angle.at)}`);
      if (angle.right && angle.degrees !== undefined) throw new Error(`${at} 不能同時寫 right 與 degrees`);
      if (!angle.right && angle.degrees === undefined) throw new Error(`${at} 必須有 degrees（數字或 "?"）或 right`);
      const vertex = `頂點 ${angle.at}${poly.names ? `（${poly.names[angle.at]}）` : ""}`;
      const actual = corners[angle.at]!.degrees;
      if (angle.right && Math.abs(actual - 90) > ANGLE_TOLERANCE) {
        throw new Error(`${at}（${vertex}）標了直角，但依座標算出來約是 ${round1(actual)}°，相差超過 ${ANGLE_TOLERANCE}°`);
      }
      if (typeof angle.degrees === "number" && Math.abs(actual - angle.degrees) > ANGLE_TOLERANCE) {
        throw new Error(`${at}（${vertex}）標了 ${angle.degrees}°，但依座標算出來約是 ${round1(actual)}°，相差超過 ${ANGLE_TOLERANCE}°`);
      }
      if (angle.degrees !== undefined && angle.degrees !== "?" && typeof angle.degrees !== "number") {
        throw new Error(`${at}.degrees 必須是數字或 "?"，目前是 ${describe(angle.degrees)}`);
      }
    });
    return { ...poly, ccw, corners };
  });

  circles.forEach((c, ci) => {
    const where = `${SUBJECT} 的 circles[${ci}]`;
    if (!isPoint(c.center)) throw new Error(`${where}.center 必須是 [x, y] 兩個有限數字`);
    if (typeof c.radius !== "number" || !(c.radius > 0) || !Number.isFinite(c.radius)) throw new Error(`${where}.radius 必須是正數，目前是 ${describe(c.radius)}`);
    if (c.show !== undefined && c.show !== "radius" && c.show !== "diameter") throw new Error(`${where}.show 只能是 "radius" 或 "diameter"，目前是 ${describe(c.show)}`);
    if (c.label !== undefined && c.show === undefined) throw new Error(`${where}.label 必須搭配 show（radius 或 diameter）`);
  });
  const checkedGuides = guides.map((g, gi): CheckedGuide => {
    const where = `${SUBJECT} 的 guides[${gi}]`;
    if (!isPoint(g.from) || !isPoint(g.to)) throw new Error(`${where} 的 from 與 to 必須是 [x, y] 兩個有限數字`);
    if (!g.right) return g;
    return { ...g, footDir: footDirection(g, checked, where) };
  });

  // 標籤上限：邊長與度數視同刻度數字，合計最多 6；頂點字母最多 4；其他文字最多 3
  const labels = [
    ...checked.flatMap((p) => (p.sides ?? []).map((s) => s.label)),
    ...circles.map((c) => c.label),
    ...guides.map((g) => g.label),
  ].filter((l): l is string | number => l !== undefined);
  const degrees = checked.flatMap((p) => p.angles ?? []).filter((a) => a.degrees !== undefined).length;
  const numbers = labels.filter(isNumeric).length + degrees;
  const notes = labels.length - labels.filter(isNumeric).length;
  const letters = checked.reduce((sum, p) => sum + (p.names?.length ?? 0), 0);
  if (numbers > MAX_NUMBERS) throw new Error(`${SUBJECT} 的邊長與度數標籤合計最多 ${MAX_NUMBERS} 個，目前有 ${numbers} 個`);
  if (letters > MAX_LETTERS) throw new Error(`${SUBJECT} 的頂點字母最多 ${MAX_LETTERS} 個，目前有 ${letters} 個`);
  if (notes > MAX_NOTES) throw new Error(`${SUBJECT} 的文字標籤最多 ${MAX_NOTES} 個，目前有 ${notes} 個`);

  return { polygons: checked, circles, guides: checkedGuides };
}

/** 依縮放比例 s、左邊界 mx、上邊界 top 排出所有圖形與標籤 */
function place(v: ReturnType<typeof validate>, bounds: { minX: number; maxY: number }, s: number, mx: number, top: number): ShapeLayout {
  const px = (p: ShapePoint): Pt => [mx + (p[0] - bounds.minX) * s, top + (bounds.maxY - p[1]) * s];
  // 抽象方向 → 畫面方向（y 翻轉）
  const dir = (d: Pt): Pt => [d[0], -d[1]];
  const layout: ShapeLayout = { width: WIDTH, height: 0, polygons: [], circles: [], guides: [], arcs: [], rightMarks: [], equalMarks: [], parallelMarks: [], texts: [] };

  /** 標籤中心 c；文字的基線依字級往下移 */
  const addText = (kind: ShapeText["kind"], text: string, cx: number, cy: number, font: number) => {
    layout.texts.push({ kind, text, x: cx, y: cy + font * 0.35, cy, width: textWidthOf(text, font) });
  };
  const labelKind = (label: string | number): [ShapeText["kind"], number] => (isNumeric(label) ? ["length", NUMBER_FONT] : ["note", NOTE_FONT]);
  /** 標籤放在 p 朝 d 方向，離開標籤自己的半寬半高再加間隙 */
  const addBeside = (kind: ShapeText["kind"], text: string, font: number, p: Pt, d: Pt, gap: number) => {
    const w = textWidthOf(text, font);
    const off = gap + Math.abs(d[0]) * (w / 2) + Math.abs(d[1]) * (font / 2);
    addText(kind, text, p[0] + d[0] * off, p[1] + d[1] * off, font);
  };

  for (const poly of v.polygons) {
    const pts = poly.vertices.map(px);
    const n = pts.length;
    layout.polygons.push({ points: pts, filled: poly.filled === true });
    const minEdge = Math.min(...pts.map((p, i) => Math.hypot(pts[(i + 1) % n]![0] - p[0], pts[(i + 1) % n]![1] - p[1])));

    for (const side of poly.sides ?? []) {
      const [a, b] = [pts[side.side]!, pts[(side.side + 1) % n]!];
      const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const along = unit(b[0] - a[0], b[1] - a[1]);
      // 抽象座標逆時針時外側在邊方向的右手邊；畫面 y 翻轉後變成 (-ay, ax) 的反向，這裡直接用畫面座標判斷
      const normal: Pt = poly.ccw ? [-along[1], along[0]] : [along[1], -along[0]];
      if (side.label !== undefined) {
        const [kind, font] = labelKind(side.label);
        addBeside(kind, String(side.label), font, mid, normal, LABEL_GAP);
      }
      if (side.equal) {
        const tick = unit(normal[0] * 0.9 + along[0] * 0.42, normal[1] * 0.9 + along[1] * 0.42);
        for (let k = 0; k < side.equal; k++) {
          const c: Pt = [mid[0] + along[0] * (k - (side.equal - 1) / 2) * TICK_GAP, mid[1] + along[1] * (k - (side.equal - 1) / 2) * TICK_GAP];
          layout.equalMarks.push({ x1: c[0] - (tick[0] * TICK_LENGTH) / 2, y1: c[1] - (tick[1] * TICK_LENGTH) / 2, x2: c[0] + (tick[0] * TICK_LENGTH) / 2, y2: c[1] + (tick[1] * TICK_LENGTH) / 2 });
        }
      }
      if (side.parallel) {
        // 同組的邊箭頭要同向：統一朝右（垂直的邊朝上）
        const e: Pt = along[0] > 1e-9 || (Math.abs(along[0]) <= 1e-9 && along[1] < 0) ? along : [-along[0], -along[1]];
        const p: Pt = [-e[1], e[0]];
        for (let k = 0; k < side.parallel; k++) {
          const c: Pt = [mid[0] + e[0] * (k - (side.parallel - 1) / 2) * CHEVRON_GAP, mid[1] + e[1] * (k - (side.parallel - 1) / 2) * CHEVRON_GAP];
          const tip: Pt = [c[0] + e[0] * 5, c[1] + e[1] * 5];
          const [arm1, arm2]: [Pt, Pt] = [[c[0] - e[0] * 5 + p[0] * 7, c[1] - e[1] * 5 + p[1] * 7], [c[0] - e[0] * 5 - p[0] * 7, c[1] - e[1] * 5 - p[1] * 7]];
          layout.parallelMarks.push(`M ${arm1[0]} ${arm1[1]} L ${tip[0]} ${tip[1]} L ${arm2[0]} ${arm2[1]}`);
        }
      }
    }

    for (const angle of poly.angles ?? []) {
      const corner = poly.corners[angle.at]!;
      const p = pts[angle.at]!;
      const [a, b] = [dir(corner.a), dir(corner.b)];
      if (angle.right) {
        const size = Math.min(RIGHT_SIZE, minEdge * 0.4);
        const [pa, pb]: [Pt, Pt] = [[p[0] + a[0] * size, p[1] + a[1] * size], [p[0] + b[0] * size, p[1] + b[1] * size]];
        layout.rightMarks.push([p, pa, [pa[0] + b[0] * size, pa[1] + b[1] * size], pb]);
        continue;
      }
      const r = Math.min(ARC_RADIUS, minEdge * 0.45);
      const large = corner.degrees > 180 ? 1 : 0;
      // 內角從 a 逆時針轉到 b；畫面上看起來仍是逆時針，SVG 的 sweep-flag 為 0
      layout.arcs.push(`M ${p[0] + a[0] * r} ${p[1] + a[1] * r} A ${r} ${r} 0 ${large} 0 ${p[0] + b[0] * r} ${p[1] + b[1] * r}`);
      const text = angle.degrees === "?" ? "?" : `${angle.degrees}°`;
      const phi = Math.atan2(corner.a[1], corner.a[0]) + (corner.degrees * Math.PI) / 360;
      addBeside("degree", text, NUMBER_FONT, p, dir([Math.cos(phi), Math.sin(phi)]), r + 6);
    }

    (poly.names ?? []).forEach((name, i) => {
      const corner = poly.corners[i]!;
      const phi = Math.atan2(corner.a[1], corner.a[0]) + (corner.degrees * Math.PI) / 360 + Math.PI;
      addBeside("letter", name, NUMBER_FONT, pts[i]!, dir([Math.cos(phi), Math.sin(phi)]), 8);
    });
  }

  for (const circle of v.circles) {
    const [cx, cy] = px(circle.center);
    const r = circle.radius * s;
    const segment = circle.show === undefined ? undefined : circle.show === "radius" ? { x1: cx, y1: cy, x2: cx + r, y2: cy } : { x1: cx - r, y1: cy, x2: cx + r, y2: cy };
    layout.circles.push({ cx, cy, r, ...(segment ? { segment } : {}) });
    if (circle.label !== undefined && segment) {
      const [kind, font] = labelKind(circle.label);
      addBeside(kind, String(circle.label), font, [(segment.x1 + segment.x2) / 2, cy - 4], [0, -1], 10);
    }
  }

  for (const guide of v.guides) {
    const [a, b] = [px(guide.from), px(guide.to)];
    layout.guides.push({ x1: a[0], y1: a[1], x2: b[0], y2: b[1] });
    if (guide.footDir) {
      const along = unit(a[0] - b[0], a[1] - b[1]);
      const edge = dir(guide.footDir);
      const size = Math.min(RIGHT_SIZE, Math.hypot(a[0] - b[0], a[1] - b[1]) * 0.4);
      const [pg, pe]: [Pt, Pt] = [[b[0] + along[0] * size, b[1] + along[1] * size], [b[0] + edge[0] * size, b[1] + edge[1] * size]];
      layout.rightMarks.push([b, pg, [pg[0] + edge[0] * size, pg[1] + edge[1] * size], pe]);
    }
    if (guide.label !== undefined) {
      const along = unit(b[0] - a[0], b[1] - a[1]);
      // 標籤放在輔助線偏右（水平線則偏上）的一側
      const n: Pt = [-along[1], along[0]];
      const side: Pt = n[0] > 1e-9 || (Math.abs(n[0]) <= 1e-9 && n[1] < 0) ? n : [-n[0], -n[1]];
      const [kind, font] = labelKind(guide.label);
      addBeside(kind, String(guide.label), font, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], side, LABEL_GAP);
    }
  }
  return layout;
}

/** 驗證參數並排出版面；任何不合規則的參數都丟出中文錯誤。 */
export function resolveShape(input: ShapeInput): ShapeLayout {
  const v = validate(input);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of v.polygons) for (const [x, y] of p.vertices) (xs.push(x), ys.push(y));
  for (const c of v.circles) xs.push(c.center[0] - c.radius, c.center[0] + c.radius), ys.push(c.center[1] - c.radius, c.center[1] + c.radius);
  for (const g of v.guides) for (const [x, y] of [g.from, g.to]) (xs.push(x), ys.push(y));
  const bounds = { minX: Math.min(...xs), maxY: Math.max(...ys) };
  const spanX = Math.max(...xs) - bounds.minX;
  if (spanX <= 0) throw new Error(`${SUBJECT} 的圖形寬度為 0，無法縮放`);

  // 標籤可能超出圖形的外接範圍：加大左右邊界重排，直到標籤都在 0 到 480 內
  let mx = BASE_MARGIN;
  let layout = place(v, bounds, (WIDTH - 2 * mx) / spanX, mx, 0);
  for (let round = 0; round < 8; round++) {
    const spill = Math.max(0, ...layout.texts.flatMap((t) => [-(t.x - t.width / 2), t.x + t.width / 2 - WIDTH]));
    if (spill <= 0) break;
    mx += spill;
    layout = place(v, bounds, (WIDTH - 2 * mx) / spanX, mx, 0);
  }
  const s = (WIDTH - 2 * mx) / spanX;

  // 垂直方向不影響縮放：量出圖形與標籤的上下範圍，平移後再排一次
  const verticals = [
    ...layout.polygons.flatMap((p) => p.points.map((pt) => pt[1])),
    ...layout.circles.flatMap((c) => [c.cy - c.r, c.cy + c.r]),
    ...layout.guides.flatMap((g) => [g.y1, g.y2]),
    ...layout.texts.flatMap((t) => [t.cy - NUMBER_FONT / 2, t.cy + NUMBER_FONT / 2]),
  ];
  const top = EDGE_PAD - Math.min(...verticals);
  const placed = place(v, bounds, s, mx, top);
  return { ...placed, height: Math.ceil(Math.max(...verticals) + top + EDGE_PAD) };
}
