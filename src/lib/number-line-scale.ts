/** 數線教具的刻度邏輯：參數驗證、刻度序列與「哪些刻度標數字」。純函式，不依賴 Astro；元件只負責畫。 */

export interface NumberLineMove {
  from: number;
  to: number;
  label?: string;
}

export interface NumberLineInput {
  from: number;
  to: number;
  step: number;
  labelEvery?: number;
  points?: { at: number; label?: string }[];
  jumps?: NumberLineMove[];
  spans?: NumberLineMove[];
}

export interface NumberLineScale {
  /** 全部刻度，由小到大 */
  ticks: number[];
  /** 要標數字的刻度，由小到大 */
  numbers: number[];
}

const isInt = (n: unknown): n is number => Number.isInteger(n);

/** 驗證參數並算出刻度；任何不合規則的參數都丟出中文錯誤。 */
export function resolveNumberLine(input: NumberLineInput): NumberLineScale {
  const { from, to, step, points = [], jumps = [], spans = [] } = input;
  if (![from, to, step].every(isInt)) throw new Error("<NumberLine> 的 from、to、step 必須是整數");
  if (step <= 0) throw new Error("<NumberLine> 的 step 必須大於 0");
  if (from >= to) throw new Error("<NumberLine> 的 from 必須小於 to");
  if ((to - from) % step !== 0) throw new Error("<NumberLine> 的 (to - from) 必須能被 step 整除");

  const { labelEvery } = input;
  if (labelEvery !== undefined && (!isInt(labelEvery) || labelEvery <= 0 || labelEvery % step !== 0)) {
    throw new Error("<NumberLine> 的 labelEvery 必須是 step 的正整數倍");
  }

  const onTick = (v: unknown, where: string): void => {
    if (!isInt(v)) throw new Error(`<NumberLine> 的 ${where} 必須是整數`);
    if (v < from || v > to || (v - from) % step !== 0) throw new Error(`<NumberLine> 的 ${where}（${v}）必須落在範圍內的刻度上`);
  };
  points.forEach((p, i) => onTick(p.at, `points[${i}].at`));
  for (const [name, list] of [["jumps", jumps], ["spans", spans]] as const) {
    list.forEach((m, i) => {
      onTick(m.from, `${name}[${i}].from`);
      onTick(m.to, `${name}[${i}].to`);
    });
  }
  const labelCount = [...points, ...jumps, ...spans].filter((m) => m.label).length;
  if (labelCount > 3) throw new Error(`<NumberLine> 圖內最多三個文字標籤，目前有 ${labelCount} 個`);

  const segments = (to - from) / step;
  const ticks = Array.from({ length: segments + 1 }, (_, i) => from + i * step);
  // 10 段以內每格標數字；超過 10 段（或指定 labelEvery）只標它的倍數（含 0），另加兩端點與 points
  const every = labelEvery ?? (segments <= 10 ? undefined : 5);
  const numbered = new Set<number>(every === undefined ? ticks : ticks.filter((v) => v % every === 0));
  numbered.add(from);
  numbered.add(to);
  for (const p of points) numbered.add(p.at);
  return { ticks, numbers: [...numbered].sort((a, b) => a - b) };
}
