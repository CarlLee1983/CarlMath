import { z } from "astro/zod";

/**
 * 教材 frontmatter 的唯一 schema：content collection（build）與 `loadContent`（CLI、build 前檢查）共用。
 * 只允許 unit、description、updated；標題、先修從課程地圖取，多餘欄位視為錯誤。
 */
export const lessonFrontmatterSchema = z.strictObject({
  // unit 會成為網址片段，只允許小寫英數與連字號
  unit: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  description: z.string().optional(),
  // 教材寫 YYYY-MM-DD。content collection 的 YAML 載入器會把它轉成 Date，先轉回日期字串，兩邊再用同一條規則驗證。
  updated: z.preprocess((value) => (value instanceof Date ? value.toISOString().slice(0, 10) : value), z.iso.date().optional()),
});
