/**
 * 「最近撰寫或更新」：依 `updatedOf` 取得的 YYYY-MM-DD 由新到舊取前 `limit` 個。
 * 輸入依建議閱讀順序；同一天的維持該順序，沒有 updated 的排在最後。
 * YYYY-MM-DD 可以直接用字串比較大小；不改動輸入。
 */
export function recentlyUpdated<T>(units: readonly T[], updatedOf: (unit: T) => string | undefined, limit: number): T[] {
  return units
    .map((unit, order) => ({ unit, order, updated: updatedOf(unit) ?? "" }))
    .sort((a, b) => b.updated.localeCompare(a.updated) || a.order - b.order)
    .slice(0, limit)
    .map(({ unit }) => unit);
}
