/** 分數條教具的參數驗證。純函式，不依賴 Astro；元件只負責把結果畫成 SVG。 */
import { splitFraction } from "./rational.ts";

export interface FractionBarInput {
  /** 等分成幾份，1 到 24 的整數 */
  parts: number;
  /** 從左邊連續塗滿幾份，0 到 parts 的整數 */
  shaded: number;
  /** 畫在條右側的標籤："a/b" 字串（疊排，照原樣不約分）或整數 */
  label?: string | number;
}

/** 右側標籤：整數是純文字，分數要疊排 */
export type BarLabel = { kind: "integer"; text: string } | { kind: "fraction"; numerator: string; denominator: string };

export interface FractionBar {
  parts: number;
  shaded: number;
  label: BarLabel | undefined;
}

export const MIN_BARS = 1;
export const MAX_BARS = 4;
export const MAX_PARTS = 24;

const P = "<FractionBar>";

function resolveLabel(raw: unknown, where: string): BarLabel | undefined {
  if (raw === undefined) return undefined;
  if (typeof raw === "number" && Number.isInteger(raw)) return { kind: "integer", text: String(raw) };
  const parts = splitFraction(raw);
  if (!parts) throw new Error(`${P} 的 ${where} 必須是整數或 "a/b" 字串（整數分子、正整數分母），目前是 ${JSON.stringify(raw)}`);
  if (parts.d === 0) throw new Error(`${P} 的 ${where}（"${raw}"）的分母不能是 0`);
  return { kind: "fraction", numerator: String(parts.n), denominator: String(parts.d) };
}

/** 驗證每一條分數條的參數；任何不合規則的參數都丟出中文錯誤。 */
export function resolveFractionBars(bars: FractionBarInput[] | undefined): FractionBar[] {
  const list = bars ?? [];
  if (list.length < MIN_BARS || list.length > MAX_BARS) {
    throw new Error(`${P} 的 bars 必須有 ${MIN_BARS} 到 ${MAX_BARS} 條，目前有 ${list.length} 條`);
  }
  return list.map((bar, i) => {
    const { parts, shaded } = bar;
    if (!Number.isInteger(parts) || parts < 1 || parts > MAX_PARTS) {
      throw new Error(`${P} 的 bars[${i}].parts 必須是 1 到 ${MAX_PARTS} 的整數`);
    }
    if (!Number.isInteger(shaded) || shaded < 0 || shaded > parts) {
      throw new Error(`${P} 的 bars[${i}].shaded 必須是 0 到 parts（${parts}）的整數`);
    }
    return { parts, shaded, label: resolveLabel(bar.label, `bars[${i}].label`) };
  });
}
