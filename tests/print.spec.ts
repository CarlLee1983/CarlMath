import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Locator, type Page } from "@playwright/test";

// 可列印材料頁（/print/<材料 id>/）：A4 直式、卡片以 mm 定尺寸、列印時只留材料本身。
const MATERIALS = [
  { id: "number-cards", title: "數字卡 0–20" },
  { id: "dot-cards", title: "點卡 1–10" },
  { id: "two-row-dots", title: "兩排圓點卡" },
  { id: "number-board", title: "線性數字盤面 0–10" },
  { id: "blank-number-line", title: "空白 0–20 數線" },
  { id: "ten-frames", title: "十格框" },
  { id: "place-value-mat", title: "位值板與數字卡" },
  { id: "tens-number-lines", title: "整十數線 0–100" },
] as const;

const MM = 96 / 25.4; // CSS 1mm 的 px 數
const texts = (locator: Locator) => locator.evaluateAll((els) => els.map((el) => el.textContent?.trim() ?? ""));
const counterCount = (card: Locator) => card.locator(".ct-counter").count();

for (const { id, title } of MATERIALS) {
  test.describe(`/print/${id}/`, () => {
    const path = `/print/${id}/`;

    test("螢幕上有站頭、標題、使用說明與「列印」按鈕", async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveTitle(`${title}｜CarlMath`);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
      await expect(page.locator(".site-header")).toBeVisible();
      await expect(page.locator(".print-intro")).toBeVisible();
      await expect(page.getByRole("button", { name: "列印" })).toBeVisible();
      expect(await page.locator(".print-card").count()).toBeGreaterThan(0);
    });

    test("列印時隱藏站頭、標題、說明與按鈕，只留材料；系統深色時仍印淺色", async ({ page }) => {
      await page.emulateMedia({ media: "print", colorScheme: "dark" });
      await page.goto(path);
      await expect(page.locator(".site-header")).toBeHidden();
      await expect(page.getByRole("heading", { level: 1 })).toBeHidden();
      await expect(page.locator(".print-intro")).toBeHidden();
      await expect(page.getByRole("button", { name: "列印" })).toBeHidden();
      await expect(page.locator(".print-card").first()).toBeVisible();
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(255, 255, 255)");
      expect(await page.evaluate(() => getComputedStyle(document.body).color)).toBe("rgb(0, 0, 0)");
    });

    test('列印時即使 data-theme="dark" 也印淺色', async ({ page }) => {
      await page.emulateMedia({ media: "print" });
      await page.goto(path);
      await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
      expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(255, 255, 255)");
      expect(await page.evaluate(() => getComputedStyle(document.body).color)).toBe("rgb(0, 0, 0)");
    });

    test("列印時卡片以虛線框出、不跨頁，並放得進 A4 可印範圍", async ({ page }) => {
      await page.emulateMedia({ media: "print" });
      await page.goto(path);
      const cards = await page.locator(".print-card").evaluateAll((els) =>
        els.map((el) => {
          const style = getComputedStyle(el);
          return { border: style.borderTopStyle, breakInside: style.breakInside, width: el.getBoundingClientRect().width };
        }),
      );
      for (const card of cards) {
        expect(card.border).toBe("dashed");
        expect(card.breakInside).toBe("avoid");
        expect(card.width).toBeLessThanOrEqual(190 * MM + 1);
      }
    });

    test("320px 寬沒有水平捲軸", async ({ page }, testInfo) => {
      test.skip(testInfo.project.name !== "narrow", "只在 320px 驗證");
      await page.goto(path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    });

    test("axe 無 serious/critical 違規", async ({ page }) => {
      await page.goto(path);
      const { violations } = await new AxeBuilder({ page }).analyze();
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
    });
  });
}

const openPrintCards = async (page: Page, id: string) => {
  await page.emulateMedia({ media: "print" });
  await page.goto(`/print/${id}/`);
  return page.locator(".print-card");
};
const widthMm = (locator: Locator) => locator.first().evaluate((el) => el.getBoundingClientRect().width).then((px) => px / MM);

test("數字卡 0–20：21 張卡依序是 0 到 20，每張以 mm 定出實際寬度", async ({ page }) => {
  const cards = await openPrintCards(page, "number-cards");
  expect(await texts(cards)).toEqual(Array.from({ length: 21 }, (_, i) => String(i)));
  // 6 和 9 剪下來分不出上下，加底線
  const underlined = await cards.evaluateAll((els) =>
    els.filter((el) => getComputedStyle(el.querySelector("span") ?? el).textDecorationLine.includes("underline")).map((el) => el.textContent?.trim()),
  );
  expect(underlined).toEqual(["6", "9"]);
  const width = await widthMm(cards);
  expect(width).toBeGreaterThanOrEqual(40);
  expect(width).toBeLessThanOrEqual(90);
});

test("點卡 1–10：10 張卡，依序畫 1 到 10 個圓點（Counters）", async ({ page }) => {
  const cards = await openPrintCards(page, "dot-cards");
  expect(await cards.count()).toBe(10);
  for (let i = 0; i < 10; i++) expect(await counterCount(cards.nth(i))).toBe(i + 1);
});

test("兩排圓點卡：每張兩排，上排實心、下排空心且靠左對齊，上排不少於下排", async ({ page }) => {
  const cards = await openPrintCards(page, "two-row-dots");
  expect(await cards.count()).toBeGreaterThanOrEqual(6);
  for (const card of await cards.all()) {
    const dots = await card.locator(".ct-counter").evaluateAll((els) =>
      els.map((el) => ({ x: Number(el.getAttribute("cx")), y: Number(el.getAttribute("cy")), marked: el.classList.contains("ct-marked") })),
    );
    const top = dots.filter((d) => d.marked);
    const bottom = dots.filter((d) => !d.marked);
    expect(new Set(top.map((d) => d.y)).size).toBe(1);
    expect(new Set(bottom.map((d) => d.y)).size).toBe(1);
    expect(top.length).toBeGreaterThanOrEqual(bottom.length);
    expect(bottom.length).toBeGreaterThan(0);
    // 下排從左邊對齊上排，沒配到的就是上排多出來的
    bottom.forEach((d, i) => expect(d.x).toBe(top[i]!.x));
  }
});

test("線性數字盤面 0–10：一列 11 格等寬，依序標 0 到 10", async ({ page }) => {
  await openPrintCards(page, "number-board");
  const cells = page.locator(".print-board-cell");
  expect(await texts(cells)).toEqual(Array.from({ length: 11 }, (_, i) => String(i)));
  const boxes = await cells.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ y: r.top, w: r.width })));
  expect(new Set(boxes.map((b) => Math.round(b.y))).size).toBe(1);
  for (const box of boxes) expect(box.w).toBeCloseTo(boxes[0]!.w, 1);
  expect(boxes[0]!.w / MM).toBeGreaterThanOrEqual(15);
});

test("線性數字盤面的格線在螢幕深色主題下看得見（用 --fg）", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/print/number-board/");
  const [border, fg] = await page.evaluate(() => {
    const cell = document.querySelector(".print-board-cell")!;
    return [getComputedStyle(cell).borderRightColor, getComputedStyle(document.body).color];
  });
  expect(border).toBe(fg);
});

test("空白 0–20 數線：每條只標 0 與 20，沒有中間刻度（NumberLine）", async ({ page }) => {
  const cards = await openPrintCards(page, "blank-number-line");
  expect(await cards.count()).toBeGreaterThanOrEqual(3);
  for (const card of await cards.all()) {
    expect(await texts(card.locator(".nl-num"))).toEqual(["0", "20"]);
    expect(await card.locator(".nl-tick").count()).toBe(2);
  }
  // 0 到 20 實際長 160mm（每 1 是 8mm），先估再量時好量
  const axis = await cards.first().locator(".nl-axis").evaluate((el) => el.getBoundingClientRect().width);
  expect(axis / MM).toBeCloseTo(160, 0);
});

test("親子篇活動材料欄的數字卡連結通到可列印材料頁", async ({ page }) => {
  await page.goto("/units/fx-count/");
  // 連結在「親子活動」段，分段步進時不在目前這一段，所以不用 getByRole（它略過隱藏元素）
  const href = await page.locator("a", { hasText: "數字卡 0–20" }).first().getAttribute("href");
  expect(href).toBe("/print/number-cards/");
  const response = await page.goto(href!);
  expect(response?.status()).toBe(200);
});
