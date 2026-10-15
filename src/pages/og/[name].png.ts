import type { APIRoute, GetStaticPaths } from "astro";
import { allShareCards } from "../../lib/share-cards.ts";
import { renderShareImage, shareImageFileName } from "../../lib/share-image.ts";

// 分享圖在 build 時輸出到 /og/<id>-<hash>.png。
export const getStaticPaths = (() =>
  allShareCards().map((card) => ({
    params: { name: shareImageFileName(card).replace(/\.png$/, "") },
    props: { card },
  }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ props }) => {
  const { png } = await renderShareImage(props.card);
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
};
