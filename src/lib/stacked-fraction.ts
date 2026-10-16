/**
 * 疊排分數的版面：分子、分數線、分母上下排，帶分數的整數部分並排在左。純幾何計算，
 * 數線的刻度標籤與分數條的標籤共用，兩個教具的分數長得一樣。座標單位是 viewBox。
 */

export interface StackedFractionParts {
  /** 帶分數的整數部分；不給就是單純的疊排分數 */
  whole?: string;
  numerator: string;
  denominator: string;
}

export interface StackedFractionLayout {
  whole?: { text: string; x: number; y: number; width: number };
  numerator: { text: string; x: number; y: number };
  denominator: { text: string; x: number; y: number };
  bar: { x1: number; x2: number; y: number };
}

/** 數字字級（viewBox 單位），與數線刻度數字相同 */
export const STACKED_FONT_SIZE = 22;
/** 疊排分數整體高度：從分子上緣到分母下緣 */
export const STACKED_HEIGHT = 46;
/** 分數線離整體上緣的距離，也是整數部分的垂直中心 */
export const STACKED_BAR_OFFSET = 23;

const DIGIT_WIDTH = 13; // 22px 數字的估計寬度，寧寬勿窄
const BAR_PADDING = 8; // 分數線比較寬那一邊的數字再多出的長度
const WHOLE_GAP = 4; // 整數部分與分數之間的空隙
const NUMERATOR_BASELINE = 17;
const DENOMINATOR_BASELINE = 43;
const WHOLE_BASELINE = STACKED_BAR_OFFSET + 8; // 讓 22px 數字的視覺中心落在分數線高度

const textWidth = (text: string) => [...text].length * DIGIT_WIDTH;

/** 以 cx 為水平中心、top 為上緣，算出疊排分數各部分的位置。 */
export function stackedFractionLayout(parts: StackedFractionParts, cx: number, top: number): StackedFractionLayout {
  const { whole, numerator, denominator } = parts;
  const barWidth = Math.max(textWidth(numerator), textWidth(denominator)) + BAR_PADDING;
  const wholeWidth = whole === undefined ? 0 : textWidth(whole) + WHOLE_GAP;
  const left = cx - (wholeWidth + barWidth) / 2;
  const fractionCx = left + wholeWidth + barWidth / 2;
  return {
    ...(whole === undefined
      ? {}
      : { whole: { text: whole, x: left + (wholeWidth - WHOLE_GAP) / 2, y: top + WHOLE_BASELINE, width: wholeWidth - WHOLE_GAP } }),
    numerator: { text: numerator, x: fractionCx, y: top + NUMERATOR_BASELINE },
    denominator: { text: denominator, x: fractionCx, y: top + DENOMINATOR_BASELINE },
    bar: { x1: fractionCx - barWidth / 2, x2: fractionCx + barWidth / 2, y: top + STACKED_BAR_OFFSET },
  };
}
