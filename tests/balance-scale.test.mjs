import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveBalanceScale } from "../src/lib/balance-scale.ts";

const rejects = (input, message) => assert.throws(() => resolveBalanceScale(input), (e) => e instanceof Error && e.message === message);
const counts = (pan) => ({
  x: pan.items.filter((i) => i.kind === "x").length,
  units: pan.items.filter((i) => i.kind === "unit").length,
  removed: pan.items.filter((i) => i.removed).length,
});

test("平衡：兩邊橫樑等高、左右對稱，每盤的盒子與砝碼個數照參數", () => {
  const s = resolveBalanceScale({ left: { x: 2, units: 3 }, right: { x: 0, units: 5 } });
  assert.equal(s.tilt, undefined);
  assert.equal(s.beam.y1, s.beam.y2);
  assert.ok(Math.abs(s.pivot.x - s.beam.x1 - (s.beam.x2 - s.pivot.x)) < 1e-9);
  assert.deepEqual(counts(s.pans[0]), { x: 2, units: 3, removed: 0 });
  assert.deepEqual(counts(s.pans[1]), { x: 0, units: 5, removed: 0 });
});

test("x 盒子排在砝碼前面，同一盤物件的位置不重疊", () => {
  const s = resolveBalanceScale({ left: { x: 2, units: 3 }, right: { x: 1, units: 0 } });
  assert.deepEqual(s.pans[0].items.map((i) => i.kind), ["x", "x", "unit", "unit", "unit"]);
  const xs = s.pans[0].items.map((i) => i.cx);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] - xs[i - 1] >= s.size);
});

test("一盤超過 5 個換排，物件都落在秤盤寬度與吊桿之內", () => {
  const s = resolveBalanceScale({ left: { x: 4, units: 6 }, right: { x: 1, units: 0 } });
  const pan = s.pans[0];
  assert.equal(new Set(pan.items.map((i) => i.cy)).size, 2);
  for (const item of pan.items) {
    assert.ok(item.cx - s.size / 2 >= pan.cx - s.panWidth / 2);
    assert.ok(item.cx + s.size / 2 <= pan.cx + s.panWidth / 2);
    assert.ok(item.cy - s.size / 2 > pan.hangerY);
    assert.ok(item.cy + s.size / 2 <= pan.plateY);
  }
});

test("tilt：指定的那一邊較重、橫樑那端與秤盤都比較低；固定角度，與個數無關", () => {
  const l = resolveBalanceScale({ left: { x: 1, units: 0 }, right: { x: 1, units: 0 }, tilt: "left" });
  assert.ok(l.beam.y1 > l.beam.y2);
  assert.ok(l.pans[0].plateY > l.pans[1].plateY);
  const r = resolveBalanceScale({ left: { x: 1, units: 0 }, right: { x: 9, units: 0 }, tilt: "right" });
  assert.ok(r.beam.y2 > r.beam.y1);
  const again = resolveBalanceScale({ left: { x: 5, units: 5 }, right: { x: 1, units: 0 }, tilt: "left" });
  assert.equal(again.beam.y1 - again.beam.y2, l.beam.y1 - l.beam.y2);
});

test("所有座標都在 viewBox 內（含傾斜、兩排物件）", () => {
  for (const tilt of [undefined, "left", "right"]) {
    const s = resolveBalanceScale({ left: { x: 5, units: 5 }, right: { x: 5, units: 5 }, tilt });
    for (const pan of s.pans) {
      assert.ok(pan.cx - s.panWidth / 2 >= 0 && pan.cx + s.panWidth / 2 <= s.width);
      assert.ok(pan.plateY < s.base.y && s.base.y < s.height);
    }
    assert.ok(Math.min(s.beam.y1, s.beam.y2) >= 0);
  }
});

test("removed：拿掉的物件排在同類之後，數量照參數，仍佔位", () => {
  const s = resolveBalanceScale({
    left: { x: 3, units: 4 }, right: { x: 1, units: 2 },
    removed: { left: { x: 1, units: 2 }, right: { units: 1 } },
  });
  assert.deepEqual(counts(s.pans[0]), { x: 3, units: 4, removed: 3 });
  assert.deepEqual(s.pans[0].items.map((i) => i.removed), [false, false, true, false, false, true, true]);
  assert.deepEqual(counts(s.pans[1]), { x: 1, units: 2, removed: 1 });
});

test("removed 可以拿光，但不得超過該盤原有的數量", () => {
  assert.equal(counts(resolveBalanceScale({ left: { x: 1, units: 0 }, right: { x: 0, units: 2 }, removed: { right: { units: 2 } } }).pans[1]).removed, 2);
  const base = { left: { x: 1, units: 2 }, right: { x: 1, units: 2 } };
  rejects({ ...base, removed: { left: { x: 2 } } }, "<BalanceScale> 的 removed.left.x 是 2，超過 left 盤原有的 1 個 x 盒子");
  rejects({ ...base, removed: { right: { units: 3 } } }, "<BalanceScale> 的 removed.right.units 是 3，超過 right 盤原有的 2 個砝碼");
  rejects({ ...base, removed: { left: { x: -1 } } }, '<BalanceScale> 的 removed.left 必須是 { x?, units? }，數量是 0 以上的整數，目前是 {"x":-1}');
  rejects({ ...base, removed: { left: { units: 0.5 } } }, '<BalanceScale> 的 removed.left 必須是 { x?, units? }，數量是 0 以上的整數，目前是 {"units":0.5}');
});

test("單盤合計超過 10 個，丟中文錯誤；10 個合格", () => {
  assert.equal(resolveBalanceScale({ left: { x: 4, units: 6 }, right: { x: 0, units: 10 } }).pans[1].items.length, 10);
  rejects({ left: { x: 6, units: 5 }, right: { x: 1, units: 0 } }, "<BalanceScale> 的 left 一盤合計最多 10 個物件，目前有 11 個");
  rejects({ left: { x: 1, units: 0 }, right: { x: 0, units: 11 } }, "<BalanceScale> 的 right 一盤合計最多 10 個物件，目前有 11 個");
});

test("數量不是非負整數，丟中文錯誤", () => {
  const msg = (pan) => `<BalanceScale> 的 left 必須是 { x, units }，x、units 都是 0 以上的整數，目前是 ${JSON.stringify(pan)}`;
  const ok = { x: 1, units: 0 };
  for (const bad of [{ x: -1, units: 2 }, { x: 1.5, units: 2 }, { x: "2", units: 1 }, { x: 1 }]) {
    rejects({ left: bad, right: ok }, msg(bad));
  }
  rejects({ left: ok, right: { x: 1, units: -3 } }, '<BalanceScale> 的 right 必須是 { x, units }，x、units 都是 0 以上的整數，目前是 {"x":1,"units":-3}');
});

test("一盤沒有物件，丟中文錯誤", () => {
  rejects({ left: { x: 0, units: 0 }, right: { x: 1, units: 0 } }, "<BalanceScale> 的 left 至少要有一個物件（x 盒子或砝碼）");
  rejects({ left: { x: 1, units: 0 }, right: { x: 0, units: 0 } }, "<BalanceScale> 的 right 至少要有一個物件（x 盒子或砝碼）");
});

test("tilt 只接受 left 或 right", () => {
  const pans = { left: { x: 1, units: 0 }, right: { x: 1, units: 0 } };
  rejects({ ...pans, tilt: "up" }, '<BalanceScale> 的 tilt 必須是 "left" 或 "right"，目前是 "up"');
  rejects({ ...pans, tilt: "" }, '<BalanceScale> 的 tilt 必須是 "left" 或 "right"，目前是 ""');
  rejects({ ...pans, tilt: null }, '<BalanceScale> 的 tilt 必須是 "left" 或 "right"，目前是 null');
});
