import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveNumberLine } from "../src/lib/number-line-scale.ts";

const scale = (props) => resolveNumberLine({ step: 1, ...props });
// 標籤的純文字寫法：疊排分數寫成 a/b，帶分數寫成 w a/b
const text = (label) =>
  label.kind === "fraction" ? `${label.numerator}/${label.denominator}` : label.kind === "mixed" ? `${label.whole} ${label.numerator}/${label.denominator}` : label.text;
const shown = (props) => scale(props).numbers.map((n) => text(n.label));
const kinds = (props) => scale(props).numbers.map((n) => n.label.kind);

const rejects = (props, message) => assert.throws(() => scale(props), (e) => e instanceof Error && e.message === message);
const rejectsMatch = (props, pattern) => assert.throws(() => scale(props), (e) => e instanceof Error && pattern.test(e.message));

test("10 段以內每格都標數字，位置是占整條線的比例", () => {
  const r = scale({ from: 0, to: 10 });
  assert.equal(r.ticks.length, 11);
  assert.deepEqual(shown({ from: 0, to: 10 }), ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
  assert.deepEqual(r.ticks.map((t) => t.at), [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1]);
  assert.deepEqual(r.ticks.map((t) => t.isZero), [true, ...Array(10).fill(false)]);
});

test("整數數線超過 10 段只標 5 的倍數，加上兩端點與 points", () => {
  assert.deepEqual(shown({ from: 0, to: 12, points: [{ at: 7 }] }), ["0", "5", "7", "10", "12"]);
});

test("labelEvery 指定時只標它的倍數，加上兩端點", () => {
  assert.deepEqual(shown({ from: 0, to: 20, labelEvery: 10 }), ["0", "10", "20"]);
  assert.deepEqual(shown({ from: 3, to: 9, labelEvery: 2 }), ["3", "4", "6", "8", "9"]);
});

test("非 0 起點、step 大於 1 的刻度序列", () => {
  assert.equal(scale({ from: 10, to: 30, step: 5 }).ticks.length, 5);
  assert.deepEqual(shown({ from: 10, to: 30, step: 5 }), ["10", "15", "20", "25", "30"]);
});

test("points、jumps、spans 回傳占整條線的比例位置，並保留標籤", () => {
  const r = scale({
    from: 0,
    to: 10,
    points: [{ at: 5, label: "中" }],
    jumps: [{ from: 2, to: 6, label: "+4" }],
    spans: [{ from: 2, to: 6 }],
  });
  assert.deepEqual(r.points, [{ at: 0.5, label: "中" }]);
  assert.deepEqual(r.jumps, [{ from: 0.2, to: 0.6, label: "+4" }]);
  assert.deepEqual(r.spans, [{ from: 0.2, to: 0.6, label: undefined }]);
});

test("數字用十進位字面精確解析：step 0.1 時 0.3 落在刻度上", () => {
  const r = scale({ from: 0, to: 1, step: 0.1, points: [{ at: 0.3 }] });
  assert.equal(r.ticks.length, 11);
  assert.equal(r.points[0].at, 0.3);
});

test("浮點誤差的結果（位數太多）會被擋下，但寫十進位字面就在", () => {
  rejectsMatch({ from: 0, to: 1, step: 0.1, points: [{ at: 0.1 + 0.7 }] }, /points\[0\]\.at（0\.7999999999999999）的位數太多，無法精確表示/);
  assert.doesNotThrow(() => scale({ from: 0, to: 1, step: 0.1, points: [{ at: 0.8 }] }));
});

test("\"2/4\" 與 \"1/2\" 是同一個位置", () => {
  const a = scale({ from: 0, to: 1, step: "1/4", points: [{ at: "2/4" }] });
  const b = scale({ from: 0, to: 1, step: "1/4", points: [{ at: "1/2" }] });
  assert.deepEqual(a.points, b.points);
  assert.equal(a.points[0].at, 0.5);
  assert.deepEqual(a.numbers.map((n) => n.at), [0, 0.25, 0.5, 0.75, 1]);
});

test("分數數線：分母沿用刻度的分母、不約分，整數刻度只寫整數", () => {
  assert.deepEqual(shown({ from: 0, to: 2, step: "1/4" }), ["0", "1/4", "2/4", "3/4", "1", "5/4", "6/4", "7/4", "2"]);
  assert.deepEqual(kinds({ from: 0, to: 1, step: "1/4" }), ["integer", "fraction", "fraction", "fraction", "integer"]);
  assert.deepEqual(shown({ from: "1/2", to: "5/2", step: "1/3" }).slice(0, 3), ["3/6", "5/6", "7/6"]);
});

test("疊排分數回傳分子與分母", () => {
  const label = scale({ from: 0, to: 1, step: "1/4" }).numbers[2].label;
  assert.deepEqual(label, { kind: "fraction", numerator: "2", denominator: "4" });
});

test("小數數線：step 是數字時標成十進位小數，整數刻度只寫整數", () => {
  assert.deepEqual(shown({ from: 0, to: 2, step: 0.5 }), ["0", "0.5", "1", "1.5", "2"]);
  assert.deepEqual(kinds({ from: 0, to: 1, step: 0.1 }).slice(0, 3), ["integer", "decimal", "decimal"]);
  assert.deepEqual(shown({ from: 0.2, to: 0.6, step: 0.1 }), ["0.2", "0.3", "0.4", "0.5", "0.6"]);
});

test("帶分數：mixed 開啟時大於 1 的分數刻度寫成整數加真分數", () => {
  const props = { from: 0, to: 2, step: "1/2", mixed: true };
  assert.deepEqual(shown(props), ["0", "1/2", "1", "1 1/2", "2"]);
  assert.deepEqual(scale(props).numbers[3].label, { kind: "mixed", whole: "1", numerator: "1", denominator: "2" });
  assert.deepEqual(shown({ ...props, step: "1/4", to: "3/2" }), ["0", "1/4", "2/4", "3/4", "1", "1 1/4", "1 2/4"]);
});

test("mixed 預設關閉：大於 1 的分數仍寫假分數", () => {
  assert.deepEqual(shown({ from: 0, to: "3/2", step: "1/2" }), ["0", "1/2", "1", "3/2"]);
});

test("分數與小數數線超過 10 段只標整數、兩端點與 points", () => {
  assert.deepEqual(shown({ from: 0, to: 3, step: "1/8", points: [{ at: "5/8" }] }), ["0", "5/8", "1", "2", "3"]);
  assert.deepEqual(shown({ from: 0, to: 1.5, step: 0.1, points: [{ at: 0.3 }] }), ["0", "0.3", "1", "1.5"]);
});

test("labelEvery 接受分數與小數，再加上兩端點與 points", () => {
  assert.deepEqual(shown({ from: 0, to: 3, step: "1/4", labelEvery: "1/2" }), ["0", "2/4", "1", "6/4", "2", "10/4", "3"]);
  assert.deepEqual(shown({ from: 0, to: 2, step: 0.25, labelEvery: 0.5 }), ["0", "0.5", "1", "1.5", "2"]);
  assert.deepEqual(shown({ from: 0, to: 1, step: "1/8", labelEvery: "1/2", points: [{ at: "1/8" }] }), ["0", "1/8", "4/8", "1"]);
});

test("文字標籤合計最多三個，刻度上的疊排分數不算", () => {
  const props = { from: 0, to: 2, step: "1/4", points: [{ at: "1/4", label: "甲" }], jumps: [{ from: 0, to: "1/2", label: "乙" }], spans: [{ from: 0, to: 1, label: "丙" }] };
  assert.doesNotThrow(() => scale(props));
  rejects({ ...props, spans: [{ from: 0, to: 1, label: "丙" }, { from: 1, to: 2, label: "丁" }] }, "<NumberLine> 圖內最多三個文字標籤，目前有 4 個");
});

test("hasStacked：有疊排標籤時為真，整數與小數數線為假", () => {
  assert.equal(scale({ from: 0, to: 1, step: "1/2" }).hasStacked, true);
  assert.equal(scale({ from: 0, to: 1, step: "1/1" }).hasStacked, false);
  assert.equal(scale({ from: 0, to: 1, step: 0.5 }).hasStacked, false);
  assert.equal(scale({ from: 0, to: 10 }).hasStacked, false);
});

test("分母為 0 丟中文錯誤", () => {
  rejects({ from: 0, to: 1, step: "1/0" }, '<NumberLine> 的 step（"1/0"）的分母不能是 0');
  rejects({ from: 0, to: 1, step: "1/2", points: [{ at: "1/0" }] }, '<NumberLine> 的 points[0].at（"1/0"）的分母不能是 0');
});

test("格式錯誤丟中文錯誤", () => {
  const bad = (value) => `<NumberLine> 的 from 必須是數字或 "a/b" 字串（整數分子、正整數分母），目前是 ${JSON.stringify(value)}`;
  for (const value of ["abc", "1/", "/2", "1.5/2", "1/-2", "1/2/3", "", "3", Number.NaN, Infinity, null]) {
    rejects({ from: value, to: 5 }, bad(value));
  }
});

test("step 必須大於 0", () => {
  rejects({ from: 0, to: 3, step: 0 }, "<NumberLine> 的 step 必須大於 0");
  rejects({ from: 0, to: 3, step: "-1/2" }, "<NumberLine> 的 step 必須大於 0");
});

test("from 必須小於 to", () => {
  rejects({ from: 3, to: 3 }, "<NumberLine> 的 from 必須小於 to");
  rejects({ from: "1/2", to: 0.25 }, "<NumberLine> 的 from 必須小於 to");
});

test("(to - from) 必須能被 step 整除", () => {
  rejects({ from: 0, to: 10, step: 3 }, "<NumberLine> 的 (to - from) 必須能被 step 整除");
  rejects({ from: 0, to: "1/2", step: "1/3" }, "<NumberLine> 的 (to - from) 必須能被 step 整除");
});

test("labelEvery 必須是 step 的正整數倍", () => {
  const message = "<NumberLine> 的 labelEvery 必須是 step 的正整數倍";
  rejects({ from: 0, to: 20, step: 5, labelEvery: 7 }, message);
  rejects({ from: 0, to: 20, labelEvery: 0 }, message);
  rejects({ from: 0, to: 20, labelEvery: 2.5 }, message);
  rejects({ from: 0, to: 2, step: "1/2", labelEvery: "1/3" }, message);
  rejects({ from: 0, to: 2, step: "1/2", labelEvery: "1/4" }, message);
});

test("step 是數字卻開 mixed 丟中文錯誤", () => {
  const message = '<NumberLine> 的 mixed 只能搭配 "a/b" 寫法的 step；step 是數字時不能開啟 mixed';
  rejects({ from: 0, to: 2, step: 0.5, mixed: true }, message);
  rejects({ from: 0, to: 2, step: 1, mixed: true }, message);
});

test("step 是數字時，刻度必須能寫成有限小數", () => {
  rejectsMatch({ from: "1/3", to: "4/3", step: 0.5 }, /刻度/);
});

test("位置必須落在範圍內的刻度上", () => {
  rejects({ from: 0, to: 10, points: [{ at: 11 }] }, "<NumberLine> 的 points[0].at（11）必須落在範圍內的刻度上");
  rejects({ from: 0, to: 10, points: [{ at: 1.5 }] }, "<NumberLine> 的 points[0].at（1.5）必須落在範圍內的刻度上");
  rejects(
    { from: 0, to: 10, step: 2, spans: [{ from: 0, to: 2 }, { from: 2, to: 5 }] },
    "<NumberLine> 的 spans[1].to（5）必須落在範圍內的刻度上",
  );
  rejects({ from: 2, to: 10, jumps: [{ from: 1, to: 4 }] }, "<NumberLine> 的 jumps[0].from（1）必須落在範圍內的刻度上");
  rejects({ from: 0, to: 1, step: "1/4", points: [{ at: "1/3" }] }, '<NumberLine> 的 points[0].at（"1/3"）必須落在範圍內的刻度上');
});

test("文字標籤合計最多三個", () => {
  const four = {
    from: 0,
    to: 10,
    points: [{ at: 1, label: "甲" }, { at: 2, label: "乙" }],
    jumps: [{ from: 0, to: 3, label: "丙" }],
    spans: [{ from: 0, to: 4, label: "丁" }, { from: 1, to: 2 }],
  };
  rejects(four, "<NumberLine> 圖內最多三個文字標籤，目前有 4 個");
  assert.doesNotThrow(() => scale({ ...four, spans: [{ from: 1, to: 2 }] }));
});

test("分數 step 與 labelEvery 必須寫成最簡分數，否則標籤的分母會被悄悄約掉", () => {
  rejects({ from: 0, to: 1, step: "2/4" }, '<NumberLine> 的 step（"2/4"）必須寫成最簡分數，例如 "1/2"（整數請直接寫數字）');
  rejects({ from: 0, to: 1, step: "1/4", labelEvery: "2/4" }, '<NumberLine> 的 labelEvery（"2/4"）必須寫成最簡分數，例如 "1/2"（整數請直接寫數字）');
  rejects({ from: 0, to: 2, step: "4/2" }, '<NumberLine> 的 step（"4/2"）必須寫成最簡分數，例如 "1/2"（整數請直接寫數字）');
  assert.doesNotThrow(() => scale({ from: 0, to: 2, step: "2/1" }));
  // from、to、位置不受限：它們只決定位置，不決定標籤的分母
  assert.doesNotThrow(() => scale({ from: "0/4", to: "4/4", step: "1/4", points: [{ at: "2/4" }] }));
});

// 負數：負號一律是數學減號 U+2212，不是連字號
const MINUS = "−";

test("負整數與負小數的標籤用 U+2212，0 沒有負號", () => {
  assert.deepEqual(shown({ from: -3, to: 3 }), [`${MINUS}3`, `${MINUS}2`, `${MINUS}1`, "0", "1", "2", "3"]);
  assert.deepEqual(shown({ from: -0.5, to: 0.5, step: 0.25 }), [`${MINUS}0.5`, `${MINUS}0.25`, "0", "0.25", "0.5"]);
  for (const text of shown({ from: -2, to: 1, step: 0.5 })) assert.ok(!text.includes("-"), text);
});

test("跨 0 的整數數線：0 的刻度是 isZero，位置依比例", () => {
  const r = scale({ from: -4, to: 4 });
  assert.deepEqual(r.ticks.map((t) => t.isZero), [false, false, false, false, true, false, false, false, false]);
  assert.equal(r.ticks[4].at, 0.5);
});

test("負分數標籤：負號與分數分開，分子分母為正，分母沿用刻度的分母、不約分", () => {
  const labels = scale({ from: -1, to: 1, step: "1/4" }).numbers.map((n) => n.label);
  assert.deepEqual(labels[1], { kind: "fraction", negative: true, numerator: "3", denominator: "4" });
  assert.deepEqual(labels[2], { kind: "fraction", negative: true, numerator: "2", denominator: "4" });
  assert.deepEqual(labels[3], { kind: "fraction", negative: true, numerator: "1", denominator: "4" });
  assert.deepEqual(labels[5], { kind: "fraction", numerator: "1", denominator: "4" });
  assert.deepEqual(labels[0], { kind: "integer", text: `${MINUS}1` });
  assert.equal(labels[4].text, "0");
});

test("跨 0 的分數刻度序列", () => {
  const signed = scale({ from: -1, to: 1, step: "1/2" }).numbers.map((n) => `${n.label.negative ? "-" : ""}${text(n.label).replace(MINUS, "-")}`);
  assert.deepEqual(signed, ["-1", "-1/2", "0", "1/2", "1"]);
  assert.deepEqual(kinds({ from: -1, to: 1, step: "1/2" }), ["integer", "fraction", "integer", "fraction", "integer"]);
});

test("mixed：絕對值大於 1 的負分數寫成帶分數，負號在整數部分左邊；−1/2 與 −2/2 不變", () => {
  const labels = scale({ from: -2, to: 0, step: "1/2", mixed: true }).numbers.map((n) => n.label);
  assert.deepEqual(labels[1], { kind: "mixed", negative: true, whole: "1", numerator: "1", denominator: "2" });
  assert.deepEqual(labels[2], { kind: "integer", text: `${MINUS}1` });
  assert.deepEqual(labels[3], { kind: "fraction", negative: true, numerator: "1", denominator: "2" });
  const quarter = scale({ from: "-3/2", to: -1, step: "1/2", mixed: true }).numbers.map((n) => n.label);
  assert.deepEqual(quarter[0], { kind: "mixed", negative: true, whole: "1", numerator: "1", denominator: "2" });
});

test("不開 mixed 時，−3/2 寫成負的假分數", () => {
  const labels = scale({ from: -2, to: 0, step: "1/2" }).numbers.map((n) => n.label);
  assert.deepEqual(labels[1], { kind: "fraction", negative: true, numerator: "3", denominator: "2" });
});

test("負的點落在刻度上，hasStacked 計入負分數", () => {
  const r = scale({ from: -1, to: 1, step: "1/2", points: [{ at: "-1/2" }] });
  assert.equal(r.points[0].at, 0.25);
  assert.equal(r.hasStacked, true);
  assert.equal(scale({ from: -3, to: 3 }).hasStacked, false);
});

test("超過 10 段的跨 0 整數數線只標 5 的倍數", () => {
  assert.deepEqual(shown({ from: -10, to: 10, step: 1 }).map((s) => s.replace(MINUS, "-")), ["-10", "-5", "0", "5", "10"]);
});

test("正數數線的標籤不變（沒有 negative 欄位）", () => {
  const labels = scale({ from: 0, to: 2, step: "1/2", mixed: true }).numbers.map((n) => n.label);
  assert.deepEqual(labels[1], { kind: "fraction", numerator: "1", denominator: "2" });
  assert.deepEqual(labels[3], { kind: "mixed", whole: "1", numerator: "1", denominator: "2" });
});

test("points、jumps、spans 的 label 裡連字號後面接數字會丟錯，要求改用 U+2212", () => {
  const base = { from: -5, to: 5 };
  const message = (where) => `<NumberLine> 的 ${where}.label（"-3"）裡的負號要用數學減號「−」（U+2212），不要用連字號「-」`;
  rejects({ ...base, points: [{ at: 0, label: "-3" }] }, message("points[0]"));
  rejects({ ...base, jumps: [{ from: 0, to: 1, label: "-3" }] }, message("jumps[0]"));
  rejects({ ...base, spans: [{ from: 0, to: 1, label: "-3" }] }, message("spans[0]"));
  rejectsMatch({ ...base, points: [{ at: 0, label: "5 -2" }] }, /U\+2212/);
});

test("label 用 U+2212 的負號可以通過；連字號後面不是數字的文字不擋", () => {
  const base = { from: -5, to: 5 };
  assert.doesNotThrow(() => scale({ ...base, points: [{ at: 0, label: "−3" }], jumps: [{ from: 0, to: 1, label: "5 − 2" }] }));
  assert.doesNotThrow(() => scale({ ...base, points: [{ at: 0, label: "A-B" }], spans: [{ from: 0, to: 1, label: "- 3" }] }));
});
