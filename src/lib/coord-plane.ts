export type Coord = [number, number];
export interface CoordPoint { at: Coord; name?: string }
export interface CoordSegment { from: Coord; to: Coord; auxiliary?: boolean }
export interface CoordPlaneInput {
  id: string;
  xRange: Coord;
  yRange: Coord;
  points?: CoordPoint[];
  quadrants?: boolean;
  segments?: CoordSegment[];
}
interface Text { x: number; y: number; text: string; kind: "tick" | "axis" | "name" | "quadrant" }
interface Box { left: number; right: number; top: number; bottom: number }

/** One unit has the same length on both axes. Dense or ambiguous author input fails at build time. */
export function resolveCoordPlane(input: CoordPlaneInput) {
  const fail = (message: string): never => { throw new Error(`<CoordPlane> ${message}`); };
  if (typeof input.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(input.id)) fail("id 必須是穩定的英文字母開頭小寫識別名");
  for (const key of ["xRange", "yRange"] as const) {
    const r = input[key];
    if (!Array.isArray(r) || r.length !== 2 || !r.every(Number.isFinite) || r[0] >= r[1] || r[0] > 0 || r[1] < 0 || r[1] - r[0] < 2 || r[1] - r[0] > 8) {
      fail(`${key} 必須是含原點的有限遞增範圍，跨度 2 到 8；過密時請拆圖`);
    }
  }
  const points = input.points ?? [];
  if (!Array.isArray(points) || points.length > 12) fail("points 最多 12 個，過密時請拆圖");
  const [xmin, xmax] = input.xRange;
  const [ymin, ymax] = input.yRange;
  const unit = Math.min(360 / (xmax - xmin), 360 / (ymax - ymin));
  const left = (480 - unit * (xmax - xmin)) / 2;
  const top = 54;
  const right = left + unit * (xmax - xmin);
  const bottom = top + unit * (ymax - ymin);
  const width = 480;
  const height = bottom + 60;
  const project = ([x, y]: Coord) => ({ x: left + (x - xmin) * unit, y: top + (ymax - y) * unit });
  const origin = project([0, 0]);
  const assertCoord = (at: Coord, path: string) => {
    if (!Array.isArray(at) || at.length !== 2 || !at.every(Number.isFinite) || at[0] < xmin || at[0] > xmax || at[1] < ymin || at[1] > ymax) fail(`${path} 必須是範圍內的有限坐標`);
  };
  const segments = input.segments ?? [];
  if (!Array.isArray(segments) || segments.length > 12) fail("segments 最多 12 條，過密時請拆圖");
  const resolvedSegments = segments.map((s, i) => {
    if (!s) fail(`segments[${i}] 必須有 from 與 to`);
    assertCoord(s.from, `segments[${i}].from`);
    assertCoord(s.to, `segments[${i}].to`);
    if (s.auxiliary !== undefined && typeof s.auxiliary !== "boolean") fail(`segments[${i}].auxiliary 必須是布林值`);
    return { from: project(s.from), to: project(s.to), auxiliary: s.auxiliary ?? false };
  });
  const resolvedPoints = points.map((p, i) => {
    if (!p) fail(`points[${i}] 必須有 at`);
    assertCoord(p.at, `points[${i}].at`);
    if (p.name !== undefined && (typeof p.name !== "string" || !/^[A-Z]$/.test(p.name) || p.name === "O")) fail(`points[${i}].name 必須是 O 以外的單一大寫英文字母`);
    return { ...project(p.at), name: p.name };
  });
  const names = points.flatMap((p) => p.name === undefined ? [] : [p.name]);
  if (names.length > 4) fail("點名最多 4 個，請拆圖");
  if (new Set(names).size !== names.length) fail("點名不可重複");
  if (input.quadrants !== undefined && typeof input.quadrants !== "boolean") fail("quadrants 必須是布林值");
  if (input.quadrants && (!(xmin < 0 && xmax > 0 && ymin < 0 && ymax > 0) || points.length || segments.length)) fail("quadrants 四象限圖需要兩軸正負範圍，且不得疊加 points 或 segments");
  const xTicks = Array.from({ length: Math.floor(xmax) - Math.ceil(xmin) + 1 }, (_, i) => i + Math.ceil(xmin)).filter((v) => v !== 0);
  const yTicks = Array.from({ length: Math.floor(ymax) - Math.ceil(ymin) + 1 }, (_, i) => i + Math.ceil(ymin)).filter((v) => v !== 0);
  const format = (n: number) => String(n).replace("-", "−");
  const texts: Text[] = [
    { x: origin.x - 18, y: origin.y + 28, text: "O", kind: "axis" },
    { x: right + 25, y: origin.y + 7, text: "x", kind: "axis" },
    { x: origin.x, y: top - 24, text: "y", kind: "axis" },
    ...xTicks.map((v): Text => ({ x: project([v, 0]).x, y: origin.y + 28, text: format(v), kind: "tick" })),
    ...yTicks.map((v): Text => ({ x: origin.x - 25, y: project([0, v]).y + 7, text: format(v), kind: "tick" })),
  ];
  // Conservative font boxes include side bearings and ascenders; the browser fixture also checks actual glyph boxes.
  const box = (t: Text): Box => {
    const w = [...t.text].reduce((sum, c) => sum + (/\p{Script=Han}/u.test(c) ? 21 : 15), 0);
    return { left: t.x - w / 2 - 3, right: t.x + w / 2 + 3, top: t.y - 23, bottom: t.y + 5 };
  };
  const overlaps = (a: Box, b: Box) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  const pointBoxes = resolvedPoints.map((p) => ({ left: p.x - 7, right: p.x + 7, top: p.y - 7, bottom: p.y + 7 }));
  const axisBoxes = [
    { left: left - 10, right: right + 10, top: origin.y - 2, bottom: origin.y + 2 },
    { left: origin.x - 2, right: origin.x + 2, top: top - 10, bottom: bottom + 10 },
  ];
  // Intersect a finite segment with a rectangle by narrowing its parameter interval on each axis.
  const crossesSegment = (b: Box) => resolvedSegments.some((s) => {
    let from = 0;
    let to = 1;
    for (const [start, end, min, max] of [[s.from.x, s.to.x, b.left, b.right], [s.from.y, s.to.y, b.top, b.bottom]]) {
      const delta = end! - start!;
      if (delta === 0) {
        if (start! < min! || start! > max!) return false;
      } else {
        const a = (min! - start!) / delta;
        const z = (max! - start!) / delta;
        from = Math.max(from, Math.min(a, z));
        to = Math.min(to, Math.max(a, z));
        if (from > to) return false;
      }
    }
    return true;
  });
  const fits = (b: Box, occupied: Box[]) => b.left >= 4 && b.right <= width - 4 && b.top >= 4 && b.bottom <= height - 4 && !occupied.some((r) => overlaps(b, r)) && !crossesSegment(b);
  // Keep existing tick positions unless a newly drawn segment crosses one; move only within its own tick's neighbourhood.
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i]!;
    if (t.kind !== "tick" || !crossesSegment(box(t))) continue;
    const offsets = t.y === origin.y + 28
      ? [[0, -40], [-20, 0], [20, 0], [-20, -40], [20, -40]]
      : [[50, 0], [0, -20], [0, 22], [50, -20], [50, 22]];
    const occupied = [...texts.filter((_, index) => index !== i).map(box), ...pointBoxes, ...axisBoxes];
    const moved = offsets.map(([dx, dy]) => ({ ...t, x: t.x + dx!, y: t.y + dy! })).find((candidate) => fits(box(candidate), occupied));
    if (!moved) fail(`刻度 ${t.text} 無法避讓線段或其他標記，請拆圖或調整範圍`);
    texts[i] = moved!;
  }
  const reserved = [...texts.map(box), ...pointBoxes];
  for (const p of resolvedPoints) {
    if (!p.name) continue;
    const offsets = [[19, -15], [-19, -15], [19, 30], [-19, 30], [0, -18], [0, 34], [29, 7], [-29, 7]];
    const label = offsets.map(([dx, dy]): Text => ({ x: p.x + dx!, y: p.y + dy!, text: p.name!, kind: "name" })).find((t) => {
      const b = box(t);
      return fits(b, [...reserved, ...axisBoxes]);
    });
    if (!label) fail(`點名 ${p.name} 無法避讓原點、刻度或其他點，請拆圖或調整範圍`);
    texts.push(label!);
    reserved.push(box(label!));
  }
  if (input.quadrants) {
    for (const [x, y, text] of [[(origin.x + right) / 2, (top + origin.y) / 2, "第一象限"], [(left + origin.x) / 2, (top + origin.y) / 2, "第二象限"], [(left + origin.x) / 2, (origin.y + bottom) / 2, "第三象限"], [(origin.x + right) / 2, (origin.y + bottom) / 2, "第四象限"]] as [number, number, string][]) {
      const t: Text = { x, y: y + 7, text, kind: "quadrant" };
      const b = box(t);
      if (b.left < left || b.right > right || b.top < top || b.bottom > bottom || reserved.some((r) => overlaps(b, r))) fail("quadrants 名稱無法避讓，請平衡兩軸的正負範圍");
      texts.push(t);
      reserved.push(b);
    }
  }
  return { width, height, unit, left, right, top, bottom, origin, xTicks: xTicks.map((value) => ({ value, ...project([value, 0]) })), yTicks: yTicks.map((value) => ({ value, ...project([0, value]) })), points: resolvedPoints, segments: resolvedSegments, texts };
}
