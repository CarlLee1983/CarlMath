import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import { unified } from "@astrojs/markdown-remark";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeKatexStrict from "./src/utils/rehype-katex-strict.mjs";
import katexErrorCheck from "./src/integrations/katex-error-check.mjs";
import rehypeKatexFocusable from "./src/utils/rehype-katex-focusable.mjs";
import { contentRoot } from "./src/content/content-dir.ts";
import { loadContent } from "./src/lib/content.ts";

// sitemap 排除未撰寫的單元頁；「哪些單元已撰寫」與頁面共用 loadContent 這個唯一來源。
// 內容有誤時不過濾（單元頁的 getStaticPaths 會讓 build 失敗）。
const loaded = loadContent(contentRoot());
const unwrittenUnitPaths = new Set(
  loaded.ok ? loaded.index.units.filter((unit) => !loaded.index.isWritten(unit.id)).map((unit) => `/units/${unit.id}/`) : [],
);

export default defineConfig({
  site: "https://math.gravito.dev",
  output: "static",
  trailingSlash: "always",
  build: { format: "directory" },
  // 預設輸出到 dist；e2e 以 ASTRO_OUT_DIR 另建，避免覆蓋正式輸出。
  outDir: process.env.ASTRO_OUT_DIR ?? "dist",
  integrations: [mdx(), sitemap({ filter: (url) => !unwrittenUnitPaths.has(new URL(url).pathname) }), katexErrorCheck()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        [
          rehypeKatex,
          {
            output: "htmlAndMathml", // 視覺用 HTML，螢幕閱讀器讀 MathML
            strict: "error", // 數學模式裡直接寫中文等不相容寫法視為錯誤
          },
        ],
        rehypeKatexStrict, // 必須排在 rehypeKatex 之後
        rehypeKatexFocusable, // 讓可水平捲動的區塊式能用鍵盤操作
      ],
    }),
  },
});
