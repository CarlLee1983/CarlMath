import { test, expect } from "@playwright/test";

// robots.txt、favicon、apple-touch-icon 與 theme-color。
// theme-color 要與頁面實際的底色一致：不寫死色票，直接讀頁面 computed 的 background-color。

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

const toHex = (rgb: string) => {
  const [r, g, b] = rgb.match(/\d+(\.\d+)?/g)!.map(Number);
  return `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("")}`;
};

test("亮色與暗色各有一個 theme-color，值等於該主題下的頁面底色", async ({ page }, testInfo) => {
  // light／dark 由 project 的 colorScheme 決定；narrow project 沿用預設的 light
  const scheme = testInfo.project.name === "desktop-dark" ? "dark" : "light";
  for (const path of ["/", "/units/fx-count/", "/404/"]) {
    await page.goto(path);
    await expect(page.locator('meta[name="theme-color"]'), path).toHaveCount(2);
    const bg = await page.evaluate(() => {
      // 頁面底色畫在 html 或 body，取第一個不透明的
      for (const el of [document.documentElement, document.body]) {
        const color = getComputedStyle(el).backgroundColor;
        if (color !== "rgba(0, 0, 0, 0)" && color !== "transparent") return color;
      }
      return "";
    });
    expect(bg, path).not.toBe("");
    await expect(page.locator(`meta[name="theme-color"][media="(prefers-color-scheme: ${scheme})"]`), path).toHaveAttribute("content", toHex(bg));
  }
});
