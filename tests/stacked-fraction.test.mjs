import { test } from "node:test";
import assert from "node:assert/strict";
import { isStacked, stackedFractionLayout, stackedFractionWidth, textWidth, STACKED_HEIGHT } from "../src/lib/stacked-fraction.ts";

test("分子在分數線上方、分母在下方，三者都置中於 cx", () => {
  const l = stackedFractionLayout({ numerator: "1", denominator: "2" }, 100, 50);
  assert.equal(l.whole, undefined);
  assert.equal(l.numerator.x, 100);
  assert.equal(l.denominator.x, 100);
  assert.ok(l.numerator.y < l.bar.y && l.bar.y < l.denominator.y);
  assert.ok(l.bar.y > 50 && l.denominator.y < 50 + STACKED_HEIGHT);
  assert.equal((l.bar.x1 + l.bar.x2) / 2, 100);
});

test("分數線比較長的那一邊多一點，位數多就變寬", () => {
  const short = stackedFractionLayout({ numerator: "1", denominator: "2" }, 0, 0);
  const long = stackedFractionLayout({ numerator: "11", denominator: "16" }, 0, 0);
  assert.ok(long.bar.x2 - long.bar.x1 > short.bar.x2 - short.bar.x1);
  assert.ok(short.bar.x2 - short.bar.x1 > 13);
});

test("帶分數：整數部分在左，與疊排真分數並排，整體置中於 cx，整數與分數線同高", () => {
  const l = stackedFractionLayout({ whole: "1", numerator: "1", denominator: "2" }, 100, 0);
  assert.ok(l.whole);
  assert.ok(l.whole.x < l.numerator.x);
  assert.ok(l.whole.x + l.whole.width / 2 < l.bar.x1);
  // 整體左右緣對稱於 cx
  const left = l.whole.x - l.whole.width / 2;
  const right = l.bar.x2;
  assert.ok(Math.abs(100 - left - (right - 100)) < 1e-9);
  assert.ok(l.whole.y > l.bar.y && l.whole.y < l.denominator.y);
});

test("整體寬度等於版面左右緣的距離，純文字的寬度用同一個字寬估計", () => {
  const parts = { whole: "1", numerator: "3", denominator: "16" };
  const l = stackedFractionWidth(parts);
  const layout = stackedFractionLayout(parts, 100, 0);
  assert.equal(layout.bar.x2 - (layout.whole.x - layout.whole.width / 2), l);
  assert.equal(textWidth("12"), 2 * textWidth("1"));
});

test("isStacked：分數與帶分數要疊排，整數與小數不用", () => {
  assert.equal(isStacked({ kind: "fraction", numerator: "1", denominator: "2" }), true);
  assert.equal(isStacked({ kind: "mixed", whole: "1", numerator: "1", denominator: "2" }), true);
  assert.equal(isStacked({ kind: "integer", text: "1" }), false);
  assert.equal(isStacked({ kind: "decimal", text: "0.5" }), false);
});

test("負號畫在整個疊排分數左邊，與分數線同高，不蓋住分數", () => {
  const l = stackedFractionLayout({ negative: true, numerator: "1", denominator: "2" }, 100, 0);
  assert.ok(l.sign);
  assert.equal(l.sign.text, "−");
  assert.ok(l.sign.x + l.sign.width / 2 <= l.bar.x1);
  // 文字以基線定位，22px 數字的視覺中心落在分數線高度，與整數部分同一條基線
  const withWhole = stackedFractionLayout({ negative: true, whole: "1", numerator: "1", denominator: "2" }, 100, 0);
  assert.equal(l.sign.y, withWhole.sign.y);
  assert.equal(l.sign.y, withWhole.whole.y);
  assert.ok(l.sign.y > l.bar.y && l.sign.y < l.denominator.y);
});

test("帶分數的負號在整數部分左邊，整體（含負號）置中於 cx，寬度含負號", () => {
  const parts = { negative: true, whole: "1", numerator: "1", denominator: "2" };
  const l = stackedFractionLayout(parts, 100, 0);
  assert.ok(l.sign.x < l.whole.x);
  assert.ok(l.sign.x + l.sign.width / 2 <= l.whole.x - l.whole.width / 2);
  const left = l.sign.x - l.sign.width / 2;
  assert.ok(Math.abs(100 - left - (l.bar.x2 - 100)) < 1e-9);
  assert.equal(l.bar.x2 - left, stackedFractionWidth(parts));
  assert.ok(stackedFractionWidth(parts) > stackedFractionWidth({ whole: "1", numerator: "1", denominator: "2" }));
});

test("沒有負號時版面完全不變，也沒有 sign", () => {
  const l = stackedFractionLayout({ numerator: "1", denominator: "2" }, 100, 50);
  assert.equal(l.sign, undefined);
  assert.equal(stackedFractionWidth({ numerator: "1", denominator: "2" }), textWidth("1") + 8);
});

test("isStacked：帶負號的分數與帶分數也要疊排", () => {
  assert.equal(isStacked({ kind: "fraction", negative: true, numerator: "1", denominator: "2" }), true);
  assert.equal(isStacked({ kind: "mixed", negative: true, whole: "1", numerator: "1", denominator: "2" }), true);
});
