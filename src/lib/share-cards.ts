import { SHARE_IMAGE_HEIGHT, SHARE_IMAGE_WIDTH, shareImageFileName, type ShareCard } from "./share-image.ts";

// 全站預設分享圖：CarlMath 加上首頁標語（對應首頁 hero 的「從數數／到微積分」）。
export const DEFAULT_SHARE_CARD: ShareCard = { id: "default", title: "CarlMath", question: "從數數，到微積分" };

/** 要在 build 時輸出的全部分享圖；之後單元圖也加在這裡。 */
export function allShareCards(): ShareCard[] {
  return [DEFAULT_SHARE_CARD];
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
