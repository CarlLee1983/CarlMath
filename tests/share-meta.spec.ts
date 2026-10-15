import { test, expect, type Page } from "@playwright/test";

// 分享資訊（canonical、Open Graph、Twitter Card）：依 tests/fixtures/site，
// fx-count 為已撰寫的親子篇，math-demo 為已撰寫的一般篇，fx-fraction 為未撰寫單元。
const SITE = "https://math.gravito.dev";

const meta = (page: Page, key: string) => page.locator(`meta[property="${key}"], meta[name="${key}"]`);

const pages: { name: string; path: string; type: "website" | "article"; modified?: string; unitImage?: boolean }[] = [
  { name: "首頁", path: "/", type: "website" },
  { name: "導讀", path: "/guide/", type: "website" },
  { name: "課程地圖", path: "/map/", type: "website" },
  { name: "可列印材料", path: "/print/number-board/", type: "website" },
  { name: "已撰寫親子篇", path: "/units/fx-count/", type: "article", modified: "2026-10-01", unitImage: true },
  { name: "已撰寫一般篇", path: "/units/math-demo/", type: "article", modified: "2026-09-20", unitImage: true },
  { name: "未撰寫單元", path: "/units/fx-fraction/", type: "website" },
  { name: "404", path: "/404/", type: "website" },
];

for (const item of pages) {
  test(`${item.name}：canonical 與 Open Graph、Twitter Card`, async ({ page }) => {
    await page.goto(item.path);
    const canonical = `${SITE}${item.path}`;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", canonical);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);

    const title = await page.title();
    await expect(meta(page, "og:title")).toHaveAttribute("content", title);
    await expect(meta(page, "og:url")).toHaveAttribute("content", canonical);
    await expect(meta(page, "og:type")).toHaveAttribute("content", item.type);
    await expect(meta(page, "og:locale")).toHaveAttribute("content", "zh_TW");
    await expect(meta(page, "og:site_name")).toHaveAttribute("content", "CarlMath");
    await expect(meta(page, "twitter:card")).toHaveAttribute("content", "summary_large_image");
    await expect(meta(page, "twitter:site")).toHaveCount(0);

    const description = page.locator('meta[name="description"]');
    if (await description.count()) {
      await expect(meta(page, "og:description")).toHaveAttribute("content", (await description.getAttribute("content"))!);
    } else {
      await expect(meta(page, "og:description")).toHaveCount(0);
    }

    if (item.modified) {
      await expect(meta(page, "article:modified_time")).toHaveAttribute("content", item.modified);
    } else {
      await expect(meta(page, "article:modified_time")).toHaveCount(0);
    }
  });
}

test("404 與未撰寫單元頁有 noindex，其餘公開頁沒有", async ({ page }) => {
  for (const path of ["/404/", "/units/fx-fraction/"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  }
  for (const path of ["/", "/guide/", "/map/", "/print/number-board/", "/units/fx-count/", "/units/math-demo/"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  }
});

for (const item of pages) {
  test(`${item.name}：og:image 可取得、是 PNG，寬高與 meta 一致`, async ({ page, request }) => {
    await page.goto(item.path);
    const url = await meta(page, "og:image").getAttribute("content");
    // 已撰寫單元用自己的圖（見下方），其餘頁面用預設圖
    if (!item.unitImage) expect(url).toMatch(new RegExp(`^${SITE}/og/default-[0-9a-f]{10}\\.png$`));
    const width = Number(await meta(page, "og:image:width").getAttribute("content"));
    const height = Number(await meta(page, "og:image:height").getAttribute("content"));
    expect([width, height]).toEqual([1200, 630]);
    await expect(meta(page, "og:image:alt")).toHaveAttribute("content", /\S/);

    // 絕對網址指向正式網域；測試站台只取同一路徑
    const response = await request.get(new URL(url!).pathname);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
    const bytes = await response.body();
    expect(bytes.subarray(1, 4).toString("latin1")).toBe("PNG");
    // IHDR：偏移 16 起依序是寬、高（大端 32 位元）
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([width, height]);
  });
}

// 已撰寫單元各有自己的分享圖：/og/<單元 id>-<hash>.png，alt 為「<標題>：<核心問題>」。
const unitImages = [
  { path: "/units/fx-count/", id: "fx-count", alt: "數一數：怎麼知道有幾個？" },
  { path: "/units/math-demo/", id: "math-demo", alt: "數學式示範：數學式怎麼在頁面上正確呈現？" },
];

for (const item of unitImages) {
  test(`${item.path} 的 og:image 是單元專屬圖，可取得、1200×630、alt 正確`, async ({ page, request }) => {
    await page.goto(item.path);
    const url = (await meta(page, "og:image").getAttribute("content"))!;
    expect(url).toMatch(new RegExp(`^${SITE}/og/${item.id}-[0-9a-f]{10}\\.png$`));
    await page.goto("/");
    expect(url).not.toBe(await meta(page, "og:image").getAttribute("content"));
    await expect(meta(page, "og:image:width")).toHaveAttribute("content", "1200");

    const response = await request.get(new URL(url).pathname);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("image/png");
    const bytes = await response.body();
    expect(bytes.subarray(1, 4).toString("latin1")).toBe("PNG");
    expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630]);

    await page.goto(item.path);
    await expect(meta(page, "og:image:alt")).toHaveAttribute("content", item.alt);
  });
}

test("未撰寫單元頁使用預設圖，也不產它的單元圖", async ({ page, request }) => {
  await page.goto("/units/fx-fraction/");
  await expect(meta(page, "og:image")).toHaveAttribute("content", new RegExp(`^${SITE}/og/default-[0-9a-f]{10}\\.png$`));
  expect((await request.get("/og/fx-fraction-0000000000.png", { failOnStatusCode: false })).status()).toBe(404);
});

// 結構化資料：只有首頁（WebSite）與已撰寫單元頁（BreadcrumbList）有 JSON-LD
const jsonLd = async (page: Page) =>
  (await page.locator('script[type="application/ld+json"]').allTextContents()).map((text) => JSON.parse(text));

test("首頁輸出 WebSite JSON-LD", async ({ page }) => {
  await page.goto("/");
  const blocks = await jsonLd(page);
  expect(blocks).toHaveLength(1);
  expect(blocks[0]).toMatchObject({ "@context": "https://schema.org", "@type": "WebSite", name: "CarlMath", url: `${SITE}/` });
});

for (const unit of ["fx-count", "math-demo"]) {
  test(`已撰寫單元 ${unit} 輸出三層 BreadcrumbList`, async ({ page }) => {
    await page.goto(`/units/${unit}/`);
    const blocks = await jsonLd(page);
    expect(blocks).toHaveLength(1);
    const list = blocks[0];
    expect(list).toMatchObject({ "@context": "https://schema.org", "@type": "BreadcrumbList" });
    const items = list.itemListElement;
    expect(items.map((item: { position: number }) => item.position)).toEqual([1, 2, 3]);
    expect(items.map((item: { "@type": string }) => item["@type"])).toEqual(["ListItem", "ListItem", "ListItem"]);
    expect(items[0]).toMatchObject({ name: "CarlMath", item: `${SITE}/` });
    // 階段名與階段錨點要和課程地圖頁一致
    await page.goto("/map/");
    const stageId = new URL(items[1].item).hash.slice(1);
    expect(items[1].item).toBe(`${SITE}/map/#${stageId}`);
    expect(stageId).toMatch(/^stage-/);
    const stageHeading = await page.locator(`#${stageId} h2`).innerText();
    expect(stageHeading).toContain(items[1].name);
    await page.goto(`/units/${unit}/`);
    expect(items[2].item).toBe(`${SITE}/units/${unit}/`);
    expect(items[2].name).toBe(await page.locator("h1").innerText());
  });
}

test("其他頁面沒有 JSON-LD", async ({ page }) => {
  for (const path of ["/guide/", "/map/", "/print/number-board/", "/units/fx-fraction/", "/404/"]) {
    await page.goto(path);
    await expect(page.locator('script[type="application/ld+json"]'), path).toHaveCount(0);
  }
});

test("JSON-LD 序列化不會讓 </script> 提前結束", async ({ page }) => {
  await page.goto("/units/fx-count/");
  const raw = await page.locator('script[type="application/ld+json"]').innerHTML();
  expect(raw).not.toContain("<");
});
