/**
 * 數線教具的刻度邏輯：位置值解析、參數驗證、刻度序列與「哪些刻度標什麼」。純函式，不依賴 Astro；元件只負責畫。
 * 位置值是數字（取十進位字面）或 "a/b" 字串，內部一律以約分後的有理數比較。
 */
import { add, compare, div, isInteger, key, lcm, mul, parseFractionParts, parseRational, rational, sub, toNumber } from "./rational.ts";
import { MINUS, isStacked } from "./stacked-fraction.ts";
import type { DecimalLabel, FractionLabel, IntegerLabel, MixedLabel } from "./stacked-fraction.ts";
import type { Rational } from "./rational.ts";

/** 位置值：數字（0.1 就是 1/10）或 "a/b" 字串 */
export type Position = number | string;

export interface NumberLineMove<T = Position> {
  from: T;
  to: T;
  label?: string;
}

export interface NumberLineInput {
  from: Position;
  to: Position;
  step: Position;
  labelEvery?: Position;
  /** 開啟時，大於 1 的分數刻度寫成帶分數；只能搭配 "a/b" 寫法的 step */
  mixed?: boolean;
  points?: { at: Position; label?: string }[];
  jumps?: NumberLineMove[];
  spans?: NumberLineMove[];
}

/** 刻度上的標籤：整數與小數是純文字，分數與帶分數要疊排 */
export type TickLabel = IntegerLabel | DecimalLabel | FractionLabel | MixedLabel;

export interface NumberLineScale {
  /** 全部刻度，由小到大；at 是占整條線的比例（0 到 1） */
  ticks: { at: number; isZero: boolean }[];
  /** 要標的刻度，由小到大 */
  numbers: { at: number; label: TickLabel }[];
  points: { at: number; label?: string }[];
  jumps: NumberLineMove<number>[];
  spans: NumberLineMove<number>[];
  /** 是否有疊排標籤（分數或帶分數）；有的話，數線下方要依疊排高度留空間 */
  hasStacked: boolean;
}

const SUBJECT = "<NumberLine>";

/** 連字號（後面可隔空格）接數字、分數字元（\p{No}）、小寫字母或左括號，看起來是負號或減號；大寫字母之間的連字號（點的名稱 A-B）不算 */
const HYPHEN_AS_MINUS = /-[ ]*[\d\p{No}a-z(]/u;

/** 有限小數的寫法；分母含 2、5 以外的質因數時寫不出來，回傳 undefined。小數位數上限 15（10 ** 15 以內仍是精確整數），再多視為寫不出來 */
export function decimalText(v: Rational): string | undefined {
  let k = 0;
  while (k < 15 && 10 ** k % v.d !== 0) k++;
  if (10 ** k % v.d !== 0) return undefined;
  const scaled = (v.n * 10 ** k) / v.d;
  const digits = String(Math.abs(scaled)).padStart(k + 1, "0");
  const text = k === 0 ? digits : `${digits.slice(0, -k)}.${digits.slice(-k)}`;
  return scaled < 0 ? `${MINUS}${text}` : text;
}

/** step 與 labelEvery 決定刻度標籤的分母（不約分），字串寫法必須已是最簡分數，免得標籤悄悄變成約分後的分母 */
function parseLowestTerms(raw: Position, name: string): Rational {
  const value = parseRational(raw, `${SUBJECT} 的 ${name}`);
  if (typeof raw === "string") {
    const { n, d } = parseFractionParts(raw, `${SUBJECT} 的 ${name}`, "數字");
    if (n !== value.n || d !== value.d) throw new Error(`${SUBJECT} 的 ${name}（"${raw}"）必須寫成最簡分數，例如 "1/2"（整數請直接寫數字）`);
  }
  return value;
}

/** 驗證參數並算出刻度；任何不合規則的參數都丟出中文錯誤。 */
export function resolveNumberLine(input: NumberLineInput): NumberLineScale {
  const { points = [], jumps = [], spans = [], mixed = false } = input;
  const from = parseRational(input.from, `${SUBJECT} 的 from`);
  const to = parseRational(input.to, `${SUBJECT} 的 to`);
  const step = parseLowestTerms(input.step, "step");
  if (step.n <= 0) throw new Error(`${SUBJECT} 的 step 必須大於 0`);
  if (compare(from, to) >= 0) throw new Error(`${SUBJECT} 的 from 必須小於 to`);
  const segmentsRatio = div(sub(to, from), step);
  if (!isInteger(segmentsRatio)) throw new Error(`${SUBJECT} 的 (to - from) 必須能被 step 整除`);
  const segments = segmentsRatio.n;

  // 標籤寫法由 step 的寫法決定：字串寫成分數，數字寫成小數
  const fractionStyle = typeof input.step === "string";
  if (mixed && !fractionStyle) throw new Error(`${SUBJECT} 的 mixed 只能搭配 "a/b" 寫法的 step；step 是數字時不能開啟 mixed`);

  let every: Rational | undefined;
  if (input.labelEvery !== undefined) {
    every = parseLowestTerms(input.labelEvery, "labelEvery");
    if (every.n <= 0 || !isInteger(div(every, step))) throw new Error(`${SUBJECT} 的 labelEvery 必須是 step 的正整數倍`);
  }

  const onTick = (raw: unknown, where: string): Rational => {
    const v = parseRational(raw, `${SUBJECT} 的 ${where}`);
    if (compare(v, from) < 0 || compare(v, to) > 0 || !isInteger(div(sub(v, from), step))) {
      throw new Error(`${SUBJECT} 的 ${where}（${typeof raw === "string" ? `"${raw}"` : raw}）必須落在範圍內的刻度上`);
    }
    return v;
  };
  const at = (v: Rational) => toNumber(div(sub(v, from), sub(to, from)));
  const pointValues = points.map((p, i) => onTick(p.at, `points[${i}].at`));
  const moves = (name: string, list: NumberLineMove[]) =>
    list.map((m, i) => ({ from: onTick(m.from, `${name}[${i}].from`), to: onTick(m.to, `${name}[${i}].to`), label: m.label }));
  const jumpValues = moves("jumps", jumps);
  const spanValues = moves("spans", spans);
  // 作者寫在標籤裡的負數也要用數學減號，不自動轉換，讓作者看見並改掉
  const assertMinusSign = (name: string, list: NumberLineMove[] | { label?: string }[]) =>
    list.forEach((m, i) => {
      if (m.label && HYPHEN_AS_MINUS.test(m.label)) {
        throw new Error(
          `${SUBJECT} 的 ${name}[${i}].label（"${m.label}"）裡的負號或減號要用數學減號「${MINUS}」（U+2212），不要用連字號「-」（連字號後面接數字、分數字元、小寫字母或左括號時，會被當成減號）`,
        );
      }
    });
  assertMinusSign("points", points);
  assertMinusSign("jumps", jumps);
  assertMinusSign("spans", spans);
  const labelCount = [...points, ...jumps, ...spans].filter((m) => m.label).length;
  if (labelCount > 3) throw new Error(`${SUBJECT} 圖內最多三個文字標籤，目前有 ${labelCount} 個`);

  const tickValues = Array.from({ length: segments + 1 }, (_, i) => add(from, mul(step, rational(i))));

  // 要標哪些刻度。整數數線：10 段以內每格標，否則標 5 的倍數；分數與小數數線：10 段以內每格標，否則只標整數。
  // 指定 labelEvery 就照它標。兩端點與 points 一律標。
  const allIntegers = isInteger(from) && isInteger(step);
  const selected = (v: Rational): boolean => {
    if (every) return isInteger(div(v, every));
    if (segments <= 10) return true;
    return allIntegers ? isInteger(div(v, rational(5))) : isInteger(v);
  };
  const numbered = new Map<string, Rational>();
  for (const v of [...tickValues.filter(selected), from, to, ...pointValues]) numbered.set(key(v), v);
  const sorted = [...numbered.values()].sort(compare);

  // 分數的分母沿用刻度的分母、不約分：所有刻度的分母都整除 from 與 step 的最小公倍數
  const denominator = lcm(from.d, step.d);
  const labelOf = (v: Rational): TickLabel => {
    if (isInteger(v)) return { kind: "integer", text: v.n < 0 ? `${MINUS}${-v.n}` : String(v.n) };
    if (fractionStyle) {
      // 負分數：負號與分數分開（negative），分子分母、整數部分都用絕對值
      const negative = v.n < 0 ? { negative: true as const } : {};
      const abs = Math.abs(v.n);
      const numerator = abs * (denominator / v.d);
      const whole = mixed && abs > v.d ? Math.floor(abs / v.d) : 0;
      if (whole === 0) return { kind: "fraction", ...negative, numerator: String(numerator), denominator: String(denominator) };
      return { kind: "mixed", ...negative, whole: String(whole), numerator: String(numerator - whole * denominator), denominator: String(denominator) };
    }
    const text = decimalText(v);
    if (text === undefined) throw new Error(`${SUBJECT} 的 step 是數字時，刻度必須能寫成有限小數（${v.n}/${v.d} 不行）`);
    return { kind: "decimal", text };
  };
  const numbers = sorted.map((v) => ({ at: at(v), label: labelOf(v) }));

  return {
    ticks: tickValues.map((v) => ({ at: at(v), isZero: v.n === 0 })),
    numbers,
    points: points.map((p, i) => ({ at: at(pointValues[i]!), label: p.label })),
    jumps: jumpValues.map((m) => ({ from: at(m.from), to: at(m.to), label: m.label })),
    spans: spanValues.map((m) => ({ from: at(m.from), to: at(m.to), label: m.label })),
    hasStacked: numbers.some((n) => isStacked(n.label)),
  };
}
