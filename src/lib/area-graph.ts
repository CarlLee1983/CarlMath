import { resolveFunctionGraph, type GraphRange } from "./function-graph.ts";

export type AreaFunction = { linear: [number, number] } | { quadratic: [number, number, number] };
export interface AreaGraphInput {
  id: string;
  xRange: GraphRange;
  yRange: GraphRange;
  xStep?: number;
  yStep?: number;
  fn: AreaFunction;
  secondFn?: AreaFunction;
  integrationRange: GraphRange;
  rectangles?: { count: number; sample: "left" | "right" };
}
interface Point { x: number; y: number }
interface Box { left: number; right: number; top: number; bottom: number }
interface Text extends Point { text: string; kind: "tick" | "axis" | "name"; axis?: "x" | "y" }
export function resolveAreaGraph(input: AreaGraphInput) {
  const fail = (message: string): never => { throw new Error(`<AreaGraph> ${input.id ?? "(缺少 id)"}: ${message}`); };
  if (!input.fn || typeof input.fn !== "object" || Array.isArray(input.fn) || Object.keys(input.fn).length !== 1 || !("linear" in input.fn || "quadratic" in input.fn)) fail("fn 僅接受 linear 或 quadratic");
  if (input.secondFn !== undefined) {
    const fn = input.secondFn;
    if (!fn || typeof fn !== "object" || Array.isArray(fn) || Object.keys(fn).length !== 1 || !("linear" in fn || "quadratic" in fn)) fail("secondFn 僅接受 linear 或 quadratic");
    if (input.rectangles !== undefined) fail("secondFn 不可與 rectangles 並用");
  }
  // Explicitly forward only shared properties; an area interval is not a function domain.
  let graph: ReturnType<typeof resolveFunctionGraph>;
  let secondGraph: ReturnType<typeof resolveFunctionGraph> | undefined;
  try {
    graph = resolveFunctionGraph({ id: input.id, xRange: input.xRange, yRange: input.yRange, xStep: input.xStep, yStep: input.yStep, fn: input.fn });
  } catch (error) { return fail((error as Error).message.replace(/^<FunctionGraph> [^:]*: /, "")); }
  if (input.secondFn !== undefined) {
    try {
      secondGraph = resolveFunctionGraph({ id: input.id, xRange: input.xRange, yRange: input.yRange, xStep: input.xStep, yStep: input.yStep, fn: input.secondFn });
    } catch (error) { return fail("secondFn: " + (error as Error).message.replace(/^<FunctionGraph> [^:]*: /, "")); }
  }
  const range = input.integrationRange;
  if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isFinite) || range[0] >= range[1] || range[0] < input.xRange[0] || range[1] > input.xRange[1] || !Number.isFinite(range[1] - range[0])) fail("integrationRange 必須是視窗內有限嚴格遞增區間");
  if (input.rectangles !== undefined) {
    const r = input.rectangles;
    if (!r || typeof r !== "object" || Array.isArray(r) || Object.keys(r).some((key) => key !== "count" && key !== "sample") || !Number.isSafeInteger(r.count) || r.count < 1 || r.count > 32 || (r.sample !== "left" && r.sample !== "right")) fail("rectangles 須為 {count:1至32的正整數,sample:'left'或'right'}");
  }
  const [q, a, b] = "quadratic" in input.fn ? input.fn.quadratic : [0, ...input.fn.linear];
  const [sq, sa, sb] = input.secondFn === undefined ? [0, 0, 0] : "quadratic" in input.secondFn ? input.secondFn.quadratic : [0, ...input.secondFn.linear];
  const [dq, da, db] = [q - sq, a - sa, b - sb];
  if (![dq, da, db].every(Number.isFinite)) fail("fn 與 secondFn 的差係數溢位");
  if (dq === 0 && da === 0 && db === 0) fail("兩條曲線重合，沒有非零面積區域");
  const [lo, hi] = range, h = hi - lo;
  const [xmin, xmax] = input.xRange, [ymin, ymax] = input.yRange;
  const xUnit = 360 / (xmax - xmin), yUnit = 360 / (ymax - ymin);
  const project = (x: number, y: number): Point => ({ x: 60 + (x - xmin) * xUnit, y: 54 + (ymax - y) * yUnit });
  const value = (x: number, q: number, a: number, b: number) => {
    const terms = [q * x * x, a * x, b], y = (q * x + a) * x + b;
    const error = terms.reduce((sum, v) => sum + Math.abs(v), 0) * Number.EPSILON * 8;
    if (![...terms, y, error].every(Number.isFinite) || error > (ymax - ymin) * 1e-10) fail("fn 的面積計算溢位或數值精度不足");
    return y;
  };
  const evaluate = (x: number) => value(x, q, a, b);
  const secondValue = (x: number) => value(x, sq, sa, sb);
  const difference = (x: number) => {
    const error = (Math.abs(q) + Math.abs(sq)) * x * x + (Math.abs(a) + Math.abs(sa)) * Math.abs(x) + Math.abs(b) + Math.abs(sb);
    if (!Number.isFinite(error) || error * 32 * Number.EPSILON > (ymax - ymin) * 1e-10) fail("兩曲線差的消去誤差過大");
    return value(x, dq, da, db);
  };
  const vertex = q === 0 ? undefined : -a / q / 2;
  const secondVertex = sq === 0 ? undefined : -sa / sq / 2;
  const values = [evaluate(lo), evaluate(hi)];
  if (vertex !== undefined && vertex > lo && vertex < hi) values.push(evaluate(vertex));
  if (Math.min(...values) < ymin || Math.max(...values) > ymax) fail("integrationRange 內曲線必須完整位於 yRange，不能截掉積分面積");
  if (input.secondFn !== undefined) {
    const ys = [secondValue(lo), secondValue(hi)];
    if (secondVertex !== undefined && secondVertex > lo && secondVertex < hi) ys.push(secondValue(secondVertex));
    if (Math.min(...ys) < ymin || Math.max(...ys) > ymax) fail("integrationRange 內 secondFn 必須完整位於 yRange，不能截掉積分面積");
  }
  if (project(lo, 0).x === project(hi, 0).x) fail("integrationRange 投影寬度數值精度不足");
  const integral = (u: number, v: number) => {
    const width = v - u;
    const terms = [difference(u), (2 * dq * u + da) * width / 2, dq * width * width / 3];
    const area = width * terms.reduce((sum, x) => sum + x, 0);
    const error = Math.abs(width) * terms.reduce((sum, x) => sum + Math.abs(x), 0) * 32 * Number.EPSILON;
    const scale = (xmax - xmin) * (ymax - ymin);
    if (![...terms, area, error, scale].every(Number.isFinite) || error > scale * 1e-10) fail("積分值溢位或數值精度不足");
    return area;
  };
  const roots: number[] = [];
  if (dq === 0 && da !== 0) {
    const root = -db / da;
    if (!Number.isFinite(root)) fail("fn 零點數值精度不足");
    roots.push(root);
  } else if (dq !== 0) {
    const scale = Math.max(Math.abs(dq), Math.abs(da), Math.abs(db));
    const aa = dq / scale, bb = da / scale, cc = db / scale;
    if (aa === 0 || (da !== 0 && bb === 0) || (db !== 0 && cc === 0)) fail("fn 零點係數下溢");
    const square = bb * bb, product = 4 * aa * cc, d = square - product;
    if ((bb !== 0 && square === 0) || (cc !== 0 && product === 0) || (d !== 0 && Math.abs(d) < 8 * Number.EPSILON * (square + Math.abs(product)))) fail("fn 零點數值精度不足");
    if (d === 0) roots.push(-bb / (2 * aa));
    else if (d > 0) {
      const stable = -(bb + (bb >= 0 ? 1 : -1) * Math.sqrt(d)) / 2;
      roots.push(stable / aa, cc / stable);
    }
    if (!roots.every(Number.isFinite)) fail("fn 零點溢位");
  }
  const interiorRoots = roots.filter((x) => x > lo && x < hi);
  for (const x of interiorRoots) if (Math.abs(difference(x)) * yUnit > 1e-7) fail("fn 零點殘差過大");
  const cuts = [...new Set([lo, ...interiorRoots, hi])].sort((u, v) => u - v);
  const areas = cuts.slice(1).map((v, i) => {
    const u = cuts[i]!, mid = u + (v - u) / 2;
    if (mid === u || mid === v || project(u, 0).x === project(v, 0).x) fail("面積分區寬度數值精度不足");
    const p0 = project(u, evaluate(u)), p1 = project(v, evaluate(v));
    const control = project(mid, evaluate(u) + (2 * q * u + a) * (v - u) / 2);
    const baseline0 = project(u, secondValue(u)), baseline1 = project(v, secondValue(v));
    const secondControl = project(mid, secondValue(u) + (2 * sq * u + sa) * (v - u) / 2);
    if (input.secondFn !== undefined) {
      const firstY = project(mid, evaluate(mid)).y, secondY = project(mid, secondValue(mid)).y;
      if (Math.abs(firstY - secondY) <= 64 * Number.EPSILON * Math.max(1, Math.abs(firstY), Math.abs(secondY))) fail("兩曲線間距投影無法分辨");
    }
    if (![p0, p1, control, baseline0, baseline1, secondControl].every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) fail("面積邊界投影溢位");
    const command = q === 0 ? `L ${p1.x} ${p1.y}` : `Q ${control.x} ${control.y} ${p1.x} ${p1.y}`;
    const reverse = sq === 0 ? `L ${baseline0.x} ${baseline0.y}` : `Q ${secondControl.x} ${secondControl.y} ${baseline0.x} ${baseline0.y}`;
    const d = `M ${baseline0.x} ${baseline0.y} L ${p0.x} ${p0.y} ${command} L ${baseline1.x} ${baseline1.y}${input.secondFn === undefined ? "" : " " + reverse} Z`;
    const signedArea = integral(u, v), negative = difference(mid) < 0;
    if (signedArea === 0 || (signedArea < 0) !== negative) fail("面積分區的有向積分下溢或符號無法可靠判定");
    return { from: u, to: v, negative, signedArea, d };
  });
  const rectangles = input.rectangles ? Array.from({ length: input.rectangles.count }, (_, i) => {
    const count = input.rectangles!.count;
    const from = lo + h * (i / count), to = i + 1 === count ? hi : lo + h * ((i + 1) / count);
    const sampleX = input.rectangles!.sample === "left" ? from : to, height = evaluate(sampleX);
    const p0 = project(from, height), p1 = project(to, 0);
    const width = p1.x - p0.x, pixelHeight = Math.abs(p1.y - p0.y);
    if (![width, pixelHeight].every(Number.isFinite) || width < 8 || from >= to) fail("rectangles 長條過密或投影數值精度不足；每條至少 8 viewBox 單位");
    if (height !== 0 && pixelHeight < 1) fail("rectangles 非零高度不足 1 viewBox 單位，請調整視窗");
    return { from, to, sampleX, height, x: p0.x, y: Math.min(p0.y, p1.y), width, pixelHeight, negative: height < 0, signedArea: (to - from) * height };
  }) : [];
  const signedArea = integral(lo, hi);
  const geometricArea = areas.reduce((sum, area) => sum + Math.abs(area.signedArea), 0);
  if (!Number.isFinite(geometricArea)) fail("幾何面積溢位");
  const rectangleSum = input.rectangles ? rectangles.reduce((sum, r) => sum + r.signedArea, 0) : undefined;
  if (rectangleSum !== undefined && !Number.isFinite(rectangleSum)) fail("rectangles 總和溢位");

  // Extend the shared graph's label placement to the actual filled regions.
  // On each x interval a quadratic's endpoint/vertex values give its complete range.
  const textBox = (t: Text): Box => ({ left: t.x - t.text.length * 7.5 - 3, right: t.x + t.text.length * 7.5 + 3, top: t.y - 23, bottom: t.y + 5 });
  const overlaps = (u: Box, v: Box) => u.left < v.right && u.right > v.left && u.top < v.bottom && u.bottom > v.top;
  const curveOrAreaCrosses = (box: Box, filled: boolean, second = false) => {
    const u = Math.max(filled ? lo : xmin, xmin + (box.left - 2 - 60) / xUnit);
    const v = Math.min(filled ? hi : xmax, xmin + (box.right + 2 - 60) / xUnit);
    if (u > v) return false;
    const fn = second ? secondValue : evaluate, turning = second ? secondVertex : vertex;
    const ys = [fn(u), fn(v)];
    if (turning !== undefined && turning > u && turning < v) ys.push(fn(turning));
    if (filled) {
      ys.push(secondValue(u), secondValue(v));
      if (secondVertex !== undefined && secondVertex > u && secondVertex < v) ys.push(secondValue(secondVertex));
    }
    const min = Math.max(ymin, Math.min(...ys)), max = Math.min(ymax, Math.max(...ys));
    if (min > max) return false;
    return project(0, max).y <= box.bottom + 2 && project(0, min).y >= box.top - 2;
  };
  const axisBoxes = [
    { left: 50, right: 430, top: graph.origin.y - 2, bottom: graph.origin.y + 2 },
    { left: graph.origin.x - 2, right: graph.origin.x + 2, top: 44, bottom: 424 },
  ];
  const rectangleBoxes = rectangles.filter((r) => r.height !== 0).map((r) => ({ left: r.x - 2, right: r.x + r.width + 2, top: r.y - 2, bottom: r.y + r.pixelHeight + 2 }));
  const texts: Text[] = graph.texts.map((t) => ({ ...t }));
  const fits = (t: Text, index: number) => {
    const box = textBox(t);
    return box.left >= 4 && box.right <= graph.width - 4 && box.top >= 4 && box.bottom <= graph.height - 4
      && ![...texts.filter((_, j) => j !== index).map(textBox), ...axisBoxes, ...rectangleBoxes].some((other) => overlaps(box, other))
      && !curveOrAreaCrosses(box, false) && (!secondGraph || !curveOrAreaCrosses(box, false, true)) && (input.rectangles !== undefined || !curveOrAreaCrosses(box, true));
  };
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i]!;
    if (fits(t, i)) continue;
    const offsets = t.axis === "x" ? [[0, -44], [-20, 0], [20, 0], [-20, -44], [20, -44], [0, 22]]
      : t.axis === "y" ? [[50, 0], [0, -22], [0, 22], [50, -22], [50, 22], [-20, 0]]
      : [[0, -44], [36, 0], [-18, 0], [0, 18], [36, -44]];
    const moved = offsets.map(([dx, dy]) => ({ ...t, x: t.x + dx!, y: t.y + dy! })).find((candidate) => fits(candidate, i));
    if (!moved) fail(`標記 ${t.text} 無法避讓面積或長條，請調整視窗或拆圖`);
    texts[i] = moved!;
  }
  return { ...graph, texts, areas, rectangles, signedArea, geometricArea, rectangleSum, secondGraph };
}
