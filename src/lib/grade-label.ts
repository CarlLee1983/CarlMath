/** 建議年級的顯示文字：單一年級「3 年級」，範圍「1–2 年級」。 */
export function gradeLabel({ min, max }: { min: number; max: number }): string {
  return min === max ? `${min} 年級` : `${min}–${max} 年級`;
}
