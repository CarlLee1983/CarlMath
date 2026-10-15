import { test, expect } from "@playwright/test";

const unitPath = "/units/math-demo/";
const WIDE = { width: 1280, height: 800 };
const NARROW = { width: 390, height: 800 };

test.describe("<Answer>", () => {
  test("預設收合，點開才顯示解析，沒有「全部展開」", async ({ page }) => {
    await page.goto(unitPath);
    expect(await page.locator("details[open]").count()).toBe(0);
    const first = page.locator("details").first();
    await expect(first.getByText("看解析", { exact: true })).toBeVisible();
    await expect(first.getByText("第 1 題是 7 個")).toBeHidden();
    await first.getByText("看解析", { exact: true }).click();
    await expect(first.getByText("第 1 題是 7 個")).toBeVisible();
    await expect(page.getByText("全部展開")).toHaveCount(0);
  });
});

test.describe("<Misconception>", () => {
  const wrong = (page: import("@playwright/test").Page) => page.getByRole("group", { name: "錯誤範例" });
  const right = (page: import("@playwright/test").Page) => page.getByRole("group", { name: "正確範例" });

  test.describe("寬螢幕", () => {
    test.use({ viewport: WIDE });
    test("錯誤與正確並排，左側色條分別是橘色與綠色（淺色與深色）", async ({ page }) => {
      await page.emulateMedia({ colorScheme: "light" });
      await page.goto(unitPath);
      const [w, r] = [await wrong(page).boundingBox(), await right(page).boundingBox()];
      expect(Math.abs(w!.y - r!.y)).toBeLessThan(2);
      expect(r!.x).toBeGreaterThan(w!.x + w!.width - 1);
      await expect(wrong(page)).toContainText("看到很長的式子，就把整頁調寬");
      await expect(right(page)).toContainText("頁面寬度維持不變");
      const bar = (locator: import("@playwright/test").Locator) => locator.evaluate((el) => getComputedStyle(el).borderLeftColor);
      expect(await bar(wrong(page))).toBe("rgb(194, 65, 12)");
      expect(await bar(right(page))).toBe("rgb(21, 128, 61)");
      await page.emulateMedia({ colorScheme: "dark" });
      expect(await bar(wrong(page))).toBe("rgb(251, 146, 60)");
      expect(await bar(right(page))).toBe("rgb(74, 222, 128)");
    });
  });

  test.describe("窄螢幕", () => {
    test.use({ viewport: NARROW });
    test("改成上下排", async ({ page }) => {
      await page.goto(unitPath);
      const [w, r] = [await wrong(page).boundingBox(), await right(page).boundingBox()];
      expect(r!.y).toBeGreaterThan(w!.y + w!.height - 1);
      expect(Math.abs(r!.x - w!.x)).toBeLessThan(2);
    });
  });
});

test.describe("<Figure>", () => {
  test.use({ viewport: WIDE });
  test("圖在上、說明在下，置中", async ({ page }) => {
    await page.goto(unitPath);
    const figure = page.getByRole("figure");
    const svg = figure.locator("svg");
    await expect(svg).toBeVisible();
    await expect(figure.locator("figcaption")).toHaveText("從 a 到 b 的線段，長度是 b 減 a");
    const [s, c] = [await svg.boundingBox(), await figure.locator("figcaption").boundingBox()];
    expect(c!.y).toBeGreaterThan(s!.y + s!.height - 1);
    const f = await figure.boundingBox();
    expect(Math.abs(s!.x + s!.width / 2 - (f!.x + f!.width / 2))).toBeLessThan(2);
  });
});

test.describe("<SkipCheck>", () => {
  test.use({ viewport: WIDE });
  test("連到第 7 段「練習」並捲到那裡", async ({ page }) => {
    await page.goto(unitPath);
    await page.getByRole("link", { name: "已經會了？直接去練習", exact: true }).click();
    await expect(page).toHaveURL(/#%E7%B7%B4%E7%BF%92$/);
    await expect(page.getByRole("heading", { level: 2, name: "練習" })).toBeInViewport();
  });
});
