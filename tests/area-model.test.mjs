import { test } from "node:test";
import assert from "node:assert/strict";
import { assertSchematicDesc, resolveAreaModel, textRuns } from "../src/lib/area-model.ts";

const rejects = (input, message) => assert.throws(() => resolveAreaModel(input), (e) => e instanceof Error && e.message === message);
const areasOf = (model) => model.cells.map((c) => c.area);
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} 不等於 ${b}`);

test("2 × 2 的數字面積模型：每格自動算乘積，依列、行排序", () => {
  const model = resolveAreaModel({ cols: [20, 3], rows: [10, 4] });
  assert.deepEqual(areasOf(model), ["200", "30", "80", "12"]);
  assert.deepEqual(model.cells.map((c) => [c.row, c.col]), [[0, 0], [0, 1], [1, 0], [1, 1]]);
  assert.deepEqual(model.cols.map((s) => s.label), ["20", "3"]);
  assert.deepEqual(model.rows.map((s) => s.label), ["10", "4"]);
  assert.equal(model.schematic, false);
});

test("段數 1 到 3 都合格，只要總格數不超過 4", () => {
  assert.equal(resolveAreaModel({ cols: [5], rows: [2] }).cells.length, 1);
  assert.equal(resolveAreaModel({ cols: [100, 20], rows: [6] }).cells.length, 2);
  assert.equal(resolveAreaModel({ cols: [1, 2, 3], rows: [4] }).cells.length, 3);
  assert.equal(resolveAreaModel({ cols: [4], rows: [1, 2, 3] }).cells.length, 3);
  assert.equal(resolveAreaModel({ cols: [1, 2], rows: [3, 4] }).cells.length, 4);
});

test("段數 0 或超過 3、不是陣列，丟中文錯誤", () => {
  rejects({ cols: [], rows: [1] }, "<AreaModel> 的 cols 必須是 1 到 3 段的陣列，目前有 0 段");
  rejects({ cols: [1], rows: [1, 2, 3, 4] }, "<AreaModel> 的 rows 必須是 1 到 3 段的陣列，目前有 4 段");
  rejects({ cols: 5, rows: [1] }, "<AreaModel> 的 cols 必須是 1 到 3 段的陣列，目前是 5");
});

test("總格數超過 4 丟中文錯誤：2 × 3 與 3 × 3", () => {
  const message = (c, r) => `<AreaModel> 的格數最多 4 格，橫 ${c} 段 × 縱 ${r} 段共 ${c * r} 格，請拆成兩張圖`;
  rejects({ cols: [1, 2, 3], rows: [1, 2] }, message(3, 2));
  rejects({ cols: [1, 2, 3], rows: [1, 2, 3] }, message(3, 3));
});

test("小數邊長的面積沒有浮點誤差", () => {
  const model = resolveAreaModel({ cols: [0.1, 0.3], rows: [0.2, 1.5] });
  assert.deepEqual(areasOf(model), ["0.02", "0.06", "0.15", "0.45"]);
  assert.deepEqual(model.cols.map((s) => s.label), ["0.1", "0.3"]);
  assert.deepEqual(areasOf(resolveAreaModel({ cols: [2.5], rows: [4] })), ["10"]);
});

test("含字母的格沒給面積丟錯，指出是哪一格", () => {
  rejects({ cols: ["x", 2], rows: [3] }, '<AreaModel> 第 1 列第 1 行的格含字母，必須在 areas[0][0] 給面積字串（如 "3x"）');
  rejects({ cols: [2, "x"], rows: [3], areas: [[null, null]] }, '<AreaModel> 第 1 列第 2 行的格含字母，必須在 areas[0][1] 給面積字串（如 "3x"）');
});

test("含字母的格由作者給面積，兩邊都是數字的格仍自動算", () => {
  const model = resolveAreaModel({ cols: ["x", 2], rows: [3, "y"], areas: [["3x", null], ["xy", "2y"]] });
  assert.deepEqual(areasOf(model), ["3x", "6", "xy", "2y"]);
  assert.equal(model.schematic, true);
});

test("兩邊都是數字的格不能用 areas 覆寫，數字一律由元件算", () => {
  rejects(
    { cols: [10, 3], rows: [4], areas: [["40", null]] },
    "<AreaModel> 第 1 列第 1 行的格兩邊都是數字，面積由元件自動算，不能在 areas[0][0] 給字串（要寫成算式請用 cellText=\"expression\"）",
  );
  // 混合時，只有含字母的格需要 areas，數字格留 null
  assert.deepEqual(areasOf(resolveAreaModel({ cols: ["x", 2], rows: [3], areas: [["3x", null]] })), ["3x", "6"]);
});

test('cellText 預設是 "product"；"expression" 讓數字格寫成「橫邊 × 縱邊」的算式，含字母的格仍用 areas', () => {
  assert.deepEqual(areasOf(resolveAreaModel({ cols: [10, 3], rows: [4], cellText: "product" })), ["40", "12"]);
  assert.deepEqual(areasOf(resolveAreaModel({ cols: [10, 3], rows: [4], cellText: "expression" })), ["10 × 4", "3 × 4"]);
  assert.deepEqual(areasOf(resolveAreaModel({ cols: [5, 20], rows: [3, 4], cellText: "expression" })), ["5 × 3", "20 × 3", "5 × 4", "20 × 4"]);
  assert.deepEqual(areasOf(resolveAreaModel({ cols: ["x", 2], rows: [3], cellText: "expression", areas: [["3x", null]] })), ["3x", "2 × 3"]);
  rejects({ cols: [1], rows: [1], cellText: "sum" }, '<AreaModel> 的 cellText 必須是 "product" 或 "expression"，目前是 "sum"');
});

test("邊長與面積用精確十進位字串：不出現科學記號與浮點誤差", () => {
  const model = resolveAreaModel({ cols: [0.0000001], rows: [3] });
  assert.deepEqual(model.cols.map((s) => s.label), ["0.0000001"]);
  assert.deepEqual(areasOf(model), ["0.0000003"]);
  assert.deepEqual(areasOf(resolveAreaModel({ cols: [1.1], rows: [1.1] })), ["1.21"]);
});

test("面積位數太多寫不出來時丟中文錯誤", () => {
  assert.throws(() => resolveAreaModel({ cols: [0.00000001], rows: [0.00000001] }), (e) => e instanceof Error && e.message.startsWith("<AreaModel> 第 1 列第 1 行的面積"));
});

test("格內文字比格子寬時丟中文錯誤，指出是哪一格", () => {
  // 最窄的格 56，6 個字元的 "10 × 4" 寬約 78，放不下
  rejects(
    { cols: [10, 1], rows: [4], cellText: "expression" },
    "<AreaModel> 第 1 列第 2 行的面積文字「1 × 4」太寬，估計寬 65，超過格內可用寬度 48，請縮短文字或把圖拆開",
  );
  assert.throws(() => resolveAreaModel({ cols: ["x"], rows: [3], areas: [["很長很長很長的面積文字"]] }), (e) => e instanceof Error && /太寬/.test(e.message));
  assert.doesNotThrow(() => resolveAreaModel({ cols: [10, 3], rows: [4], cellText: "expression" }));
});

test("全是字母段的邊：橫向置中，縱向高度依實際段長，不留空白", () => {
  const one = resolveAreaModel({ cols: ["x"], rows: ["x"], areas: [["x²"]] });
  // 橫邊一段 120，置中在 56 到 456 之間
  assert.equal(one.cols[0].size, 120);
  assert.equal(one.cols[0].start + one.cols[0].size / 2, 256);
  // 縱邊一段 70，高度 = 上緣 36 + 70 + 下緣 12
  assert.equal(one.height, 36 + 70 + 12);
  const two = resolveAreaModel({ cols: ["x", "y"], rows: ["x", "y"], areas: [["x²", "xy"], ["xy", "y²"]] });
  assert.equal(two.height, 36 + 140 + 12);
  const total = two.cols.reduce((a, c) => a + c.size, 0);
  assert.equal(two.cols[0].start + total / 2, 256);
  // 縱邊數字靠格子左緣，不再固定在 x = 46
  assert.equal(two.rows[0].labelX, two.cols[0].start - 10);
});

test("含數字段的邊仍然填滿：橫邊總寬 400、縱邊依段數", () => {
  const m = resolveAreaModel({ cols: ["x", 2], rows: [3], areas: [["3x", null]] });
  assert.equal(m.cols[0].start, 56);
  assert.equal(m.cols[0].size + m.cols[1].size, 400);
  assert.equal(m.height, 36 + 110 + 12);
});

test("areas 的形狀要對得上列數與行數，內容是非空字串或 null", () => {
  rejects({ cols: [1, 2], rows: [3], areas: [] }, "<AreaModel> 的 areas 必須是 1 列的陣列（areas[列][行]），不給的格寫 null");
  rejects({ cols: [1, 2], rows: [3], areas: [["3"]] }, "<AreaModel> 的 areas[0] 必須有 2 格，對應 1 列 × 2 行的每一行，不給的格寫 null");
  rejects({ cols: [1, 2], rows: [3], areas: [["3", ""]] }, '<AreaModel> 的 areas[0][1] 必須是非空字串或 null，目前是 ""');
  rejects({ cols: [1, 2], rows: [3], areas: [["3", 6]] }, "<AreaModel> 的 areas[0][1] 必須是非空字串或 null，目前是 6");
});

test("零、負數、非有限數的長度丟錯", () => {
  rejects({ cols: [0], rows: [1] }, "<AreaModel> 的 cols[0] 的長度必須是正數，不接受零或負數，目前是 0");
  rejects({ cols: [1], rows: [2, -3] }, "<AreaModel> 的 rows[1] 的長度必須是正數，不接受零或負數，目前是 -3");
  rejects({ cols: [Infinity], rows: [1] }, "<AreaModel> 的 cols[0] 的長度必須是正數，不接受零或負數，目前是 Infinity");
});

test("空字串、全空白、不是字母式的字串丟錯", () => {
  rejects({ cols: [""], rows: [1] }, '<AreaModel> 的 cols[0] 不能是空字串，請寫正數或字母式（如 "x"、"2a"）');
  rejects({ cols: ["  "], rows: [1] }, '<AreaModel> 的 cols[0] 不能是空字串，請寫正數或字母式（如 "x"、"2a"）');
  rejects({ cols: [1], rows: ["-x"] }, '<AreaModel> 的 rows[0] 的字串必須是小寫英文字母式（如 "x"、"2a"），目前是 "-x"');
  rejects({ cols: ["3"], rows: [1] }, '<AreaModel> 的 cols[0] 的字串必須是小寫英文字母式（如 "x"、"2a"），目前是 "3"');
  rejects({ cols: [null], rows: [1] }, '<AreaModel> 的 cols[0] 必須是正數或字母式字串（如 "x"、"2a"），目前是 null');
});

test("字母式字串合格：x、2a、ab、1.5x", () => {
  const model = resolveAreaModel({ cols: ["x", "2a", "ab"], rows: ["1.5x"], areas: [["a", "b", "c"]] });
  assert.deepEqual(model.cols.map((s) => s.label), ["x", "2a", "ab"]);
  assert.deepEqual(model.rows.map((s) => s.kind), ["letter"]);
});

test("數字段依比例：20 與 10 的寬度是 2 比 1，格子與邊對齊", () => {
  const model = resolveAreaModel({ cols: [20, 10], rows: [6] });
  const [a, b] = model.cols;
  close(a.size / b.size, 2);
  close(a.size + b.size, 400);
  close(b.start, a.start + a.size);
  assert.deepEqual(model.cells.map((c) => c.w), [a.size, b.size]);
  assert.deepEqual(model.cells.map((c) => c.x), [a.start, b.start]);
});

test("太窄的數字段固定在下限，其餘照比例分", () => {
  const model = resolveAreaModel({ cols: [100, 1, 100], rows: [6] });
  const [a, b, c] = model.cols;
  assert.equal(b.size, 56);
  close(a.size, c.size);
  close(a.size + b.size + c.size, 400);
});

test("字母段用固定的示意長度，與字母本身和另一邊的數字無關", () => {
  const one = resolveAreaModel({ cols: ["x", "y"], rows: [3], areas: [["a", "b"]] });
  const two = resolveAreaModel({ cols: ["2a", "x"], rows: [99], areas: [["a", "b"]] });
  assert.equal(one.cols[0].size, one.cols[1].size);
  assert.equal(one.cols[0].size, two.cols[0].size);
  assert.equal(two.cols[0].size, two.cols[1].size);
  assert.equal(one.schematic, true);
});

test("字母段與數字段並存：字母段固定，數字段依比例分剩下的長度", () => {
  const model = resolveAreaModel({ cols: ["x", 6, 3], rows: [2], areas: [["a", null, null]] });
  const [x, six, three] = model.cols;
  close(six.size / three.size, 2);
  close(x.size + six.size + three.size, 400);
  assert.equal(x.size, resolveAreaModel({ cols: ["x", "y"], rows: [2], areas: [["a", "b"]] }).cols[0].size);
});

test("縱邊同樣：數字依比例，字母用示意長度", () => {
  const nums = resolveAreaModel({ cols: [5], rows: [30, 15] });
  close(nums.rows[0].size / nums.rows[1].size, 2);
  const letters = resolveAreaModel({ cols: [5], rows: ["x", 2], areas: [["5x"], [null]] });
  assert.equal(letters.rows[0].kind, "letter");
  assert.ok(letters.rows[1].size > 0);
  close(letters.rows[0].size + letters.rows[1].size, letters.height - 36 - 12);
});

test("高度依縱邊段數決定，格子在上緣之下", () => {
  const one = resolveAreaModel({ cols: [1], rows: [1] });
  const three = resolveAreaModel({ cols: [1], rows: [1, 1, 1] });
  assert.ok(three.height > one.height);
  assert.equal(one.cells[0].y, 36);
  assert.equal(one.width, 480);
});

test("強調列：該列的格 highlighted，其餘不是；不給就都不強調", () => {
  const model = resolveAreaModel({ cols: [20, 3], rows: [10, 4], highlightRow: 1 });
  assert.deepEqual(model.cells.map((c) => c.highlighted), [false, false, true, true]);
  assert.ok(resolveAreaModel({ cols: [20, 3], rows: [10, 4] }).cells.every((c) => !c.highlighted));
  assert.equal(resolveAreaModel({ cols: [20, 3], rows: [10, 4], highlightRow: 0 }).cells[0].highlighted, true);
});

test("強調列超出範圍或不是整數，丟中文錯誤", () => {
  rejects({ cols: [1], rows: [1, 2], highlightRow: 2 }, "<AreaModel> 的 highlightRow 必須是 0 到 1 的整數（rows 有 2 段），目前是 2");
  rejects({ cols: [1], rows: [1], highlightRow: -1 }, "<AreaModel> 的 highlightRow 必須是 0 到 0 的整數（rows 有 1 段），目前是 -1");
  rejects({ cols: [1], rows: [1, 2], highlightRow: 0.5 }, "<AreaModel> 的 highlightRow 必須是 0 到 1 的整數（rows 有 2 段），目前是 0.5");
});

test("既有用法畫得出來：長除法的 6 × (100 + 20)、分配律的 4 × (10 + 3)", () => {
  assert.deepEqual(areasOf(resolveAreaModel({ cols: [100, 20], rows: [6] })), ["600", "120"]);
  assert.deepEqual(areasOf(resolveAreaModel({ cols: [10, 3], rows: [4] })), ["40", "12"]);
});

test("含字母時 desc 必須寫明不按比例；全是數字時不要求", () => {
  const letters = resolveAreaModel({ cols: ["x", 2], rows: [3], areas: [["3x", null]] });
  assert.throws(() => assertSchematicDesc(letters, "一個長方形，橫邊拆成 x 和 2。"), (e) => e instanceof Error && e.message === "<AreaModel> 含字母段，字母段的長度只是示意，desc 必須寫明「不按比例」");
  assert.doesNotThrow(() => assertSchematicDesc(letters, "字母 x 的長度只是示意，不按比例。"));
  assert.doesNotThrow(() => assertSchematicDesc(resolveAreaModel({ cols: [1], rows: [1] }), "一個長方形。"));
});

test("textRuns 把英文字母切成斜體片段，數字與符號維持正體", () => {
  assert.deepEqual(textRuns("3x"), [{ text: "3", italic: false }, { text: "x", italic: true }]);
  assert.deepEqual(textRuns("x + 2"), [{ text: "x", italic: true }, { text: " + 2", italic: false }]);
  assert.deepEqual(textRuns("200"), [{ text: "200", italic: false }]);
  assert.deepEqual(textRuns("ab"), [{ text: "ab", italic: true }]);
});
