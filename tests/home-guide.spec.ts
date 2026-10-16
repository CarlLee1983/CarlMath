import { test, expect, type Locator, type Page } from "@playwright/test";

// 首頁與「親子共學怎麼用」，依 tests/fixtures/site/course-map.yaml：2 個階段、7 個單元，
// 已撰寫 fx-count（親子，updated 2026-10-01）、sum-demo（2026-10-10）、math-demo（2026-09-20）；第一個單元與第一個親子單元都是 fx-count。
const hrefs = (locator: Locator) => locator.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
const token = (page: Page, name: string) =>
  page.evaluate((n) => {
    const probe = document.createElement("div");
    document.body.append(probe);
    probe.style.color = `var(${n})`;
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }, name);

test.describe("首頁", () => {
  const selfDoor = (page: Page) => page.getByRole("region", { name: "我想自己重新學數學" });
  const parentDoor = (page: Page) => page.getByRole("region", { name: "我想陪孩子一起學" });

  test("頂部有站名、標語與由課程地圖推導的路線規模", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("CarlMath");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator(".home-hero")).toContainText("2 個階段、7 個單元");
  });

  test("自學者門通往課程地圖與第一個單元；家長門通往說明頁與第一篇親子篇", async ({ page }) => {
    await page.goto("/");
    expect(await hrefs(selfDoor(page).getByRole("link"))).toEqual(["/map/", "/units/fx-count/"]);
    expect(await hrefs(parentDoor(page).getByRole("link"))).toEqual(["/guide/", "/units/fx-count/"]);
    await expect(parentDoor(page)).toContainText("數一數");
  });

  test("家長門是金框", async ({ page }) => {
    await page.goto("/");
    const border = await parentDoor(page).evaluate((el) => getComputedStyle(el).borderTopColor);
    expect(border).toBe(await token(page, "--family"));
  });

  test("寬螢幕兩扇門並排，窄螢幕上下排", async ({ page }, testInfo) => {
    await page.goto("/");
    const [a, b] = [await selfDoor(page).boundingBox(), await parentDoor(page).boundingBox()];
    if (testInfo.project.name === "narrow") expect(b!.y).toBeGreaterThan(a!.y + a!.height - 1);
    else expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
  });

  test("撰寫進度條顯示已撰寫數／單元總數", async ({ page }) => {
    await page.goto("/");
    const bar = page.getByRole("progressbar", { name: "撰寫進度" });
    await expect(bar).toHaveAttribute("aria-valuenow", "4");
    await expect(bar).toHaveAttribute("aria-valuemax", "7");
    await expect(page.locator("main")).toContainText("4 / 7 個單元已撰寫");
  });

  test("已撰寫單元卡片依 updated 由新到舊，顯示序號、建議年級、核心問題與親子標記", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 2, name: "最近撰寫或更新" })).toBeVisible();
    const cards = page.locator(".home-card");
    expect(await hrefs(cards)).toEqual(["/units/sum-demo/", "/units/fx-count/", "/units/math-demo/", "/units/fx-ratio/"]);
    const sum = cards.nth(0);
    await expect(sum).toContainText("第 3 單元");
    await expect(sum).toContainText("2 年級");
    await expect(sum).toContainText("和的示範");
    await expect(sum).toContainText("兩個量合起來，怎麼用算式說清楚？");
    await expect(sum).not.toContainText("親子共學");
    await expect(cards.nth(1)).toContainText("親子共學");
  });

  test("連到課程地圖「只看已撰寫」", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: "看全部已撰寫的單元" });
    await expect(link).toHaveAttribute("href", "/map/?written=1");
    await link.click();
    await expect(page.getByRole("checkbox", { name: "只看已撰寫" })).toBeChecked();
  });
});

test.describe("親子共學怎麼用", () => {
  const path = "/guide/";

  test("標題、description，以及親子篇「給家長的話」連過來", async ({ page }) => {
    await page.goto("/units/fx-count/");
    const href = await page.locator("a", { hasText: "親子共學怎麼用" }).last().getAttribute("href");
    expect(href).toBe(path);
    await page.goto(path);
    await expect(page).toHaveTitle("親子共學怎麼用｜CarlMath");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("親子共學怎麼用");
    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /.+/);
  });

  test("讀懂 → 準備 → 動手 → 再問四步，各標時間與對應段落", async ({ page }) => {
    await page.goto(path);
    const steps = page.locator(".guide-step");
    await expect(steps.locator("h2")).toHaveText(["讀懂", "準備", "動手", "再問"]);
    for (const step of await steps.all()) {
      await expect(step.locator(".guide-time")).toHaveText(/\d+(–\d+)? 分鐘/);
      expect(await step.locator(".guide-uses li").count()).toBeGreaterThan(0);
    }
    await expect(steps.nth(0).locator(".guide-uses")).toContainText("大人先懂");
    await expect(steps.nth(2).locator(".guide-uses")).toContainText("親子活動");
    await expect(steps.nth(3).locator(".guide-uses")).toContainText("隔天再問");
    // 對應段落只列親子篇真正的段名
    await expect(steps.nth(1).locator(".guide-uses")).not.toContainText("可列印材料");
  });

  test("「動手」與「再問」用金色底，其餘不是", async ({ page }) => {
    await page.goto(path);
    const soft = await token(page, "--family-soft");
    const backgrounds = await page.locator(".guide-step").evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
    expect(backgrounds[2]).toBe(soft);
    expect(backgrounds[3]).toBe(soft);
    expect(backgrounds[0]).not.toBe(soft);
    expect(backgrounds[1]).not.toBe(soft);
  });

  test("三方分工：家長、孩子、網頁", async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 2, name: "三方分工" })).toBeVisible();
    await expect(page.locator(".guide-role h3")).toHaveText(["家長負責", "孩子負責", "網頁負責"]);
  });

  test("共用材料附列印連結，底部按鈕到第一個親子單元", async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 2, name: "共用材料" })).toBeVisible();
    const kit = page.locator(".guide-kit");
    await expect(kit).toContainText("小物");
    await expect(kit.getByRole("link", { name: /數字卡 0–20/ })).toHaveAttribute("href", "/print/number-cards/");
    await expect(page.getByRole("link", { name: "從「數一數」開始" })).toHaveAttribute("href", "/units/fx-count/");
  });
});

for (const path of ["/", "/guide/"]) {
  test(`${path} 在 320px 寬沒有水平捲軸`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "narrow", "只在 320px 驗證");
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  });
}
