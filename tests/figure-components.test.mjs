import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { figureIssues } from "../src/lib/figure-rules.ts";

// 共用教具在 src/components/figures/，不在內容根目錄，內容驗證掃不到；這裡用同一套教具規則（title／desc、色票允許清單）檢查。
const dir = "src/components/figures";
const sources = readdirSync(dir)
  .filter((name) => name.endsWith(".astro"))
  .sort()
  .map((name) => ({ path: join(dir, name), file: join(dir, name), text: readFileSync(join(dir, name), "utf8") }));

test("共用教具目錄有 NumberLine、Counters、FractionBar、Shape、UnitGrid、AreaModel 與 BalanceScale", () => {
  const names = sources.map((s) => s.path);
  assert.ok(names.includes(join(dir, "NumberLine.astro")), names.join(", "));
  assert.ok(names.includes(join(dir, "Counters.astro")), names.join(", "));
  assert.ok(names.includes(join(dir, "FractionBar.astro")), names.join(", "));
  assert.ok(names.includes(join(dir, "Shape.astro")), names.join(", "));
  assert.ok(names.includes(join(dir, "CoordPlane.astro")), names.join(", "));
  assert.ok(names.includes(join(dir, "UnitGrid.astro")), names.join(", "));
  assert.ok(names.includes(join(dir, "AreaModel.astro")), names.join(", "));
  assert.ok(names.includes(join(dir, "BalanceScale.astro")), names.join(", "));
});

test("共用教具都通過教具規則：每個 <svg> 有 <title> 與 <desc>，顏色只用色票 token", () => {
  assert.deepEqual(figureIssues(sources, []), []);
});
