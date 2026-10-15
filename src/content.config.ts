import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { contentLoaderBase } from "./content/content-dir";
import { lessonFrontmatterSchema } from "./lib/lesson-frontmatter";

// 內容根目錄由 CARLMATH_CONTENT_DIR 決定（教材在其下的 lessons/）：預設是正式教材，測試與 e2e 指向 fixture（相對或絕對路徑皆可）。
const lessons = defineCollection({
  loader: glob({
    base: contentLoaderBase(process.env.CARLMATH_CONTENT_DIR, "lessons"),
    pattern: "**/*.mdx",
  }),
  // 與 loadContent 共用同一份 schema（src/lib/lesson-frontmatter.ts）。
  schema: lessonFrontmatterSchema,
});

export const collections = { lessons };
