import { test } from "node:test";
import assert from "node:assert/strict";
import { parseRational } from "../src/lib/rational.ts";

const SUBJECT = "<測試> 的 x";
const parse = (raw) => parseRational(raw, SUBJECT);
const rejects = (raw, message) => assert.throws(() => parse(raw), (e) => e instanceof Error && e.message === message);

test("數字取十進位字面，精確轉成分數", () => {
  assert.deepEqual(parse(0.1), { n: 1, d: 10 });
  assert.deepEqual(parse(0.3), { n: 3, d: 10 });
  assert.deepEqual(parse(2.5), { n: 5, d: 2 });
  assert.deepEqual(parse(3), { n: 3, d: 1 });
  assert.deepEqual(parse(0), { n: 0, d: 1 });
});

test("0.1 加 0.2 的浮點結果（0.30000000000000004）被擋下，寫 0.3 才精確等於 3/10", () => {
  rejects(0.1 + 0.2, `${SUBJECT}（0.30000000000000004）的位數太多，無法精確表示`);
  assert.deepEqual(parse(0.3), { n: 3, d: 10 });
});

test("指數寫法的字面照字面解析", () => {
  assert.deepEqual(parse(1e-7), { n: 1, d: 10_000_000 });
  assert.deepEqual(parse(1.5e-3), { n: 3, d: 2000 });
  assert.deepEqual(parse(1e5), { n: 100000, d: 1 });
});

test("負數：數字與字串的分子都可以是負的，分母恆為正", () => {
  assert.deepEqual(parse(-0.5), { n: -1, d: 2 });
  assert.deepEqual(parse(-3), { n: -3, d: 1 });
  assert.deepEqual(parse("-1/2"), { n: -1, d: 2 });
  rejects("1/-2", `${SUBJECT} 必須是數字或 "a/b" 字串（整數分子、正整數分母），目前是 "1/-2"`);
});

test("字串 \"a/b\" 約分後比較：\"2/4\" 與 \"1/2\" 相同", () => {
  assert.deepEqual(parse("2/4"), { n: 1, d: 2 });
  assert.deepEqual(parse("2/4"), parse("1/2"));
  assert.deepEqual(parse("4/2"), { n: 2, d: 1 });
  assert.deepEqual(parse("0/5"), { n: 0, d: 1 });
});

test("分母為 0 丟中文錯誤", () => {
  rejects("1/0", `${SUBJECT}（"1/0"）的分母不能是 0`);
});

test("格式錯誤丟中文錯誤", () => {
  const bad = (raw) => `${SUBJECT} 必須是數字或 "a/b" 字串（整數分子、正整數分母），目前是 ${JSON.stringify(raw)}`;
  for (const raw of ["abc", "", "1/", "/2", "3", "1.5/2", "1/2/3", " 1/2", "1/2 ", Number.NaN, Infinity, null, undefined, {}]) {
    rejects(raw, bad(raw));
  }
});

test("超過安全整數的值丟中文錯誤，不默默失去精度", () => {
  rejects(1e21, `${SUBJECT}（1e+21）的位數太多，無法精確表示`);
  rejects(0.1 + 0.7, `${SUBJECT}（0.7999999999999999）的位數太多，無法精確表示`);
  rejects("9007199254740993/2", `${SUBJECT}（"9007199254740993/2"）的位數太多，無法精確表示`);
  rejects("1/9007199254740993", `${SUBJECT}（"1/9007199254740993"）的位數太多，無法精確表示`);
});
