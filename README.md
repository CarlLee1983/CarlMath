# CarlMath

重直覺與推理的中小學數學自學教材網站，網址 https://math.gravito.dev 。

## 技術

- Astro 7 靜態輸出，pnpm
- 教材為 `.mdx`，數學式在 build 期由 remark-math、rehype-katex 輸出（`htmlAndMathml`），錯誤的數學式會讓 build 失敗
- 部署目標為 Cloudflare Workers Static Assets

## 指令

| 指令 | 用途 |
| --- | --- |
| `pnpm dev` | 本機開發 |
| `pnpm build` | 建置到 `dist/` |
| `pnpm preview` | 預覽 `dist/` |
| `pnpm check` | `astro check` |
| `pnpm test` | `node --test`（含數學式錯誤會讓 build 失敗的測試） |
| `pnpm test:e2e` | 以 fixture 內容 build 到 `dist-e2e/`，再跑 Playwright 與 axe |
| `pnpm deploy:dry` | `wrangler deploy --dry-run`（先 build 再 dry-run） |

## 內容目錄

教材預設放在 `content/lessons`，可用環境變數 `CARLMATH_CONTENT_DIR` 指向別處（相對或絕對路徑），測試即以此指向 `tests/fixtures/`。
