/**
 * 疊排分數的版面：分子、分數線、分母上下排，帶分數的整數部分並排在左，負數的負號在整個分數（含整數部分）的最左邊。純幾何計算，
 * 數線的刻度標籤與分數條的標籤共用，兩個教具的分數長得一樣。座標單位是 viewBox。
 */

/** 數學減號（U+2212）；數線與疊排分數裡的負號一律用它，不用連字號 */
export const MINUS = "\u2212";

export interface StackedFractionParts {
  /** 負數：負號畫在整個分數的最左邊，垂直置中對齊分數線；分子分母（與整數部分）仍是正數的字串 */
  negative?: boolean;
  /** 帶分數的整數部分；不給就是單純的疊排分數 */
  whole?: string;
  numerator: string;
  denominator: string;
}

/** 數線刻度與分數條標籤共用的標籤種類：整數與小數是純文字，分數與帶分數要疊排（欄位都是已排好的字串） */
export interface IntegerLabel {
  kind: "integer";
  text: string;
}
export interface DecimalLabel {
  kind: "decimal";
  text: string;
}
export interface FractionLabel {
  kind: "fraction";
  negative?: boolean;
  numerator: string;
  denominator: string;
}
export interface MixedLabel {
  kind: "mixed";
  negative?: boolean;
  whole: string;
  numerator: string;
  denominator: string;
}
export type StackedLabel = FractionLabel | MixedLabel;

/** 標籤是否要用疊排分數畫（分數或帶分數） */
export const isStacked = <L extends { kind: string }>(label: L): label is Extract<L, StackedLabel> =>
  label.kind === "fraction" || label.kind === "mixed";

export interface StackedFractionLayout {
  sign?: { text: string; x: number; y: number; width: number };
  whole?: { text: string; x: number; y: number; width: number };
  numerator: { text: string; x: number; y: number };
  denominator: { text: string; x: number; y: number };
  bar: { x1: number; x2: number; y: number };
}

/** 疊排分數整體高度：從分子上緣到分母下緣 */
export const STACKED_HEIGHT = 46;
/** 分數線離整體上緣的距離，也是整數部分的垂直中心 */
export const STACKED_BAR_OFFSET = 23;

const BAR_PADDING = 8; // 分數線比較寬那一邊的數字再多出的長度
const WHOLE_GAP = 4; // 整數部分與分數之間的空隙
const SIGN_GAP = 3; // 負號與後面的數字之間的空隙
const NUMERATOR_BASELINE = 17;
const DENOMINATOR_BASELINE = 43;
const WHOLE_BASELINE = STACKED_BAR_OFFSET + 8; // 讓 22px 數字的視覺中心落在分數線高度；負號（減號的字形在數字的視覺中心）共用同一條基線

/** 估計文字寬度：中日韓字寬等於字級，其餘（數字與拉丁字母）22px 時 13，依字級等比，寧寬勿窄；分數條與 Shape 的標籤用它留空間 */
export const textWidthAt = (text: string, font: number): number =>
  [...text].reduce((sum, ch) => sum + (ch.codePointAt(0)! > 0x2e7f ? font : (font * 13) / 22), 0);

/** 純文字數字（22px）的估計寬度 */
export const textWidth = (text: string): number => textWidthAt(text, 22);

const barWidthOf = ({ numerator, denominator }: StackedFractionParts) => Math.max(textWidth(numerator), textWidth(denominator)) + BAR_PADDING;
const wholeWidthOf = ({ whole }: StackedFractionParts) => (whole === undefined ? 0 : textWidth(whole) + WHOLE_GAP);
const signWidthOf = ({ negative }: StackedFractionParts) => (negative ? textWidth(MINUS) + SIGN_GAP : 0);

/** 疊排分數整體的寬度（含負號與帶分數的整數部分）；呼叫端用它替標籤留空間。 */
export const stackedFractionWidth = (parts: StackedFractionParts): number => signWidthOf(parts) + wholeWidthOf(parts) + barWidthOf(parts);

/** 以 cx 為水平中心、top 為上緣，算出疊排分數各部分的位置。 */
export function stackedFractionLayout(parts: StackedFractionParts, cx: number, top: number): StackedFractionLayout {
  const { whole, numerator, denominator } = parts;
  const barWidth = barWidthOf(parts);
  const wholeWidth = wholeWidthOf(parts);
  const signWidth = signWidthOf(parts);
  const left = cx - (signWidth + wholeWidth + barWidth) / 2;
  const wholeLeft = left + signWidth;
  const fractionCx = wholeLeft + wholeWidth + barWidth / 2;
  return {
    ...(parts.negative
      ? { sign: { text: MINUS, x: left + (signWidth - SIGN_GAP) / 2, y: top + WHOLE_BASELINE, width: signWidth - SIGN_GAP } }
      : {}),
    ...(whole === undefined
      ? {}
      : { whole: { text: whole, x: wholeLeft + (wholeWidth - WHOLE_GAP) / 2, y: top + WHOLE_BASELINE, width: wholeWidth - WHOLE_GAP } }),
    numerator: { text: numerator, x: fractionCx, y: top + NUMERATOR_BASELINE },
    denominator: { text: denominator, x: fractionCx, y: top + DENOMINATOR_BASELINE },
    bar: { x1: fractionCx - barWidth / 2, x2: fractionCx + barWidth / 2, y: top + STACKED_BAR_OFFSET },
  };
}
