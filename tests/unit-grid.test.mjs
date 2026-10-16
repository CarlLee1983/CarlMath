import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveUnitGrid } from "../src/lib/unit-grid.ts";

const rejects = (input, message) => assert.throws(() => resolveUnitGrid(input), (e) => e instanceof Error && e.message === message);

test("合格的方格：沒有塗色時 cells 為空、沒有外框", () => {
  const grid = resolveUnitGrid({ rows: 3, cols: 4 });
  assert.equal(grid.rows, 3);
  assert.equal(grid.cols, 4);
  assert.deepEqual(grid.cells, []);
  assert.equal(grid.outline, undefined);
  assert.deepEqual(grid.labels, []);
});

test("邊界值合格：12 列 × 10 行與 1 × 1", () => {
  assert.equal(resolveUnitGrid({ rows: 12, cols: 10 }).rows, 12);
  assert.equal(resolveUnitGrid({ rows: 1, cols: 1 }).cols, 1);
});

test("超過 12 列 × 10 行、或不是正整數，丟中文錯誤", () => {
  rejects({ rows: 13, cols: 10 }, "<UnitGrid> 的 rows 必須是 1 到 12 的整數，目前是 13");
  rejects({ rows: 12, cols: 11 }, "<UnitGrid> 的 cols 必須是 1 到 10 的整數，目前是 11");
  rejects({ rows: 0, cols: 3 }, "<UnitGrid> 的 rows 必須是 1 到 12 的整數，目前是 0");
  rejects({ rows: 3, cols: 2.5 }, "<UnitGrid> 的 cols 必須是 1 到 10 的整數，目前是 2.5");
  rejects({ rows: "3", cols: 3 }, '<UnitGrid> 的 rows 必須是 1 到 12 的整數，目前是 "3"');
});

test("長方形塗色：cells 依列、行順序列出，從 0 起算、列由上往下", () => {
  const grid = resolveUnitGrid({ rows: 4, cols: 5, rects: [{ row: 1, col: 2, rows: 2, cols: 2 }] });
  assert.deepEqual(grid.cells, [[1, 2], [1, 3], [2, 2], [2, 3]]);
});

test("長方形寫法與等價的逐格寫法，塗色結果相同；兩種並用、重疊的格只算一次", () => {
  const byRect = resolveUnitGrid({ rows: 4, cols: 5, rects: [{ row: 0, col: 0, rows: 2, cols: 3 }] });
  const byCells = resolveUnitGrid({ rows: 4, cols: 5, cells: [[1, 2], [0, 0], [0, 1], [0, 2], [1, 0], [1, 1]] });
  assert.deepEqual(byRect.cells, byCells.cells);
  const mixed = resolveUnitGrid({ rows: 4, cols: 5, rects: [{ row: 0, col: 0, rows: 2, cols: 3 }], cells: [[1, 2], [3, 4]] });
  assert.deepEqual(mixed.cells, [...byRect.cells, [3, 4]]);
});

test("長方形超出範圍或寫法不合，丟中文錯誤", () => {
  const grid = { rows: 3, cols: 4 };
  rejects({ ...grid, rects: [{ row: 2, col: 0, rows: 2, cols: 1 }] }, "<UnitGrid> 的 rects[0] 超出 3 列 × 4 行的方格範圍");
  rejects({ ...grid, rects: [{ row: 0, col: 0, rows: 1, cols: 1 }, { row: 0, col: 3, rows: 1, cols: 2 }] }, "<UnitGrid> 的 rects[1] 超出 3 列 × 4 行的方格範圍");
  rejects({ ...grid, rects: [{ row: -1, col: 0, rows: 1, cols: 1 }] }, "<UnitGrid> 的 rects[0] 必須是 { row, col, rows, cols }：row、col 是 0 以上的整數，rows、cols 是 1 以上的整數");
  rejects({ ...grid, rects: [{ row: 0, col: 0, rows: 0, cols: 1 }] }, "<UnitGrid> 的 rects[0] 必須是 { row, col, rows, cols }：row、col 是 0 以上的整數，rows、cols 是 1 以上的整數");
  rejects({ ...grid, rects: [{ row: 0, col: 0.5, rows: 1, cols: 1 }] }, "<UnitGrid> 的 rects[0] 必須是 { row, col, rows, cols }：row、col 是 0 以上的整數，rows、cols 是 1 以上的整數");
});

test("逐格塗色超出範圍或寫法不合，丟中文錯誤", () => {
  const grid = { rows: 3, cols: 4 };
  rejects({ ...grid, cells: [[0, 0], [3, 0]] }, "<UnitGrid> 的 cells[1]（第 3 列、第 0 行）超出 3 列 × 4 行的方格範圍");
  rejects({ ...grid, cells: [[0, 4]] }, "<UnitGrid> 的 cells[0]（第 0 列、第 4 行）超出 3 列 × 4 行的方格範圍");
  rejects({ ...grid, cells: [[-1, 0]] }, "<UnitGrid> 的 cells[0]（第 -1 列、第 0 行）超出 3 列 × 4 行的方格範圍");
  rejects({ ...grid, cells: [[0]] }, "<UnitGrid> 的 cells[0] 必須是 [row, col] 兩個整數");
  rejects({ ...grid, cells: [[0, 1.5]] }, "<UnitGrid> 的 cells[0] 必須是 [row, col] 兩個整數");
});

test("外框：長方形的周長格數是 2 × (長 + 寬)，四條邊各合併成一段", () => {
  const grid = resolveUnitGrid({ rows: 5, cols: 6, rects: [{ row: 1, col: 1, rows: 2, cols: 3 }], perimeter: true });
  assert.equal(grid.outline.length, 10);
  assert.equal(grid.outline.segments.length, 4);
  const total = grid.outline.segments.reduce((sum, s) => sum + Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1), 0);
  assert.equal(total, 10);
});

test("外框：不規則的 L 形沿實際邊界走，周長格數正確（L 形的周長等於外接長方形）", () => {
  // 3 × 3 的外接長方形缺右上 2 × 2：塗 5 格
  const grid = resolveUnitGrid({ rows: 3, cols: 3, cells: [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], perimeter: true });
  assert.equal(grid.outline.length, 12);
  assert.equal(grid.outline.segments.length, 6);
  // 線段端點是格線交點 (x = 行、y = 列)，起點一律小於終點；六段正好圍出 L 形，凹角的 (1,0)-(1,2) 與 (1,2)-(3,2) 都在
  const keys = grid.outline.segments.map((s) => [s.x1, s.y1, s.x2, s.y2].join()).sort();
  assert.deepEqual(keys, ["0,0,0,3", "0,0,1,0", "0,3,3,3", "1,0,1,2", "1,2,3,2", "3,2,3,3"]);
});

test("外框：凹進去的形狀，周長比外接長方形多（凹口的邊都算）", () => {
  // 3 × 3 缺中間上方一格：塗 8 格，周長 12 + 2 = 14
  const cells = [[0, 0], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]];
  assert.equal(resolveUnitGrid({ rows: 3, cols: 3, cells, perimeter: true }).outline.length, 14);
});

test("外框：分開的兩塊各自描邊；中間挖空的洞，洞的邊也算", () => {
  const two = resolveUnitGrid({ rows: 1, cols: 5, cells: [[0, 0], [0, 4]], perimeter: true });
  assert.equal(two.outline.length, 8);
  const ring = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (r !== 1 || c !== 1) ring.push([r, c]);
  assert.equal(resolveUnitGrid({ rows: 3, cols: 3, cells: ring, perimeter: true }).outline.length, 16);
});

test("外框：沒有 perimeter 就沒有外框；要外框卻沒有塗色，丟中文錯誤", () => {
  assert.equal(resolveUnitGrid({ rows: 2, cols: 2, cells: [[0, 0]] }).outline, undefined);
  rejects({ rows: 2, cols: 2, perimeter: true }, "<UnitGrid> 要描周長外框，必須先有塗色的格子（rects 或 cells）");
  rejects({ rows: 2, cols: 2, cells: [[0, 0]], perimeter: "yes" }, "<UnitGrid> 的 perimeter 必須是 true 或 false");
});

test("標籤：數字是格數，字串是文字標籤；位置落在塗色區外接範圍（沒塗色則整個方格）", () => {
  const grid = resolveUnitGrid({
    rows: 5, cols: 6, rects: [{ row: 1, col: 1, rows: 2, cols: 3 }],
    labels: [{ side: "top", text: 3 }, { side: "left", text: 2 }, { side: "right", text: "寬" }],
  });
  assert.deepEqual(grid.labels, [
    { side: "top", kind: "count", text: "3" },
    { side: "left", kind: "count", text: "2" },
    { side: "right", kind: "text", text: "寬" },
  ]);
  assert.deepEqual(grid.bounds, { row0: 1, col0: 1, row1: 3, col1: 4 });
  assert.deepEqual(resolveUnitGrid({ rows: 5, cols: 6 }).bounds, { row0: 0, col0: 0, row1: 5, col1: 6 });
});

test("文字標籤超過 3 個丟錯；格數標籤不算文字標籤", () => {
  const text = (side, t) => ({ side, text: t });
  const four = [text("top", "甲"), text("bottom", "乙"), text("left", "丙"), text("right", "丁")];
  rejects({ rows: 3, cols: 3, labels: four }, "<UnitGrid> 圖內最多三個文字標籤，目前有 4 個");
  const withCount = [...four.slice(0, 3), text("right", 5)];
  assert.equal(resolveUnitGrid({ rows: 3, cols: 3, labels: withCount }).labels.length, 4);
});

test("標籤寫法不合，丟中文錯誤", () => {
  rejects({ rows: 3, cols: 3, labels: [{ side: "middle", text: 3 }] }, '<UnitGrid> 的 labels[0].side 必須是 "top"、"bottom"、"left" 或 "right"');
  rejects({ rows: 3, cols: 3, labels: [{ side: "top", text: 0 }] }, "<UnitGrid> 的 labels[0].text 必須是 1 到 99 的整數（格數）或 1 到 3 個字的文字");
  rejects({ rows: 3, cols: 3, labels: [{ side: "top", text: 1.5 }] }, "<UnitGrid> 的 labels[0].text 必須是 1 到 99 的整數（格數）或 1 到 3 個字的文字");
  rejects({ rows: 3, cols: 3, labels: [{ side: "top", text: "" }] }, "<UnitGrid> 的 labels[0].text 必須是 1 到 99 的整數（格數）或 1 到 3 個字的文字");
  rejects({ rows: 3, cols: 3, labels: [{ side: "top", text: "周長是多少" }] }, "<UnitGrid> 的 labels[0].text 必須是 1 到 99 的整數（格數）或 1 到 3 個字的文字");
  rejects({ rows: 3, cols: 3, labels: [{ side: "top", text: 3 }, { side: "top", text: 4 }] }, "<UnitGrid> 的 labels[1] 與 labels[0] 標在同一邊（top），每邊最多一個標籤");
});
