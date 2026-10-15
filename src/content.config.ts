import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";
import { contentLoaderBase } from "./content/content-dir";

// 內容根目錄由 CARLMATH_CONTENT_DIR 決定：預設是正式教材，測試與 e2e 指向 fixture（相對或絕對路徑皆可）。
const lessons = defineCollection({
  loader: glob({
    base: contentLoaderBase(process.env.CARLMATH_CONTENT_DIR, "content/lessons"),
    pattern: "**/*.mdx",
  }),
  // 完整的教材驗證屬於後續票；這裡只擋最基本的欄位。
  schema: z.object({
    // unit 會成為網址片段，只允許小寫英數與連字號
    unit: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    description: z.string().optional(),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { lessons };
