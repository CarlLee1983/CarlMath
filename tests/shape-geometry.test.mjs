import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveShape } from "../src/lib/shape-geometry.ts";

const throwsWith = (input, ...parts) =>
  assert.throws(
    () => resolveShape(input),
    (e) => e instanceof Error && parts.every((p) => e.message.includes(p)),
  );
const rejects = (input, message) => assert.throws(() => resolveShape(input), (e) => e instanceof Error && e.message === message);

// 3-4-5 直角三角形：頂點 0 是 90°，頂點 1 約 36.87°，頂點 2 約 53.13°
const tri = (extra = {}) => ({ polygons: [{ vertices: [[0, 0], [4, 0], [0, 3]], ...extra }] });

test("等比縮放到 viewBox 寬 480，圖形水平置中、y 軸翻轉（抽象座標 y 朝上）", () => {
  const layout = resolveShape(tri());
  assert.equal(layout.width, 480);
  const [p0, p1, p2] = layout.polygons[0].points;
  // 等比：水平 4、垂直 3 的比例不變
  assert.ok(Math.abs((p1[0] - p0[0]) / (p0[1] - p2[1]) - 4 / 3) < 1e-9);
  // y 翻轉：抽象座標較高的頂點在畫面上較靠上（y 較小）
  assert.ok(p2[1] < p0[1]);
  assert.equal(p0[1], p1[1]);
  // 水平置中，且整個圖形落在 0 到 480 內
  assert.ok(Math.abs((p0[0] + p1[0]) / 2 - 240) < 1e-9);
  assert.ok(p0[0] > 0 && p1[0] < 480);
  assert.ok(Math.max(p0[1], p1[1], p2[1]) < layout.height && Math.min(p0[1], p1[1], p2[1]) > 0);
});

test("座標大小不影響結果：同樣的形狀放大十倍，畫出來一樣", () => {
  const big = { polygons: [{ vertices: [[0, 0], [40, 0], [0, 30]] }] };
  assert.deepEqual(resolveShape(big).polygons, resolveShape(tri()).polygons);
});

test("邊長標籤落在邊的外側：離多邊形內部比邊的中點更遠", () => {
  const layout = resolveShape(
    tri({
      sides: [
        { side: 0, label: 4 },
        { side: 1, label: 5 },
        { side: 2, label: 3 },
      ],
    }),
  );
  const pts = layout.polygons[0].points;
  const centroid = [0, 1].map((k) => (pts[0][k] + pts[1][k] + pts[2][k]) / 3);
  const labels = layout.texts.filter((t) => t.kind === "length");
  assert.deepEqual(labels.map((t) => t.text), ["4", "5", "3"]);
  labels.forEach((label, i) => {
    const [a, b] = [pts[i], pts[(i + 1) % 3]];
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const center = [label.x, label.cy];
    const dist = (p) => Math.hypot(p[0] - centroid[0], p[1] - centroid[1]);
    assert.ok(dist(center) > dist(mid), `第 ${i} 條邊的標籤不在外側`);
  });
});

test("頂點順時針或逆時針寫都一樣，標籤都在外側", () => {
  const cw = { polygons: [{ vertices: [[0, 3], [4, 0], [0, 0]], sides: [{ side: 2, label: 3 }] }] };
  const layout = resolveShape(cw);
  const [label] = layout.texts;
  // 第 2 條邊是 (0,0)→(0,3)，即最左邊的垂直邊；標籤在它的左側
  assert.ok(label.x < layout.polygons[0].points[2][0]);
});

test("度數標籤與實際角度相差超過 1° 丟出中文錯誤，指出頂點、標的度數與實際度數", () => {
  throwsWith(tri({ angles: [{ at: 1, degrees: 40 }] }), "<Shape>", "polygons[0].angles[0]", "頂點 1", "40°", "36.9°");
  throwsWith(tri({ names: ["A", "B", "C"], angles: [{ at: 1, degrees: 40 }] }), "頂點 1（B）");
  throwsWith(tri({ angles: [{ at: 0, degrees: 60 }] }), "60°", "90°");
});

test("度數與實際角度相差 1° 以內通過；「?」不驗證", () => {
  assert.doesNotThrow(() => resolveShape(tri({ angles: [{ at: 1, degrees: 37 }, { at: 2, degrees: 53 }] })));
  assert.doesNotThrow(() => resolveShape(tri({ angles: [{ at: 1, degrees: 36 }] })), "36.87 與 36 相差 0.87°");
  assert.doesNotThrow(() => resolveShape(tri({ angles: [{ at: 0, degrees: "?" }, { at: 1, degrees: "?" }] })));
  throwsWith(tri({ angles: [{ at: 1, degrees: 35.8 }] }), "35.8°");
});

test("度數標籤畫成「N°」，「?」照寫；角弧在頂點上", () => {
  const layout = resolveShape(tri({ angles: [{ at: 1, degrees: 37 }, { at: 2, degrees: "?" }] }));
  assert.deepEqual(layout.texts.filter((t) => t.kind === "degree").map((t) => t.text), ["37°", "?"]);
  assert.equal(layout.arcs.length, 2);
  assert.ok(layout.arcs.every((arc) => arc.startsWith("M ") && arc.includes(" A ")));
});

test("凹多邊形的內角（大於 180°）也依座標驗證", () => {
  // 箭頭形：頂點 3 是凹角，內角 = 360 − 90 = 270
  const arrow = { vertices: [[0, 0], [4, 0], [4, 4], [2, 2], [0, 4]] };
  const bad = (degrees) => ({ polygons: [{ ...arrow, angles: [{ at: 3, degrees }] }] });
  assert.doesNotThrow(() => resolveShape(bad(270)));
  throwsWith(bad(90), "90°", "270°");
});

test("直角記號取代角弧，是小方框；頂點座標不是 90° 時丟錯", () => {
  const layout = resolveShape(tri({ angles: [{ at: 0, right: true }] }));
  assert.equal(layout.arcs.length, 0);
  assert.equal(layout.rightMarks.length, 1);
  assert.equal(layout.rightMarks[0].length, 4);
  assert.equal(layout.texts.length, 0);
  throwsWith(tri({ angles: [{ at: 1, right: true }] }), "頂點 1", "直角", "36.9°");
  rejects(tri({ angles: [{ at: 0, right: true, degrees: 90 }] }), "<Shape> 的 polygons[0].angles[0] 不能同時寫 right 與 degrees");
  rejects(tri({ angles: [{ at: 0 }] }), "<Shape> 的 polygons[0].angles[0] 必須有 degrees（數字或 \"?\"）或 right");
});

test("頂點字母畫在頂點外側；等邊記號與平行記號依條數畫出", () => {
  const layout = resolveShape(tri({ names: ["A", "B", "C"], sides: [{ side: 0, equal: 2 }, { side: 1, equal: 1 }, { side: 2, parallel: 2 }] }));
  assert.deepEqual(layout.texts.filter((t) => t.kind === "letter").map((t) => t.text), ["A", "B", "C"]);
  assert.equal(layout.equalMarks.length, 3);
  assert.equal(layout.parallelMarks.length, 2);
});

test("同組平行記號的箭頭方向一致，不論邊的寫法順逆", () => {
  const para = { polygons: [{ vertices: [[0, 0], [4, 0], [5, 2], [1, 2]], sides: [{ side: 0, parallel: 1 }, { side: 2, parallel: 1 }] }] };
  const [a, b] = resolveShape(para).parallelMarks;
  // 箭頭的尖端在 L 的中間點；兩邊都朝右（尖端 x 大於兩臂 x）
  const tip = (d) => Number(d.split(" ")[4]);
  const arm = (d) => Number(d.split(" ")[1]);
  assert.ok(tip(a) > arm(a));
  assert.ok(tip(b) > arm(b));
});

test("虛線輔助線與其標籤", () => {
  const layout = resolveShape({ ...tri(), guides: [{ from: [0, 0], to: [2, 1.5], label: "高" }] });
  assert.equal(layout.guides.length, 1);
  assert.deepEqual(layout.texts.filter((t) => t.kind === "note").map((t) => t.text), ["高"]);
});

test("圓：半徑或直徑線段與圓心點；沒有 show 就只畫圓", () => {
  const circle = (extra) => ({ circles: [{ center: [0, 0], radius: 2, ...extra }] });
  const plain = resolveShape(circle({})).circles[0];
  assert.equal(plain.segment, undefined);
  const r = resolveShape(circle({ show: "radius", label: "半徑 3 公分" })).circles[0];
  const d = resolveShape(circle({ show: "diameter" })).circles[0];
  assert.ok(Math.abs(Math.abs(d.segment.x2 - d.segment.x1) - 2 * r.r) < 1e-9);
  assert.ok(Math.abs(Math.abs(r.segment.x2 - r.segment.x1) - r.r) < 1e-9);
  assert.equal(d.segment.y1, d.segment.y2);
  assert.equal(resolveShape(circle({ show: "radius", label: "半徑 3 公分" })).texts[0].kind, "length");
  assert.ok(r.cx > 0 && r.cx - r.r >= 0 && r.cx + r.r <= 480);
});

test("標籤很長時縮小圖形，仍不超出 viewBox 寬 480", () => {
  const layout = resolveShape(tri({ sides: [{ side: 0, label: "一百公尺長的邊" }, { side: 2, label: "一百公尺長的邊" }] }));
  for (const t of layout.texts) {
    assert.ok(t.x - t.width / 2 >= 0 && t.x + t.width / 2 <= 480, `${t.text} 超出 viewBox`);
  }
});

test("標籤上限：邊長加度數超過 6 丟錯，6 個通過", () => {
  const sides = (n) => Array.from({ length: n }, (_, i) => ({ side: i % 3, label: i + 1 }));
  assert.doesNotThrow(() => resolveShape({ polygons: [{ vertices: [[0, 0], [4, 0], [0, 3]], sides: sides(3), angles: [{ at: 0, degrees: 90 }, { at: 1, degrees: "?" }, { at: 2, degrees: "?" }] }] }));
  rejects(
    { polygons: [{ vertices: [[0, 0], [4, 0], [0, 3]], sides: sides(3), angles: [{ at: 0, degrees: 90 }, { at: 1, degrees: "?" }, { at: 2, degrees: "?" }] }], circles: [{ center: [10, 10], radius: 1, show: "radius", label: 5 }] },
    "<Shape> 的邊長與度數標籤合計最多 6 個，目前有 7 個",
  );
});

test("邊長標籤含數字就算邊長（「100 公尺」），不含數字的算文字標籤", () => {
  const layout = resolveShape(tri({ sides: [{ side: 0, label: "100 公尺" }, { side: 1, label: "底" }] }));
  assert.deepEqual(layout.texts.map((t) => t.kind), ["length", "note"]);
});

test("頂點字母超過 4 丟錯，4 個通過", () => {
  const square = (names) => ({ polygons: [{ vertices: [[0, 0], [1, 0], [1, 1], [0, 1]], names }] });
  assert.doesNotThrow(() => resolveShape(square(["A", "B", "C", "D"])));
  rejects(
    { polygons: [{ vertices: [[0, 0], [1, 0], [1, 1], [0, 1]], names: ["A", "B", "C", "D"] }, { vertices: [[3, 0], [4, 0], [3, 1]], names: ["E", "F", "G"] }] },
    "<Shape> 的頂點字母最多 4 個，目前有 7 個",
  );
});

test("文字標籤超過 3 丟錯，3 個通過", () => {
  const notes = (n) => tri({ sides: Array.from({ length: n }, (_, i) => ({ side: i % 3, label: "底" })) });
  assert.doesNotThrow(() => resolveShape(notes(3)));
  rejects({ ...notes(3), guides: [{ from: [0, 0], to: [1, 1], label: "高" }] }, "<Shape> 的文字標籤最多 3 個，目前有 4 個");
});

test("退化輸入：少於 3 個頂點、面積為 0、半徑不為正、不存在的頂點或邊", () => {
  rejects({ polygons: [{ vertices: [[0, 0], [1, 1]] }] }, "<Shape> 的 polygons[0].vertices 至少要有 3 個頂點，目前有 2 個");
  rejects({ polygons: [{ vertices: [[0, 0], [1, 1], [2, 2]] }] }, "<Shape> 的 polygons[0] 面積為 0，頂點不能全在同一條直線上");
  rejects({ circles: [{ center: [0, 0], radius: 0 }] }, "<Shape> 的 circles[0].radius 必須是正數，目前是 0");
  rejects({ circles: [{ center: [0, 0], radius: -1 }] }, "<Shape> 的 circles[0].radius 必須是正數，目前是 -1");
  rejects(tri({ angles: [{ at: 3, degrees: "?" }] }), "<Shape> 的 polygons[0].angles[0].at 必須是 0 到 2 的頂點編號，目前是 3");
  rejects(tri({ sides: [{ side: 3, label: 1 }] }), "<Shape> 的 polygons[0].sides[0].side 必須是 0 到 2 的邊編號，目前是 3");
  rejects(tri({ names: ["A", "B"] }), "<Shape> 的 polygons[0].names 必須和 vertices 一樣長（3 個），目前有 2 個");
  rejects({}, "<Shape> 至少要有一個 polygons 或 circles");
});

test("記號與選項的值域：equal 1–3、parallel 1–2、show 只有 radius 與 diameter、label 要搭配 show", () => {
  rejects(tri({ sides: [{ side: 0, equal: 4 }] }), "<Shape> 的 polygons[0].sides[0].equal 必須是 1 到 3 的整數，目前是 4");
  rejects(tri({ sides: [{ side: 0, parallel: 3 }] }), "<Shape> 的 polygons[0].sides[0].parallel 必須是 1 到 2 的整數，目前是 3");
  rejects({ circles: [{ center: [0, 0], radius: 1, show: "chord" }] }, '<Shape> 的 circles[0].show 只能是 "radius" 或 "diameter"，目前是 "chord"');
  rejects({ circles: [{ center: [0, 0], radius: 1, label: "半徑" }] }, "<Shape> 的 circles[0].label 必須搭配 show（radius 或 diameter）");
  rejects({ polygons: [{ vertices: [[0, 0], [1, 0], [NaN, 1]] }] }, "<Shape> 的 polygons[0].vertices[2] 必須是 [x, y] 兩個有限數字");
});

test("輔助線 right：在垂足畫直角記號，夾在輔助線與它落在的邊之間，朝向輔助線那一側", () => {
  const para = { vertices: [[0, 0], [4, 0], [5, 2], [1, 2]] };
  const layout = resolveShape({ polygons: [para], guides: [{ from: [1, 2], to: [1, 0], right: true }] });
  assert.equal(layout.rightMarks.length, 1);
  const [foot, onGuide, corner, onEdge] = layout.rightMarks[0];
  // 一個邊在輔助線上（朝上，畫面 y 較小），另一個在底邊上（朝向較遠的頂點，即右邊）
  assert.ok(onGuide[1] < foot[1] && onGuide[0] === foot[0]);
  assert.ok(onEdge[0] > foot[0] && onEdge[1] === foot[1]);
  assert.deepEqual(corner, [onEdge[0], onGuide[1]]);
});

test("輔助線 right：to 不在任何邊上、或輔助線與邊不垂直時丟中文錯誤", () => {
  const para = { vertices: [[0, 0], [4, 0], [5, 2], [1, 2]] };
  throwsWith({ polygons: [para], guides: [{ from: [1, 2], to: [1, 0.5], right: true }] }, "guides[0].right", "不在任何邊上");
  throwsWith({ polygons: [para], guides: [{ from: [1, 2], to: [2, 0], right: true }] }, "guides[0].right", "polygons[0]", "邊 0", "63.4°", "相差超過 1°");
  // 沒有 right 時不驗證垂直
  assert.doesNotThrow(() => resolveShape({ polygons: [para], guides: [{ from: [1, 2], to: [2, 0] }] }));
});

test("輔助線 right：垂足在多邊形的邊內點，多條邊符合時取第一個多邊形的第一條", () => {
  const tri2 = { vertices: [[0, 0], [4, 0], [0, 3]] };
  assert.doesNotThrow(() => resolveShape({ polygons: [tri2], guides: [{ from: [0, 3], to: [0, 0], right: true }] }));
  // 垂足在斜邊上：(0,0)→斜邊 (4,0)-(0,3) 的垂足是 (36/25, 48/25)
  assert.doesNotThrow(() => resolveShape({ polygons: [tri2], guides: [{ from: [0, 0], to: [36 / 25, 48 / 25], right: true }] }));
});

test("標籤長到圖放不下時丟中文錯誤，指出是哪個標籤、建議縮短或拆圖，不會悄悄把圖翻轉", () => {
  const long = "一二三四五六七八九十一二三四五六七八九十一二三";
  throwsWith(tri({ sides: [{ side: 2, label: long }] }), "<Shape>", `「${long}」`, "太長", "縮短", "拆成兩張");
});

test("names 只能是單一大寫拉丁字母，不能拿來夾帶文字標籤", () => {
  rejects(tri({ names: ["起點的地方", "B", "C"] }), '<Shape> 的 polygons[0].names[0] 必須是單一大寫拉丁字母（A–Z），目前是 "起點的地方"');
  rejects(tri({ names: ["A", "b", "C"] }), '<Shape> 的 polygons[0].names[1] 必須是單一大寫拉丁字母（A–Z），目前是 "b"');
  rejects(tri({ names: ["A", "B", "CD"] }), '<Shape> 的 polygons[0].names[2] 必須是單一大寫拉丁字母（A–Z），目前是 "CD"');
});

test("degrees 必須是有限數字或 \"?\"，先檢查型別再比對度數", () => {
  const message = (value) => `<Shape> 的 polygons[0].angles[0].degrees 必須是數字或 "?"，目前是 ${value}`;
  rejects(tri({ angles: [{ at: 1, degrees: "37" }] }), message('"37"'));
  rejects(tri({ angles: [{ at: 1, degrees: Number.NaN }] }), message("NaN"));
});
