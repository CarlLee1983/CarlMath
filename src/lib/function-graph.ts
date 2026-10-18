export type GraphRange = [number, number];
export type GraphFunction = { linear: [number, number] } | { constant: number } | { quadratic: [number, number, number] } | { cubic: [number, number, number, number] } | { exponential: [number] } | { logarithmic: [number] };
export interface GraphDomain { from: number | null; to: number | null; openFrom: boolean; openTo: boolean }
export interface FunctionGraphInput {
  id: string;
  xRange: GraphRange;
  yRange: GraphRange;
  fn: GraphFunction;
  domain?: GraphDomain;
  xStep?: number;
  yStep?: number;
  points?: { at: GraphRange; name?: string }[];
}

export function resolveFunctionGraph(input: FunctionGraphInput) {
  const fail = (message: string): never => { throw new Error(`<FunctionGraph> ${input.id ?? "(缺少 id)"}: ${message}`); };
  if (typeof input.id !== "string" || !/^[a-z][a-z0-9-]*$/.test(input.id)) fail("id 必須是穩定的英文字母開頭小寫識別名");
  for (const key of ["xRange", "yRange"] as const) {
    const r = input[key];
    if (!Array.isArray(r) || r.length !== 2 || !r.every(Number.isFinite) || r[0] >= r[1] || r[0] > 0 || r[1] < 0 || !Number.isFinite(r[1] - r[0])) {
      fail(`${key} 必須是含原點的有限遞增範圍`);
    }
  }
  const fn = input.fn;
  if (!fn || typeof fn !== "object" || Array.isArray(fn) || Object.keys(fn).length !== 1) fail("fn 必須只宣告一個函數族 constant、linear、quadratic、cubic、exponential 或 logarithmic");
  let logarithmic: number | undefined;
  let logarithmicBase: number | undefined;
  let exponential: number | undefined;
  let exponentialBase: number | undefined;
  let cubic = 0;
  let q = 0;
  let a = 0;
  let b = 0;
  if ("linear" in fn) {
    if (!Array.isArray(fn.linear) || fn.linear.length !== 2 || !fn.linear.every(Number.isFinite) || fn.linear[0] === 0) fail("fn.linear 必須是 [非零有限係數, 有限常數項]；零係數請用 constant");
    [a, b] = fn.linear;
  } else if ("quadratic" in fn) {
    if (!Array.isArray(fn.quadratic) || fn.quadratic.length !== 3 || !fn.quadratic.every(Number.isFinite) || fn.quadratic[0] === 0) fail("fn.quadratic 必須是 [非零有限二次係數, 有限一次係數, 有限常數項]");
    [q, a, b] = fn.quadratic;
  } else if ("cubic" in fn) {
    if (!Array.isArray(fn.cubic) || fn.cubic.length !== 4 || !fn.cubic.every(Number.isFinite) || fn.cubic[0] === 0) fail("fn.cubic 必須是 [非零有限三次係數, 有限二次係數, 有限一次係數, 有限常數項]");
    [cubic, q, a, b] = fn.cubic;
  } else if ("exponential" in fn) {
    if (!Array.isArray(fn.exponential) || fn.exponential.length !== 1 || !Number.isFinite(fn.exponential[0]) || fn.exponential[0] <= 0 || fn.exponential[0] === 1) fail("fn.exponential 必須是 [正有限且不等於 1 的底數]；底數 1 請用 constant");
    exponentialBase = fn.exponential[0];
    exponential = Math.log(exponentialBase);
    if (!Number.isFinite(exponential) || exponential === 0) fail("fn.exponential 的底數無法可靠表示");
  } else if ("logarithmic" in fn) {
    if (!Array.isArray(fn.logarithmic) || fn.logarithmic.length !== 1 || !Number.isFinite(fn.logarithmic[0]) || fn.logarithmic[0] <= 0 || fn.logarithmic[0] === 1) fail("fn.logarithmic 必須是 [正有限且不等於 1 的底數]");
    logarithmicBase = fn.logarithmic[0];
    logarithmic = Math.log(logarithmicBase);
    if (!Number.isFinite(logarithmic) || logarithmic === 0) fail("fn.logarithmic 的底數無法可靠表示");
  } else if ("constant" in fn && Number.isFinite(fn.constant)) {
    b = fn.constant;
  } else fail("fn 只接受 constant、linear、quadratic、cubic、exponential 或 logarithmic 的有限係數");
  const domain = input.domain === undefined ? { from: null, to: null, openFrom: true, openTo: true } : input.domain;
  if (!domain || typeof domain !== "object") fail("domain 必須有 from、to、openFrom、openTo");
  for (const [end, open] of [["from", "openFrom"], ["to", "openTo"]] as const) {
    if ((domain[end] !== null && !Number.isFinite(domain[end])) || typeof domain[open] !== "boolean" || (domain[end] === null && !domain[open])) fail(`domain.${end} 須為有限數或 null；無窮端必須開放，${open} 須為布林值`);
  }
  const from = domain.from ?? -Infinity;
  const to = domain.to ?? Infinity;
  if (from > to || (from === to && (domain.openFrom || domain.openTo))) fail("domain 必須是非空遞增區間；同值兩端必須封閉");
  if (logarithmic !== undefined) {
    if (domain.from !== null && (domain.from < 0 || (domain.from === 0 && !domain.openFrom))) fail("fn.logarithmic 的 domain.from 必須為正數、開放的 0 或 null；天然定義域為 x > 0");
    if (domain.to !== null && domain.to <= 0) fail("fn.logarithmic 的 domain.to 必須為正數或 null；天然定義域為 x > 0");
  }
  const ticks = (range: GraphRange, step: number, key: string) => {
    if (!Number.isSafeInteger(step) || step < 1) fail(`${key} 必須是正整數`);
    const first = Math.ceil(range[0] / step);
    const last = Math.floor(range[1] / step);
    if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || last - first > 8) fail(`${key} 刻度過密，最多 8 段；請增加間距或拆圖`);
    const values = Array.from({ length: last - first + 1 }, (_, i) => (first + i) * step).filter((v) => v !== 0);
    if (values.some((v) => Math.abs(v) > 9999)) fail(`${key} 刻度最多 4 位數，請改用較大的單位`);
    return values;
  };
  const xTicks = ticks(input.xRange, input.xStep ?? 1, "xStep");
  const yTicks = ticks(input.yRange, input.yStep ?? 1, "yStep");
  const points = input.points ?? [];
  if (!Array.isArray(points) || points.length > 12) fail("points 最多 12 個；過密請拆圖");
  const names = new Set<string>();
  const evaluate = (x: number) => {
    if (logarithmic !== undefined) {
      if (!(x > 0)) fail("fn.logarithmic 的天然定義域為 x > 0");
      let y = Math.log(x) / logarithmic;
      // Recover an exactly representable integer inverse (e.g. log₃9=2),
      // but never round arbitrary nearby logarithm values.
      const integer = Math.round(y);
      if (Number.isSafeInteger(integer) && Math.abs(y - integer) <= 64 * Number.EPSILON * Math.max(1, Math.abs(y))
        && Math.pow(logarithmicBase!, integer) === x) y = integer;
      const error = 64 * Number.EPSILON * (Math.abs(y) + 1 / Math.abs(logarithmic));
      if (![y, error].every(Number.isFinite) || error > (input.yRange[1] - input.yRange[0]) * 1e-10) fail("fn.logarithmic 的函數值或底數數值精度不足，請調整底數或單位");
      return y;
    }
    if (exponential !== undefined) {
      const exponent = exponential * x, y = Math.pow(exponentialBase!, x);
      // This numerical budget is separate from the interpolation remainder.
      const error = 64 * Number.EPSILON * Math.max(1, Math.abs(exponent)) * y;
      if (![exponent, y, error].every(Number.isFinite) || y <= 0 || error > (input.yRange[1] - input.yRange[0]) * 1e-10) fail("fn.exponential 的函數值溢位、下溢或數值精度不足，請調整底數或單位");
      return y;
    }
    if (cubic !== 0) {
      const terms = [cubic * x * x * x, q * x * x, a * x, b];
      const y = ((cubic * x + q) * x + a) * x + b;
      const error = terms.reduce((sum, v) => sum + Math.abs(v), 0) * Number.EPSILON * 12;
      if (![...terms, y, error].every(Number.isFinite) || error > (input.yRange[1] - input.yRange[0]) * 1e-8) fail("fn.cubic 的函數值溢位或數值精度不足，請調整係數或單位");
      return y;
    }
    if (q === 0) return a * x + b;
    const quadratic = q * x * x, linear = a * x;
    const y = (q * x + a) * x + b;
    // Reject overflow and visible cancellation error rather than silently drawing a false curve.
    const error = (Math.abs(quadratic) + Math.abs(linear) + Math.abs(b)) * Number.EPSILON * 8;
    if (![quadratic, linear, y, error].every(Number.isFinite) || error > (input.yRange[1] - input.yRange[0]) * 1e-8) fail("fn.quadratic 的函數值溢位或數值精度不足，請調整係數或單位");
    return y;
  };
  const vertexX = cubic !== 0 || q === 0 ? undefined : (-(a / q) / 2 || 0);
  if (vertexX !== undefined && !Number.isFinite(vertexX)) fail("fn.quadratic 的頂點超出可可靠計算的範圍");
  const vertex = vertexX === undefined ? undefined : { x: vertexX, y: evaluate(vertexX) };
  for (const [i, p] of points.entries()) {
    const key = `points[${i}]`;
    if (!p || !Array.isArray(p.at) || p.at.length !== 2 || !p.at.every(Number.isFinite)) fail(`${key}.at 必須是有限坐標`);
    const [x, y] = p.at;
    if (logarithmic !== undefined && x <= 0) fail(`${key}.at 必須符合對數天然定義域 x > 0`);
    if (x < input.xRange[0] || x > input.xRange[1] || y < input.yRange[0] || y > input.yRange[1]) fail(`${key}.at 必須在視窗內`);
    if (x < from || x > to || (x === from && domain.openFrom) || (x === to && domain.openTo)) fail(`${key}.at 必須在定義域內，不可標記開放端點`);
    const expected = evaluate(x);
    // Roundoff tolerance must remain invisible even when the author magnifies a tiny y range.
    const tolerance = Math.min(1e-10 * Math.max(1, Math.abs(y), Math.abs(expected)), (input.yRange[1] - input.yRange[0]) * 1e-8);
    if (!Number.isFinite(expected) || Math.abs(y - expected) > tolerance) fail(`${key}.at 不在函數曲線上`);
    if (p.name !== undefined) {
      if (typeof p.name !== "string" || !/^[A-NP-Z]$/.test(p.name) || names.has(p.name)) fail(`${key}.name 必須是 O 以外且不重複的單一大寫字母`);
      names.add(p.name);
    }
  }
  if (names.size > 4) fail("points 點名最多 4 個，請拆圖");
  const [xmin, xmax] = input.xRange;
  const [ymin, ymax] = input.yRange;
  const left = 60, right = 420, top = 54, bottom = 414;
  const width = 480, height = 474;
  const xUnit = 360 / (xmax - xmin), yUnit = 360 / (ymax - ymin);
  if (!Number.isFinite(xUnit) || !Number.isFinite(yUnit)) fail("範圍太小，無法可靠繪圖");
  const project = (x: number, y: number) => ({ x: left + (x - xmin) * xUnit, y: top + (ymax - y) * yUnit });
  const origin = project(0, 0);
  // Intersect analytically. Quadratics can have two disconnected visible branches.
  let start = Math.max(from, xmin), end = Math.min(to, xmax);
  const quadraticCurves: QuadraticCurve[] = [];
  const cubicCurves: CubicCurve[] = [];
  let logarithmicCurve: GraphPoint[] | undefined;
  const logarithmicErrorBounds: number[] = [];
  let exponentialCurve: GraphPoint[] | undefined;
  const exponentialErrorBounds: number[] = [];
  let curve: { from: GraphPoint; to: GraphPoint } | undefined;
  if (logarithmic !== undefined) {
    const roots = [Math.pow(logarithmicBase!, ymin), Math.pow(logarithmicBase!, ymax)];
    if (!roots.every((x) => Number.isFinite(x) && x > 0) || roots[0] === roots[1]) fail("fn.logarithmic 與視窗交點溢位、下溢或數值精度不足");
    for (const [i, root] of roots.entries()) {
      if (Math.abs(evaluate(root) - [ymin, ymax][i]!) > (ymax - ymin) * 1e-10) fail("fn.logarithmic 與視窗交點的數值精度不足");
    }
    const low = Math.min(...roots), high = Math.max(...roots);
    // Natural domain x>0 is applied even when the authored domain is omitted.
    // Keep a finite original boundary already on the curve, avoiding inverse-roundoff loss.
    const inside = (x: number) => x > 0 && evaluate(x) >= ymin && evaluate(x) <= ymax;
    if (!inside(start)) start = Math.max(start, low);
    if (!inside(end)) end = Math.min(end, high);
    if (start <= 0 || start > end || (start === end && ((start === from && domain.openFrom) || (end === to && domain.openTo)))) fail("domain 與視窗內沒有可見圖形，請調整範圍");
    if (start * xUnit < 4) fail("fn.logarithmic 曲線距 y 軸不足 4 個 viewBox 單位，請縮短縱軸範圍或放大橫軸比例");
    if (from !== to) {
      const projectedStart = project(start, evaluate(start)), projectedEnd = project(end, evaluate(end));
      logarithmicCurve = [projectedStart];
      const cuts = [...new Set([start, ...points.map((p) => p.at[0]).filter((x) => x > start && x < end
        && project(x, 0).x > projectedStart.x && project(x, 0).x < projectedEnd.x), end])].sort((x, y) => x - y);
      const append = (u: number, v: number, depth: number) => {
        // max|f''| = 1/(|log(base)| u²). Use h/u to avoid squaring tiny u first.
        const bound = ((v - u) / u) ** 2 * yUnit / (8 * Math.abs(logarithmic!)) * (1 + 64 * Number.EPSILON) + 1e-6;
        if (!Number.isFinite(bound)) fail("fn.logarithmic 的近似誤差界無法可靠計算");
        const first = project(u, evaluate(u)), last = project(v, evaluate(v));
        if (![first.x, first.y, last.x, last.y].every(Number.isFinite) || (u !== v && first.x === last.x)) fail("fn.logarithmic 的投影數值精度不足");
        if (bound <= 0.1) {
          if (logarithmicErrorBounds.length >= 4096) fail("fn.logarithmic 近似超過 4096 段，請調整範圍");
          logarithmicCurve!.push(last);
          logarithmicErrorBounds.push(bound);
          return;
        }
        const mid = u + (v - u) / 2;
        if (depth >= 64 || mid === u || mid === v) fail("fn.logarithmic 無法在近似誤差上限內可靠細分");
        append(u, mid, depth + 1);
        append(mid, v, depth + 1);
      };
      for (let i = 1; i < cuts.length; i++) append(cuts[i - 1]!, cuts[i]!, 0);
      if (start === end) append(start, end, 0);
    }
  } else if (exponential !== undefined) {
    if (ymax <= 0) fail("fn.exponential 在視窗內沒有可見圖形，請調整範圍");
    const boundary = Math.log(ymax) / exponential;
    if (!Number.isFinite(boundary)) fail("fn.exponential 與視窗交點的數值精度不足");
    if (boundary >= start && boundary <= end && Math.abs(evaluate(boundary) - ymax) > (ymax - ymin) * 1e-10) fail("fn.exponential 與視窗交點的數值精度不足");
    // Preserve exact finite domain/window endpoints (e.g. 3²=9) when logarithm
    // roundoff puts the inverse boundary a few ulps on the wrong side.
    if (exponential > 0) {
      if (Math.pow(exponentialBase!, end) > ymax) end = Math.min(end, boundary);
    } else if (Math.pow(exponentialBase!, start) > ymax) start = Math.max(start, boundary);
    if (start > end || (start === end && ((start === from && domain.openFrom) || (end === to && domain.openTo)))) fail("domain 與視窗內沒有可見圖形，請調整範圍");
    const lowY = Math.min(evaluate(start), evaluate(end));
    // Do not silently flatten, truncate, or clamp an indistinguishable tail to y=0.
    if (lowY * yUnit < 4) fail("fn.exponential 曲線距 x 軸不足 4 個 viewBox 單位，請縮短橫軸範圍或放大縱軸比例");
    if (from !== to) {
      const projectedStart = project(start, evaluate(start)), projectedEnd = project(end, evaluate(end));
      exponentialCurve = [projectedStart];
      // Exact marked x values become interpolation nodes unless indistinguishable
      // from an existing window endpoint at this projection precision.
      const cuts = [...new Set([start, ...points.map((p) => p.at[0]).filter((x) => x > start && x < end
        && project(x, 0).x > projectedStart.x && project(x, 0).x < projectedEnd.x), end])].sort((x, y) => x - y);
      const append = (u: number, v: number, depth: number) => {
        const y0 = evaluate(u), y1 = evaluate(v), h = v - u;
        // Linear-interpolation remainder: h² max|f''| / 8; f''=log(base)² f.
        // The extra 1e-6 SVG units reserve room for the guarded floating calculations.
        const bound = (h * exponential!) ** 2 * Math.max(y0, y1) * yUnit / 8 * (1 + 64 * Number.EPSILON) + 1e-6;
        if (!Number.isFinite(bound)) fail("fn.exponential 的近似誤差界無法可靠計算");
        const first = project(u, y0), last = project(v, y1);
        if (![first.x, first.y, last.x, last.y].every(Number.isFinite) || (u !== v && first.x === last.x)) fail("fn.exponential 的投影數值精度不足");
        if (bound <= 0.1) {
          if (exponentialErrorBounds.length >= 4096) fail("fn.exponential 近似超過 4096 段，請調整範圍");
          exponentialCurve!.push(last);
          exponentialErrorBounds.push(bound);
          return;
        }
        const mid = u + (v - u) / 2;
        if (depth >= 64 || mid === u || mid === v) fail("fn.exponential 無法在近似誤差上限內可靠細分");
        append(u, mid, depth + 1);
        append(mid, v, depth + 1);
      };
      for (let i = 1; i < cuts.length; i++) append(cuts[i - 1]!, cuts[i]!, 0);
      if (start === end) append(start, end, 0);
    }
  } else if (cubic !== 0) {
    if (start > end) fail("domain 與視窗內沒有可見圖形，請調整範圍");
    const numericalFailure = () => fail("fn.cubic 的交點或導函數數值精度不足，請調整係數或單位");
    const stationary = quadraticRoots(3 * cubic, 2 * q, a, numericalFailure).filter((x) => x > start && x < end);
    const cuts = [...new Set([start, ...stationary, end])].sort((x, y) => x - y);
    const intervals: GraphRange[] = [];
    const derivative = (x: number) => {
      const value = (3 * cubic * x + 2 * q) * x + a;
      if (!Number.isFinite(value)) numericalFailure();
      return value;
    };
    // Each interval is monotone. Bisection solves a bracketed boundary equation;
    // it does not approximate the drawn curve with sampled segments.
    const boundaryRoot = (lo: number, hi: number, target: number) => {
      const initialLow = evaluate(lo), initialHigh = evaluate(hi);
      if (initialLow === target) return lo;
      if (initialHigh === target) return hi;
      const increasing = initialHigh > initialLow;
      for (let i = 0; i < 160; i++) {
        const mid = lo + (hi - lo) / 2, value = evaluate(mid);
        if (value === target) return mid;
        if (Math.abs(value - target) <= (ymax - ymin) * 1e-11 && hi - lo <= (xmax - xmin) * 1e-11) return mid;
        if (mid === lo || mid === hi) numericalFailure();
        if ((value < target) === increasing) lo = mid; else hi = mid;
      }
      return numericalFailure();
    };
    for (let i = 1; i < cuts.length; i++) {
      const lo = cuts[i - 1]!, hi = cuts[i]!;
      const y0 = evaluate(lo), y1 = evaluate(hi);
      if (Math.max(y0, y1) < ymin || Math.min(y0, y1) > ymax) continue;
      let u = lo, v = hi;
      if (y0 < ymin) u = boundaryRoot(lo, hi, ymin);
      else if (y0 > ymax) u = boundaryRoot(lo, hi, ymax);
      if (y1 < ymin) v = boundaryRoot(lo, hi, ymin);
      else if (y1 > ymax) v = boundaryRoot(lo, hi, ymax);
      if (u > v) numericalFailure();
      if (u === v && ((u === from && domain.openFrom) || (u === to && domain.openTo))) continue;
      intervals.push([u, v]);
    }
    if (start === end && evaluate(start) >= ymin && evaluate(start) <= ymax
      && !(start === from && domain.openFrom) && !(start === to && domain.openTo)) intervals.push([start, start]);
    if (!intervals.length) fail("domain 與視窗內沒有可見圖形，請調整範圍");
    const unique = intervals.filter(([u, v], i) => u !== v || !intervals.some(([lo, hi], j) => j !== i && lo <= u && hi >= v && (lo !== hi || j < i)));
    if (from !== to) for (const [u, v] of unique) {
      const third = (v - u) / 3;
      const segment = { from: project(u, evaluate(u)), control1: project(u + third, evaluate(u) + derivative(u) * third),
        control2: project(v - third, evaluate(v) - derivative(v) * third), to: project(v, evaluate(v)) };
      if (!Object.values(segment).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
        || (u !== v && segment.from.x === segment.to.x)) numericalFailure();
      cubicCurves.push(segment);
    }
  } else if (q !== 0) {
    if (start > end) fail("domain 與視窗內沒有可見圖形，請調整範圍");
    const cuts = [start, end];
    if (vertex!.x > start && vertex!.x < end) cuts.push(vertex!.x);
    for (const y of [ymin, ymax]) {
      const square = (y - vertex!.y) / q;
      if (!Number.isFinite(square)) fail("fn.quadratic 與視窗的交點超出可可靠計算的範圍");
      if (square < 0) continue;
      const distance = Math.sqrt(square);
      const roots = [vertex!.x - distance, vertex!.x + distance];
      if (!roots.every(Number.isFinite) || (distance !== 0 && roots[0] === roots[1])) fail("fn.quadratic 與視窗交點的數值精度不足，請調整係數或單位");
      for (const x of roots) if (x >= start && x <= end) {
        if (Math.abs(evaluate(x) - y) > (ymax - ymin) * 1e-8) fail("fn.quadratic 與視窗交點的數值精度不足，請調整係數或單位");
        cuts.push(x);
      }
    }
    const sorted = [...new Set(cuts)].sort((x, y) => x - y);
    const inside = (x: number) => { const y = evaluate(x); return y >= ymin && y <= ymax; };
    const intervals: GraphRange[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const x0 = sorted[i - 1]!, x1 = sorted[i]!;
      if (inside(x0 + (x1 - x0) / 2)) intervals.push([x0, x1]);
    }
    // Keep a genuine tangent intersection, but never a point excluded by the domain.
    for (const x of sorted) {
      if (inside(x) && !(x === from && domain.openFrom) && !(x === to && domain.openTo)
        && !intervals.some(([lo, hi]) => x >= lo && x <= hi)) intervals.push([x, x]);
    }
    if (!intervals.length) fail("domain 與視窗內沒有可見圖形，請調整範圍");
    if (from !== to) for (const [x0, x1] of intervals) {
      const y0 = evaluate(x0), y1 = evaluate(x1);
      const mid = x0 + (x1 - x0) / 2;
      // A polynomial quadratic is exactly a quadratic Bézier; this is not sampled interpolation.
      const controlY = y0 + (2 * q * x0 + a) * (x1 - x0) / 2;
      const segment = { from: project(x0, y0), control: project(mid, controlY), to: project(x1, y1) };
      if (!Object.values(segment).every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))) fail("fn.quadratic 的曲線控制點超出可可靠計算的範圍");
      if (x0 !== x1 && segment.from.x === segment.to.x) fail("fn.quadratic 的曲線寬度數值精度不足，請調整係數或單位");
      quadraticCurves.push(segment);
    }
  } else {
    if (a !== 0) {
      const low = (ymin - b) / a, high = (ymax - b) / a;
      if (!Number.isFinite(low) || !Number.isFinite(high)) fail("fn 與視窗的交點超出可可靠計算的範圍");
      if (low === high) fail("fn 與視窗交點的數值精度不足，請調整係數或單位");
      start = Math.max(start, Math.min(low, high));
      end = Math.min(end, Math.max(low, high));
    } else if (b < ymin || b > ymax) {
      fail("fn 在視窗內沒有可見圖形，請調整範圍");
    }
    if (start > end || (start === end && ((start === from && domain.openFrom) || (end === to && domain.openTo)))) fail("domain 與視窗內沒有可見圖形，請調整範圍");
    const startY = evaluate(start), endY = evaluate(end);
    if (![startY, endY].every(Number.isFinite)) fail("fn 的函數值超出可可靠計算的範圍");
    curve = from !== to ? { from: project(start, Math.max(ymin, Math.min(ymax, startY))), to: project(end, Math.max(ymin, Math.min(ymax, endY))) } : undefined;
  }
  const endpoints: { x: number; y: number; open: boolean }[] = [];
  for (const [x, open] of [[domain.from, domain.openFrom], [domain.to, domain.openTo]] as const) {
    if (x === null || x < xmin || x > xmax) continue;
    if ((exponential !== undefined || logarithmic !== undefined) && (x < start || x > end)) continue;
    if (logarithmic !== undefined && x <= 0) continue;
    const y = evaluate(x);
    if (!Number.isFinite(y)) fail("domain 端點的函數值超出可可靠計算的範圍");
    if (y < ymin || y > ymax) continue;
    const p = { ...project(x, y), open };
    if (from !== to || !endpoints.length) endpoints.push(p);
  }
  const resolvedPoints = points.map((p) => ({ ...project(...p.at), name: p.name }));
  const visiblePoints = resolvedPoints.filter((_, i) => points[i]!.at[0] !== domain.from && points[i]!.at[0] !== domain.to);
  const markers = [...endpoints.map((p) => ({ ...p, radius: 7.5 })), ...visiblePoints.map((p) => ({ ...p, radius: 5 }))];
  for (let i = 0; i < markers.length; i++) {
    for (const other of markers.slice(i + 1)) {
      const p = markers[i]!;
      if (Math.hypot(p.x - other.x, p.y - other.y) < p.radius + other.radius + 2) fail("points 或 domain 端點標記太近而互相遮擋，請調整範圍或拆圖");
    }
  }
  const format = (n: number) => String(n).replace("-", "−");
  const texts: GraphText[] = [
    { x: origin.x - 18, y: origin.y + 28, text: "O", kind: "axis" },
    { x: right + 25, y: origin.y + 7, text: "x", kind: "axis" },
    { x: origin.x, y: top - 24, text: "y", kind: "axis" },
    ...xTicks.map((v): GraphText => ({ x: project(v, 0).x, y: origin.y + 28, text: format(v), kind: "tick", axis: "x" })),
    ...yTicks.map((v): GraphText => ({ x: origin.x - 25, y: project(0, v).y + 7, text: format(v), kind: "tick", axis: "y" })),
  ];
  const markerBoxes = [...endpoints, ...resolvedPoints].map((p) => ({ left: p.x - 8, right: p.x + 8, top: p.y - 8, bottom: p.y + 8 }));
  const axisBoxes = [
    { left: left - 10, right: right + 10, top: origin.y - 2, bottom: origin.y + 2 },
    { left: origin.x - 2, right: origin.x + 2, top: top - 10, bottom: bottom + 10 },
  ];
  const approximateCrossesBox = (box: Box) => {
    if (!exponentialCurve && !logarithmicCurve) return false;
    const lo = Math.max(start, xmin + (box.left - 2 - left) / xUnit);
    const hi = Math.min(end, xmin + (box.right + 2 - left) / xUnit);
    if (lo > hi) return false;
    const y0 = project(lo, evaluate(lo)).y, y1 = project(hi, evaluate(hi)).y;
    // Monotonicity gives the complete true y range; expand by the 0.1-unit
    // approximation allowance to cover both the function and rendered polyline.
    return Math.min(y0, y1) <= box.bottom + 2.1 && Math.max(y0, y1) >= box.top - 2.1;
  };
  const fits = (t: GraphText, other: GraphText[]) => {
    const box = textBox(t);
    return box.left >= 4 && box.right <= width - 4 && box.top >= 4 && box.bottom <= height - 4
      && ![...other.map(textBox), ...markerBoxes, ...axisBoxes].some((b) => overlaps(box, b))
      && (!curve || !crossesBox(curve, box))
      && !quadraticCurves.some((segment) => quadraticCrossesBox(segment, box))
      && !cubicCurves.some((segment) => cubicCrossesBox(segment, box, () => fail("fn.cubic 的標記避讓數值精度不足")))
      && !approximateCrossesBox(box);
  };
  // Include endpoints and all axis names in avoidance, not just curve/tick intersections.
  for (let i = 0; i < texts.length; i++) {
    const t = texts[i]!;
    const other = texts.filter((_, j) => i !== j);
    if (fits(t, other)) continue;
    const offsets = t.axis === "x" ? [[0, -44], [-20, 0], [20, 0], [-20, -44], [20, -44]]
      : t.axis === "y" ? [[50, 0], [0, -22], [0, 22], [50, -22], [50, 22]]
      : [[0, -44], [36, 0], [-18, 0], [0, 18], [36, -44]];
    const moved = offsets.map(([dx, dy]) => ({ ...t, x: t.x + dx!, y: t.y + dy! })).find((candidate) => fits(candidate, other));
    if (!moved) fail(`標記 ${t.text} 無法避讓曲線、端點或其他文字，請增加刻度間距、調整範圍或拆圖`);
    texts[i] = moved!;
  }
  for (const p of resolvedPoints) {
    if (!p.name) continue;
    const offsets = [[19, -15], [-19, -15], [19, 30], [-19, 30], [0, -20], [0, 36], [30, 7], [-30, 7]];
    const label = offsets.map(([dx, dy]): GraphText => ({ x: p.x + dx!, y: p.y + dy!, text: p.name!, kind: "name" })).find((t) => fits(t, texts));
    if (!label) fail(`points 點名 ${p.name} 無法避讓，請調整範圍或拆圖`);
    texts.push(label!);
  }
  return { width, height, left, right, top, bottom, origin, curve, quadraticCurves, cubicCurves, exponentialCurve, exponentialErrorBounds, logarithmicCurve, logarithmicErrorBounds, vertex, endpoints, points: visiblePoints, texts,
    xTicks: xTicks.map((v) => project(v, 0)), yTicks: yTicks.map((v) => project(0, v)) };

}

interface GraphText { x: number; y: number; text: string; kind: "tick" | "axis" | "name"; axis?: "x" | "y" }
interface Box { left: number; right: number; top: number; bottom: number }
function textBox(t: GraphText): Box {
  const width = t.text.length * 15;
  return { left: t.x - width / 2 - 3, right: t.x + width / 2 + 3, top: t.y - 23, bottom: t.y + 5 };
}
function overlaps(a: Box, b: Box) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
function crossesBox(line: { from: { x: number; y: number }; to: { x: number; y: number } }, b: Box) {
  let from = 0, to = 1;
  for (const [start, end, low, high] of [[line.from.x, line.to.x, b.left - 2, b.right + 2], [line.from.y, line.to.y, b.top - 2, b.bottom + 2]]) {
    const delta = end! - start!;
    if (delta === 0) {
      if (start! < low! || start! > high!) return false;
    } else {
      const a = (low! - start!) / delta, z = (high! - start!) / delta;
      from = Math.max(from, Math.min(a, z));
      to = Math.min(to, Math.max(a, z));
      if (from > to) return false;
    }
  }
  return true;
}

interface GraphPoint { x: number; y: number }
interface QuadraticCurve { from: GraphPoint; control: GraphPoint; to: GraphPoint }
// x(t) is linear for these exact polynomial Béziers. Restrict t to the box's
// x span, then use the quadratic's endpoints and interior extremum to find its
// entire y range. A narrow intersection cannot hide between sampled points.
function quadraticCrossesBox(curve: QuadraticCurve, box: Box) {
  const dx = curve.to.x - curve.from.x;
  const lo = dx === 0 ? 0 : Math.max(0, (box.left - 2 - curve.from.x) / dx);
  const hi = dx === 0 ? 1 : Math.min(1, (box.right + 2 - curve.from.x) / dx);
  if (lo > hi || (dx === 0 && (curve.from.x < box.left - 2 || curve.from.x > box.right + 2))) return false;
  const value = (t: number) => (1 - t) ** 2 * curve.from.y + 2 * (1 - t) * t * curve.control.y + t ** 2 * curve.to.y;
  const values = [value(lo), value(hi)];
  const denominator = curve.from.y - 2 * curve.control.y + curve.to.y;
  const t = (curve.from.y - curve.control.y) / denominator;
  if (denominator !== 0 && t > lo && t < hi) values.push(value(t));
  return Math.min(...values) <= box.bottom + 2 && Math.max(...values) >= box.top - 2;
}

interface CubicCurve { from: GraphPoint; control1: GraphPoint; control2: GraphPoint; to: GraphPoint }
/** Stable quadratic roots, restricted to the cubic family's derivative equations. */
function quadraticRoots(a: number, b: number, c: number, fail: () => never): number[] {
  if (![a, b, c].every(Number.isFinite)) return fail();
  if (a === 0) {
    if (b === 0) return [];
    const root = -c / b;
    if (!Number.isFinite(root)) return fail();
    return [root];
  }
  const scale = Math.max(Math.abs(a), Math.abs(b), Math.abs(c));
  const aa = a / scale, bb = b / scale, cc = c / scale;
  if (aa === 0 || (b !== 0 && bb === 0) || (c !== 0 && cc === 0)) return fail();
  const squared = bb * bb, product = 4 * aa * cc;
  if ((bb !== 0 && squared === 0) || (cc !== 0 && product === 0)) return fail();
  const discriminant = squared - product;
  if (discriminant !== 0 && Math.abs(discriminant) < Number.EPSILON * 8 * (squared + Math.abs(product))) return fail();
  if (discriminant < 0) return [];
  if (discriminant === 0) {
    const root = -bb / (2 * aa);
    if (!Number.isFinite(root)) return fail();
    return [root];
  }
  const q = -(bb + (bb >= 0 ? 1 : -1) * Math.sqrt(discriminant)) / 2;
  const roots = [q / aa, cc / q];
  if (!roots.every(Number.isFinite) || roots[0] === roots[1]) return fail();
  return roots.sort((x, y) => x - y);
}
function cubicCrossesBox(curve: CubicCurve, box: Box, fail: () => never) {
  const dx = curve.to.x - curve.from.x;
  const lo = dx === 0 ? 0 : Math.max(0, (box.left - 2 - curve.from.x) / dx);
  const hi = dx === 0 ? 1 : Math.min(1, (box.right + 2 - curve.from.x) / dx);
  if (lo > hi || (dx === 0 && (curve.from.x < box.left - 2 || curve.from.x > box.right + 2))) return false;
  const [p0, p1, p2, p3] = [curve.from.y, curve.control1.y, curve.control2.y, curve.to.y];
  const value = (t: number) => (1 - t) ** 3 * p0! + 3 * (1 - t) ** 2 * t * p1! + 3 * (1 - t) * t * t * p2! + t ** 3 * p3!;
  const values = [value(lo), value(hi)];
  const roots = quadraticRoots(-p0! + 3 * p1! - 3 * p2! + p3!, 2 * (p0! - 2 * p1! + p2!), p1! - p0!, fail);
  for (const t of roots) if (t > lo && t < hi) values.push(value(t));
  return Math.min(...values) <= box.bottom + 2 && Math.max(...values) >= box.top - 2;
}
