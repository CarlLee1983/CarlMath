import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveNumberLine } from "../src/lib/number-line-scale.ts";

const scale = (props) => resolveNumberLine({ step: 1, ...props });

test("10 段以內每格都標數字", () => {
  const r = scale({ from: 0, to: 10 });
  assert.deepEqual(r.ticks, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(r.numbers, r.ticks);
});

test("超過 10 段只標 5 的倍數，加上兩端點與 points", () => {
  const r = scale({ from: 0, to: 12, points: [{ at: 7 }] });
  assert.equal(r.ticks.length, 13);
  assert.deepEqual(r.numbers, [0, 5, 7, 10, 12]);
});

test("labelEvery 指定時只標它的倍數，加上兩端點", () => {
  const r = scale({ from: 0, to: 20, labelEvery: 10 });
  assert.deepEqual(r.numbers, [0, 10, 20]);
  assert.deepEqual(scale({ from: 3, to: 9, labelEvery: 2 }).numbers, [3, 4, 6, 8, 9]);
});

test("非 0 起點、step 大於 1 的刻度序列", () => {
  assert.deepEqual(scale({ from: 10, to: 30, step: 5 }).ticks, [10, 15, 20, 25, 30]);
});

const rejects = (props, message) =>
  assert.throws(() => scale(props), (e) => e instanceof Error && e.message === message);

test("from、to、step 必須是整數", () => {
  rejects({ from: 0.5, to: 3 }, "<NumberLine> 的 from、to、step 必須是整數");
  rejects({ from: 0, to: 3, step: Number.NaN }, "<NumberLine> 的 from、to、step 必須是整數");
});

test("step 必須大於 0", () => {
  rejects({ from: 0, to: 3, step: 0 }, "<NumberLine> 的 step 必須大於 0");
  rejects({ from: 0, to: 3, step: -1 }, "<NumberLine> 的 step 必須大於 0");
});

test("from 必須小於 to", () => {
  rejects({ from: 3, to: 3 }, "<NumberLine> 的 from 必須小於 to");
  rejects({ from: 5, to: 3 }, "<NumberLine> 的 from 必須小於 to");
});

test("(to - from) 必須能被 step 整除", () => {
  rejects({ from: 0, to: 10, step: 3 }, "<NumberLine> 的 (to - from) 必須能被 step 整除");
});

test("labelEvery 必須是 step 的正整數倍", () => {
  const message = "<NumberLine> 的 labelEvery 必須是 step 的正整數倍";
  rejects({ from: 0, to: 20, step: 5, labelEvery: 7 }, message);
  rejects({ from: 0, to: 20, labelEvery: 0 }, message);
  rejects({ from: 0, to: 20, labelEvery: 2.5 }, message);
});

test("points、jumps、spans 的位置必須是整數", () => {
  rejects({ from: 0, to: 10, points: [{ at: 1.5 }] }, "<NumberLine> 的 points[0].at 必須是整數");
  rejects({ from: 0, to: 10, jumps: [{ from: 1, to: "3" }] }, "<NumberLine> 的 jumps[0].to 必須是整數");
});

test("位置必須落在範圍內的刻度上", () => {
  rejects({ from: 0, to: 10, points: [{ at: 11 }] }, "<NumberLine> 的 points[0].at（11）必須落在範圍內的刻度上");
  rejects(
    { from: 0, to: 10, step: 2, spans: [{ from: 0, to: 2 }, { from: 2, to: 5 }] },
    "<NumberLine> 的 spans[1].to（5）必須落在範圍內的刻度上",
  );
  rejects({ from: 2, to: 10, jumps: [{ from: 1, to: 4 }] }, "<NumberLine> 的 jumps[0].from（1）必須落在範圍內的刻度上");
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
