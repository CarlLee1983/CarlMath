// 結構化資料（JSON-LD）：只做 WebSite 與 BreadcrumbList，理由見 .scratch/seo/spec.md 的 Further Notes。

export type JsonLd = Record<string, unknown>;

const SITE_NAME = "CarlMath";

/** 首頁的 WebSite：讓搜尋結果顯示網站名稱 CarlMath。 */
export function websiteJsonLd(site: URL | string): JsonLd {
  return { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: new URL("/", site).href };
}

/** 已撰寫單元頁的三層麵包屑：CarlMath → 階段（課程地圖錨點）→ 單元（canonical）。 */
export function unitBreadcrumbJsonLd(
  site: URL | string,
  stage: { id: string; title: string },
  unit: { id: string; title: string },
): JsonLd {
  const crumbs = [
    { name: SITE_NAME, item: new URL("/", site).href },
    // 錨點格式與 src/pages/map.astro 的 `stage-${stage.id}` 一致
    { name: stage.title, item: new URL(`/map/#stage-${stage.id}`, site).href },
    { name: unit.title, item: new URL(`/units/${unit.id}/`, site).href },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({ "@type": "ListItem", position: i + 1, ...crumb })),
  };
}

/** 序列化成可放進 <script> 的 JSON：把 `<` 轉成 <，避免內容裡的 `</script>` 提前結束標籤。 */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
