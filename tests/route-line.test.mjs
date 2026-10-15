import { test } from "node:test";
import assert from "node:assert/strict";
import { nextWritten } from "../src/scripts/route-line.ts";

const stops = [1, 2, 3, 4, 5].map((sequence) => ({ sequence, written: sequence === 2 || sequence === 4 }));

test("下一篇已撰寫：跳到目前位置之後的第一篇", () => {
  assert.equal(nextWritten(stops, 1), 2);
  assert.equal(nextWritten(stops, 2), 4);
});

test("下一篇已撰寫：後面沒有就回到第一篇", () => {
  assert.equal(nextWritten(stops, 4), 2);
  assert.equal(nextWritten(stops, 5), 2);
});

test("下一篇已撰寫：整條路線都沒寫時停在第一個單元", () => {
  assert.equal(nextWritten(stops.map((s) => ({ ...s, written: false })), 3), 1);
});
