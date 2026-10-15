import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

// 依 tests/fixtures/site/course-map.yaml：只有 math-demo 已撰寫。
const link = (page: import("@playwright/test").Page, name: string) => page.getByRole("link", { name, exact: true });

test("未撰寫單元頁列出狀態、階段、核心問題、建議年級", async ({ page }) => {
  await page.goto("/units/fx-fraction/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("分數");
  await expect(page.getByText("尚未撰寫", { exact: true }).first()).toBeVisible();
  await expect(page.locator("main")).toContainText("階段乙");
  await expect(page.locator("main")).toContainText("一個東西平分以後，每份怎麼記？");
  await expect(page.locator("main")).toContainText("7–8 年級");
  await expect(page.locator("main")).not.toContainText("親子共學");
});

test("單一年級顯示「N 年級」，親子單元才有親子標記", async ({ page }) => {
  await page.goto("/units/fx-count/");
  await expect(page.locator("main")).toContainText("1 年級");
  await expect(page.locator("main")).not.toContainText("1–1");
  await expect(page.getByText("親子共學", { exact: true })).toBeVisible();

  await page.goto("/units/fx-add/");
  await expect(page.locator("main")).toContainText("1–2 年級");
  await expect(page.getByText("親子共學", { exact: true })).toHaveCount(0);
});

test("直接先修與學完可接連到對應單元頁", async ({ page }) => {
  await page.goto("/units/fx-fraction/");
  const prerequisites = page.getByRole("region", { name: "直接先修" }).getByRole("link");
  await expect(prerequisites).toHaveText(["數學式示範", "比大小"]);
  expect(await prerequisites.evaluateAll((els) => els.map((el) => el.getAttribute("href")))).toEqual([
    "/units/math-demo/",
    "/units/fx-compare/",
  ]);
  await expect(page.getByRole("region", { name: "學完可接" })).toContainText("目前沒有其他單元以它為先修");

  await page.goto("/units/fx-count/");
  const dependents = page.getByRole("region", { name: "學完可接" }).getByRole("link");
  await expect(dependents).toHaveText(["合起來", "比大小"]);
  expect(await dependents.evaluateAll((els) => els.map((el) => el.getAttribute("href")))).toEqual([
    "/units/fx-add/",
    "/units/fx-compare/",
  ]);
  await expect(page.getByRole("region", { name: "直接先修" })).toContainText("沒有先修");
  await link(page, "合起來").click();
  await expect(page).toHaveURL(/\/units\/fx-add\/$/);
});

test("建議先讀依建議閱讀順序列出全部遞移先修並標示撰寫狀態", async ({ page }) => {
  await page.goto("/units/fx-fraction/");
  const items = page.getByRole("region", { name: "建議先讀" }).getByRole("listitem");
  await expect(items).toHaveText(["數一數尚未撰寫", "合起來尚未撰寫", "數學式示範", "比大小尚未撰寫"].map((s) => new RegExp(`^\\s*${s}\\s*$`)));
  const links = page.getByRole("region", { name: "建議先讀" }).getByRole("link");
  expect(await links.evaluateAll((els) => els.map((el) => el.getAttribute("href")))).toEqual([
    "/units/fx-count/",
    "/units/fx-add/",
    "/units/math-demo/",
    "/units/fx-compare/",
  ]);

  await page.goto("/units/fx-count/");
  await expect(page.getByRole("region", { name: "建議先讀" })).toContainText("不需要先讀");
});

test("未撰寫頁有 noindex，已撰寫頁沒有", async ({ page }) => {
  await page.goto("/units/fx-fraction/");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex");
  await page.goto("/units/math-demo/");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  await page.goto("/");
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test("sitemap 不含未撰寫單元頁，含已撰寫單元頁與首頁", async ({ request }) => {
  const index = await request.get("/sitemap-index.xml");
  expect(index.ok()).toBe(true);
  const xml = await (await request.get("/sitemap-0.xml")).text();
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  expect(urls).toContain("https://math.gravito.dev/");
  expect(urls).toContain("https://math.gravito.dev/units/math-demo/");
  expect(urls.filter((u) => u.includes("/units/fx-"))).toEqual([]);
});

test("各頁 title 與 description", async ({ page }) => {
  await page.goto("/units/fx-fraction/");
  await expect(page).toHaveTitle("分數｜CarlMath");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "一個東西平分以後，每份怎麼記？");

  await page.goto("/units/math-demo/");
  await expect(page).toHaveTitle("數學式示範｜CarlMath");
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", "數學式管線的 fixture 頁。");

  await page.goto("/");
  await expect(page).toHaveTitle("CarlMath");
});

test("320px 寬沒有水平捲軸", async ({ page }) => {
  test.skip(test.info().project.name !== "narrow", "只在 320px 寬的 project 驗證");
  await page.goto("/units/fx-fraction/");
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
});

test("axe 在未撰寫單元頁無 serious/critical 違規", async ({ page }) => {
  await page.goto("/units/fx-fraction/");
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
