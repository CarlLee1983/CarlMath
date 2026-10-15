import { contentRoot } from "../content/content-dir.ts";
import { loadValidContent } from "./content.ts";
import { SHARE_IMAGE_HEIGHT, SHARE_IMAGE_WIDTH, shareImageFileName, type ShareCard } from "./share-image.ts";

// 全站預設分享圖：CarlMath 加上首頁標語（對應首頁 hero 的「從數數／到微積分」）。
export const DEFAULT_SHARE_CARD: ShareCard = { id: "default", title: "CarlMath", question: "從數數，到微積分" };

/** 單元的分享卡：階段名、單元標題、核心問題；檔名前綴是單元 id。 */
export function unitShareCard(unit: { id: string; title: string; coreQuestion: string }, stageTitle: string): ShareCard {
  return { id: unit.id, stage: stageTitle, title: unit.title, question: unit.coreQuestion };
}

/** 要在 build 時輸出的全部分享圖：預設圖，加上每個已撰寫單元一張（與頁面、sitemap 共用同一個內容載入來源）。 */
export function allShareCards(): ShareCard[] {
  const { index } = loadValidContent(contentRoot());
  const unitCards = index.units.filter((unit) => index.isWritten(unit.id)).map((unit) => unitShareCard(unit, index.stageOf(unit.id).title));
  return [DEFAULT_SHARE_CARD, ...unitCards];
}

/** 分享圖的 `/og/` 路徑（不含網域）。 */
export function shareImagePath(card: ShareCard): string {
  return `/og/${shareImageFileName(card)}`;
}

/** 文件外殼的 `image` prop：絕對網址、寬高與替代文字。 */
export function shareImageMeta(card: ShareCard, site: URL | string) {
  return {
    url: new URL(shareImagePath(card), site).href,
    width: SHARE_IMAGE_WIDTH,
    height: SHARE_IMAGE_HEIGHT,
    alt: `${card.title}：${card.question}`,
  };
}
