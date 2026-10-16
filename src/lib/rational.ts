/** 精確的有理數：分母恆為正、恆已約分。位置值與刻度比較都用它，避免浮點誤差（0.1 + 0.2 與 0.3 是同一個位置）。 */
export interface Rational {
  n: number;
  d: number;
}

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

export const lcm = (a: number, b: number): number => (a / gcd(a, b)) * b;

export function rational(n: number, d = 1): Rational {
  const g = gcd(n, d) || 1;
  const sign = d < 0 ? -1 : 1;
  return { n: (sign * n) / g, d: (sign * d) / g };
}

export const add = (a: Rational, b: Rational): Rational => rational(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Rational, b: Rational): Rational => rational(a.n * b.d - b.n * a.d, a.d * b.d);
export const mul = (a: Rational, b: Rational): Rational => rational(a.n * b.n, a.d * b.d);
export const div = (a: Rational, b: Rational): Rational => rational(a.n * b.d, a.d * b.n);
export const compare = (a: Rational, b: Rational): number => a.n * b.d - b.n * a.d;
export const isInteger = (a: Rational): boolean => a.d === 1;
export const toNumber = (a: Rational): number => a.n / a.d;
export const key = (a: Rational): string => `${a.n}/${a.d}`;

const DECIMAL_LITERAL = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/;
const FRACTION_STRING = /^(-?\d+)\/(\d+)$/;

/** 把 "a/b" 字串拆成分子與分母（不約分）；格式不符回傳 undefined。分母可以是 0，由呼叫端決定怎麼報錯。 */
export function splitFraction(raw: unknown): { n: number; d: number } | undefined {
  const m = typeof raw === "string" ? FRACTION_STRING.exec(raw) : null;
  return m ? { n: Number(m[1]), d: Number(m[2]) } : undefined;
}

/**
 * 把位置值解析成精確有理數。數字取它的十進位字面（0.1 就是 1/10，不經浮點運算），
 * 字串必須是 "a/b"：整數分子、正整數分母。`subject` 是錯誤訊息裡的主詞，例如「<NumberLine> 的 from」。
 */
export function parseRational(raw: unknown, subject: string): Rational {
  const bad = () => new Error(`${subject} 必須是數字或 "a/b" 字串（整數分子、正整數分母），目前是 ${JSON.stringify(raw)}`);
  if (typeof raw === "number") {
    const m = Number.isFinite(raw) ? DECIMAL_LITERAL.exec(String(raw)) : null;
    if (!m) throw bad();
    const [, sign, whole, fraction = "", exponent = "0"] = m;
    const digits = Number(`${whole}${fraction}`);
    const shift = Number(exponent) - fraction.length;
    const n = (sign ? -1 : 1) * digits * 10 ** Math.max(shift, 0);
    const d = 10 ** Math.max(-shift, 0);
    if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) throw new Error(`${subject}（${raw}）的位數太多，無法精確表示`);
    return rational(n, d);
  }
  const parts = splitFraction(raw);
  if (!parts) throw bad();
  const { n, d } = parts;
  if (d === 0) throw new Error(`${subject}（"${raw}"）的分母不能是 0`);
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) throw new Error(`${subject}（"${raw}"）的位數太多，無法精確表示`);
  return rational(n, d);
}
