import { test, expect } from "@playwright/test";

// robots.txt、favicon、apple-touch-icon 與 theme-color。
// theme-color 的值對應 src/styles/global.css 的 --bg（light-dark(亮色, 暗色)）。
const LIGHT_BG = "#ddd6c6";
const DARK_BG = "#1c1d19";

test("robots.txt 全部開放並指向 sitemap，不寫個別爬蟲", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("text/plain");
  const lines = (await response.text()).split("\n").map((line) => line.trim()).filter(Boolean);
  expect(lines).toEqual(["User-agent: *", "Allow: /", "Sitemap: https://math.gravito.dev/sitemap-index.xml"]);
});

test("文件外殼指向 SVG favicon 與 apple-touch-icon，且都能取得", async ({ page, request }) => {
  for (const path of ["/", "/units/fx-count/", "/404/"]) {
    await page.goto(path);
    const icon = page.locator('link[rel="icon"]');
    await expect(icon, path).toHaveCount(1);
    await expect(icon).toHaveAttribute("type", "image/svg+xml");
    const touch = page.locator('link[rel="apple-touch-icon"]');
    await expect(touch, path).toHaveCount(1);
    await expect(touch).toHaveAttribute("href", /\.png$/);
  }

  await page.goto("/");
  const svg = await request.get((await page.locator('link[rel="icon"]').getAttribute("href"))!);
  expect(svg.ok()).toBe(true);
  expect(svg.headers()["content-type"]).toContain("image/svg+xml");
  expect(await svg.text()).toContain("<svg");

  const png = await request.get((await page.locator('link[rel="apple-touch-icon"]').getAttribute("href"))!);
  expect(png.ok()).toBe(true);
  expect(png.headers()["content-type"]).toContain("image/png");
  const bytes = await png.body();
  expect(bytes.subarray(1, 4).toString("latin1")).toBe("PNG");
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([180, 180]);
});

test("亮色與暗色各有一個 theme-color，值取自頁面底色", async ({ page }) => {
  for (const path of ["/", "/units/fx-count/", "/404/"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="theme-color"]'), path).toHaveCount(2);
    await expect(page.locator('meta[name="theme-color"][media="(prefers-color-scheme: light)"]')).toHaveAttribute("content", LIGHT_BG);
    await expect(page.locator('meta[name="theme-color"][media="(prefers-color-scheme: dark)"]')).toHaveAttribute("content", DARK_BG);
  }
});
