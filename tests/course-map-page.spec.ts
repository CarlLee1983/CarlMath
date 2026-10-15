import { test, expect, type Locator, type Page } from "@playwright/test";

// 課程地圖頁（/map/），依 tests/fixtures/site/course-map.yaml：
// 階段甲 fx-count（親子、已撰寫）、fx-add、sum-demo（已撰寫）、math-demo（已撰寫）；階段乙 fx-compare（親子）、fx-fraction、fx-ratio。
const path = "/map/";
const ALL = ["fx-count", "fx-add", "sum-demo", "math-demo", "fx-compare", "fx-fraction", "fx-ratio"];

const row = (page: Page, id: string) => page.locator(`#unit-${id}`);
const visibleRows = (page: Page) =>
  page.locator(".map-row").evaluateAll((els) => els.filter((el) => (el as HTMLElement).offsetParent !== null).map((el) => el.id.replace(/^unit-/, "")));
const search = (page: Page) => page.getByRole("searchbox", { name: "搜尋單元" });
const familyOnly = (page: Page) => page.getByRole("checkbox", { name: "只看親子共學" });
const writtenOnly = (page: Page) => page.getByRole("checkbox", { name: "只看已撰寫" });
const texts = (locator: Locator) => locator.evaluateAll((els) => els.map((el) => el.textContent?.trim() ?? ""));

test("每個階段一節，單元依建議閱讀順序排列", async ({ page }) => {
  await page.goto(path);
  await expect(page).toHaveTitle("課程地圖｜CarlMath");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("課程地圖");
  await expect(page.locator(".map-stage h2")).toHaveText([/階段甲/, /階段乙/]);
  expect(await visibleRows(page)).toEqual(ALL);
  await expect(page.locator("#stage-stage-a .map-row")).toHaveCount(4);
  await expect(page.locator("#stage-stage-b .map-row")).toHaveCount(3);
});

test("每列顯示序號、標題連結、核心問題、直接先修、親子標記、建議年級與撰寫狀態", async ({ page }) => {
  await page.goto(path);
  const mathDemo = row(page, "math-demo");
  await expect(mathDemo.locator(".map-no")).toHaveText("4");
  await expect(mathDemo.getByRole("link", { name: "數學式示範", exact: true })).toHaveAttribute("href", "/units/math-demo/");
  await expect(mathDemo).toContainText("數學式怎麼在頁面上正確呈現？");
  expect(await texts(mathDemo.locator(".map-prereq a"))).toEqual(["合起來", "和的示範"]);
  await expect(mathDemo).toContainText("3 年級");
  await expect(mathDemo).toContainText("已撰寫");
  await expect(mathDemo).not.toContainText("親子共學");

  const count = row(page, "fx-count");
  await expect(count.locator(".map-no")).toHaveText("1");
  await expect(count).toContainText("親子共學");
  await expect(count).toContainText("1 年級");
  await expect(count.locator(".map-prereq")).toHaveCount(0);

  const fraction = row(page, "fx-fraction");
  await expect(fraction).toContainText("7–8 年級");
  await expect(fraction).toContainText("尚未撰寫");
  await expect(fraction.getByRole("link", { name: "分數", exact: true })).toHaveAttribute("href", "/units/fx-fraction/");
});

test("搜尋比對標題與核心問題，沒有符合的階段整節隱藏", async ({ page }) => {
  await page.goto(path);
  await search(page).fill("分數");
  expect(await visibleRows(page)).toEqual(["fx-fraction"]);
  await expect(page.locator("#stage-stage-a")).toBeHidden();

  await search(page).fill("平分");
  expect(await visibleRows(page)).toEqual(["fx-fraction"]);

  await search(page).fill("合起來");
  expect(await visibleRows(page)).toEqual(["fx-add", "sum-demo"]);

  await search(page).fill("");
  expect(await visibleRows(page)).toEqual(ALL);
});

test("「只看親子共學」「只看已撰寫」可以單獨或一起用", async ({ page }) => {
  await page.goto(path);
  await familyOnly(page).check();
  expect(await visibleRows(page)).toEqual(["fx-count", "fx-compare"]);
  await writtenOnly(page).check();
  expect(await visibleRows(page)).toEqual(["fx-count"]);
  await familyOnly(page).uncheck();
  expect(await visibleRows(page)).toEqual(["fx-count", "sum-demo", "math-demo"]);
});

test("搜尋不分大小寫", async ({ page }) => {
  await page.goto(path);
  await search(page).fill("FX-COUNT");
  expect(await visibleRows(page)).toEqual([]);
  await search(page).evaluate((el: HTMLInputElement) => {
    el.value = "";
  });
  // fixture 的標題與核心問題沒有英文，用 data-search 驗證比對前會轉小寫
  await page.evaluate(() => document.querySelector("#unit-fx-add")!.setAttribute("data-search", "Sum ABC"));
  await search(page).fill("abc");
  expect(await visibleRows(page)).toEqual(["fx-add"]);
});

test("篩選結果以 role=status 播報可見單元數", async ({ page }) => {
  await page.goto(path);
  const status = page.getByRole("status");
  await expect(status).toHaveText("顯示 7 個單元");
  await familyOnly(page).check();
  await expect(status).toHaveText("顯示 2 個單元");
});

test("網址 ?written=1、?family=1 預先套用篩選", async ({ page }) => {
  await page.goto(`${path}?written=1`);
  await expect(writtenOnly(page)).toBeChecked();
  await expect(familyOnly(page)).not.toBeChecked();
  expect(await visibleRows(page)).toEqual(["fx-count", "sum-demo", "math-demo"]);

  await page.goto(`${path}?family=1&written=1`);
  expect(await visibleRows(page)).toEqual(["fx-count"]);
});

test("沒有符合條件的單元時顯示提示", async ({ page }) => {
  await page.goto(path);
  await expect(page.getByText("沒有符合條件的單元")).toBeHidden();
  await search(page).fill("不存在的單元名稱");
  expect(await visibleRows(page)).toEqual([]);
  await expect(page.getByText("沒有符合條件的單元")).toBeVisible();
});

test("搜尋與篩選列固定在頂端", async ({ page }) => {
  await page.goto(path);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const box = await search(page).boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeLessThan(120);
});

test("階段跳轉膠囊連到每個階段", async ({ page }) => {
  await page.goto(path);
  const pills = page.getByRole("navigation", { name: "階段" }).getByRole("link");
  await expect(pills).toHaveText([/階段甲/, /階段乙/]);
  expect(await pills.evaluateAll((els) => els.map((el) => el.getAttribute("href")))).toEqual(["#stage-stage-a", "#stage-stage-b"]);
  await pills.nth(1).click();
  await expect(page).toHaveURL(/#stage-stage-b$/);
  await expect(page.locator("#stage-stage-b h2")).toBeInViewport();
});

test("階段被篩選藏起來時，點階段膠囊會清除篩選再跳過去", async ({ page }) => {
  await page.goto(path);
  await writtenOnly(page).check();
  await expect(page.locator("#stage-stage-b")).toBeHidden();
  await page.getByRole("navigation", { name: "階段" }).getByRole("link", { name: /階段乙/ }).click();
  await expect(writtenOnly(page)).not.toBeChecked();
  await expect(page.locator("#stage-stage-b h2")).toBeInViewport();
});

test("先修標籤點了跳到該單元列", async ({ page }) => {
  await page.goto(path);
  await row(page, "fx-fraction").locator(".map-prereq").getByRole("link", { name: "比大小" }).click();
  await expect(page).toHaveURL(/#unit-fx-compare$/);
  await expect(row(page, "fx-compare")).toBeInViewport();
});

test("先修列被篩選藏起來時，點先修標籤會清除篩選再跳過去", async ({ page }) => {
  await page.goto(path);
  await writtenOnly(page).check();
  await row(page, "math-demo").locator(".map-prereq").getByRole("link", { name: "合起來" }).click();
  await expect(writtenOnly(page)).not.toBeChecked();
  await expect(row(page, "fx-add")).toBeVisible();
  await expect(row(page, "fx-add")).toBeInViewport();
});

test("不顯示 DAG 圖", async ({ page }) => {
  await page.goto(path);
  await expect(page.locator("main svg, main canvas")).toHaveCount(0);
});

test.describe("停用 JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("全部單元都列出，搜尋與篩選列不顯示", async ({ page }) => {
    await page.goto(path);
    expect(await visibleRows(page)).toEqual(ALL);
    await expect(search(page)).toBeHidden();
  });
});

test("320px 寬沒有水平捲軸", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "narrow", "只在 320px 驗證");
  await page.goto(path);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});

