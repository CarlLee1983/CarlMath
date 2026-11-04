export interface Dimensions { length: number; width: number; height: number }
export function normalizeDimensions(d: Dimensions, cube = false): Dimensions {
  for (const value of [d.length, d.width, d.height]) {
    if (!Number.isInteger(value) || value < 1 || value > 8) throw new RangeError('邊長必須是 1 到 8 的整數');
  }
  return cube ? { length: d.length, width: d.length, height: d.length } : { ...d };
}
export function layerArea(d: Dimensions): number { const n = normalizeDimensions(d); return n.length * n.width; }
export function volume(d: Dimensions): number { return layerArea(d) * normalizeDimensions(d).height; }
