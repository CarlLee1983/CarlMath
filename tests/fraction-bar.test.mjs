import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveFractionBars } from "../src/lib/fraction-bar.ts";

const rejects = (bars, message) => assert.throws(() => resolveFractionBars(bars), (e) => e instanceof Error && e.message === message);

test("合格的分數條：回傳份數、塗色數與標籤", () => {
  assert.deepEqual(resolveFractionBars([{ parts: 4, shaded: 3 }]), [{ parts: 4, shaded: 3, label: undefined }]);
});

test("label 是 \"a/b\" 字串時為疊排分數，照原樣不約分；是整數時為純文字", () => {
  const [a, b, c] = resolveFractionBars([
    { parts: 4, shaded: 2, label: "2/4" },
    { parts: 1, shaded: 1, label: 1 },
    { parts: 5, shaded: 0, label: "0/5" },
  ]);
  assert.deepEqual(a.label, { kind: "fraction", numerator: "2", denominator: "4" });
  assert.deepEqual(b.label, { kind: "integer", text: "1" });
  assert.deepEqual(c.label, { kind: "fraction", numerator: "0", denominator: "5" });
});

test("邊界值合格：1 條與 4 條、parts 1 與 24、shaded 0 與 parts", () => {
  assert.equal(resolveFractionBars([{ parts: 1, shaded: 0 }]).length, 1);
  assert.equal(resolveFractionBars(Array(4).fill({ parts: 24, shaded: 24 })).length, 4);
});

test("條數必須是 1 到 4", () => {
  rejects([], "<FractionBar> 的 bars 必須有 1 到 4 條，目前有 0 條");
  rejects(Array(5).fill({ parts: 2, shaded: 1 }), "<FractionBar> 的 bars 必須有 1 到 4 條，目前有 5 條");
  rejects(undefined, "<FractionBar> 的 bars 必須有 1 到 4 條，目前有 0 條");
});

test("parts 必須是 1 到 24 的整數", () => {
  const message = (i) => `<FractionBar> 的 bars[${i}].parts 必須是 1 到 24 的整數`;
  rejects([{ parts: 0, shaded: 0 }], message(0));
  rejects([{ parts: 25, shaded: 0 }], message(0));
  rejects([{ parts: 2, shaded: 1 }, { parts: 2.5, shaded: 1 }], message(1));
  rejects([{ parts: "4", shaded: 1 }], message(0));
});

test("shaded 必須是 0 到 parts 的整數（不支援假分數）", () => {
  const message = (i, parts) => `<FractionBar> 的 bars[${i}].shaded 必須是 0 到 parts（${parts}）的整數`;
  rejects([{ parts: 4, shaded: 5 }], message(0, 4));
  rejects([{ parts: 4, shaded: -1 }], message(0, 4));
  rejects([{ parts: 4, shaded: 1.5 }], message(0, 4));
  rejects([{ parts: 3, shaded: 1 }, { parts: 3, shaded: 4 }], message(1, 3));
});

test("label 必須是 \"a/b\" 字串或整數，分母不能是 0", () => {
  const format = (i, value) => `<FractionBar> 的 bars[${i}].label 必須是整數或 "a/b" 字串（整數分子、正整數分母），目前是 ${JSON.stringify(value)}`;
  for (const value of ["abc", "1/", "1.5/2", "1/-2", "3", 0.5, Number.NaN]) rejects([{ parts: 4, shaded: 1, label: value }], format(0, value));
  rejects([{ parts: 4, shaded: 1, label: "1/0" }], '<FractionBar> 的 bars[0].label（"1/0"）的分母不能是 0');
});

test("label 超過安全整數丟中文錯誤，不默默失去精度", () => {
  rejects([{ parts: 4, shaded: 1, label: "9007199254740993/2" }], '<FractionBar> 的 bars[0].label（"9007199254740993/2"）的位數太多，無法精確表示');
});
