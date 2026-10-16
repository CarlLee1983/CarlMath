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

const shown = (raw: unknown) => (typeof raw === "string" ? `"${raw}"` : String(raw));

function assertSafe(n: number, d: number, subject: string, raw: unknown): void {
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(d)) throw new Error(`${subject}（${shown(raw)}）的位數太多，無法精確表示`);
}

/**
 * 解析 "a/b" 字串成分子與分母，不約分：整數分子、正整數分母，分母為 0、格式錯誤、超過安全整數都丟中文錯誤。
 * `subject` 是錯誤訊息裡的主詞（例如「<NumberLine> 的 from」），`accepts` 說明字串以外還接受什麼（例如「數字」）。
 */
export function parseFractionParts(raw: unknown, subject: string, accepts: string): { n: number; d: number } {
  const m = typeof raw === "string" ? FRACTION_STRING.exec(raw) : null;
  if (!m) throw new Error(`${subject} 必須是${accepts}或 "a/b" 字串（整數分子、正整數分母），目前是 ${JSON.stringify(raw)}`);
  const [n, d] = [Number(m[1]), Number(m[2])];
  if (d === 0) throw new Error(`${subject}（${shown(raw)}）的分母不能是 0`);
  assertSafe(n, d, subject, raw);
  return { n, d };
}

/**
 * 把位置值解析成精確有理數。數字取它的十進位字面（0.1 就是 1/10，不經浮點運算），
 * 字串必須是 "a/b"（見 parseFractionParts）。`subject` 是錯誤訊息裡的主詞，例如「<NumberLine> 的 from」。
 */
export function parseRational(raw: unknown, subject: string): Rational {
  if (typeof raw !== "number") {
    const { n, d } = parseFractionParts(raw, subject, "數字");
    return rational(n, d);
  }
  const m = Number.isFinite(raw) ? DECIMAL_LITERAL.exec(String(raw)) : null;
  if (!m) throw new Error(`${subject} 必須是數字或 "a/b" 字串（整數分子、正整數分母），目前是 ${JSON.stringify(raw)}`);
  const [, sign, whole, fraction = "", exponent = "0"] = m;
  const shift = Number(exponent) - fraction.length;
  const n = (sign ? -1 : 1) * Number(`${whole}${fraction}`) * 10 ** Math.max(shift, 0);
  const d = 10 ** Math.max(-shift, 0);
  assertSafe(n, d, subject, raw);
  return rational(n, d);
}
