import { test } from "node:test";
import assert from "node:assert/strict";
import { recentlyUpdated } from "../src/lib/recent-lessons.ts";

// 首頁「最近撰寫或更新」：輸入依建議閱讀順序，依教材的 updated 由新到舊取前幾個單元。
const updatedOf = (unit) => unit.updated;
const ids = (units) => units.map((u) => u.id);

test("依 updated 由新到舊排序", () => {
  const units = [
    { id: "a", updated: "2026-10-01" },
    { id: "b", updated: "2026-10-10" },
    { id: "c", updated: "2026-09-20" },
  ];
  assert.deepEqual(ids(recentlyUpdated(units, updatedOf, 6)), ["b", "a", "c"]);
});

test("只取前 limit 個", () => {
  const units = Array.from({ length: 8 }, (_, i) => ({ id: `u${i}`, updated: `2026-10-0${i + 1}` }));
  assert.deepEqual(ids(recentlyUpdated(units, updatedOf, 6)), ["u7", "u6", "u5", "u4", "u3", "u2"]);
});

test("同一天依建議閱讀順序；沒有 updated 的排在最後", () => {
  const units = [{ id: "x" }, { id: "a", updated: "2026-10-01" }, { id: "b", updated: "2026-10-01" }, { id: "y" }];
  assert.deepEqual(ids(recentlyUpdated(units, updatedOf, 6)), ["a", "b", "x", "y"]);
});

test("不改動輸入陣列", () => {
  const units = [{ id: "a", updated: "2026-09-01" }, { id: "b", updated: "2026-10-01" }];
  recentlyUpdated(units, updatedOf, 6);
  assert.deepEqual(ids(units), ["a", "b"]);
});
