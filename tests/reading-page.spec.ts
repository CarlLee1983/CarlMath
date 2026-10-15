import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

const unitPath = "/units/math-demo/";
const sumPath = "/units/sum-demo/";
const REVIEW_ADVICE = "隔一天、一週、一個月，各回來做一次本篇的提取題，先不看解析；卡住的題目，回到對應段落重讀。";
const WIDE = { width: 1280, height: 800 };
const MID = { width: 1000, height: 800 };
const NARROW = { width: 390, height: 800 };
const SECTIONS = ["情境開場", "先修回顧", "直覺", "推理", "範例", "常見迷思", "練習", "提取題", "下一步"];

const toc = (page: Page) => page.getByRole("navigation", { name: "本篇目錄" });
const tocLink = (page: Page, name: string) => toc(page).getByRole("link", { name, exact: true });
const scrollToSection = (page: Page, id: string) => page.evaluate((id) => document.getElementById(id)!.scrollIntoView(), id);

test.describe("寬螢幕版面", () => {
  test.use({ viewport: WIDE });

  test("頂端固定列有課程地圖連結、階段與標題，捲動後仍在", async ({ page }) => {
    await page.goto(unitPath);
    const top = page.getByRole("banner");
    await expect(top.getByRole("link", { name: "課程地圖", exact: true })).toHaveAttribute("href", "/map/");
    await expect(top).toContainText("階段甲");
    await expect(top).toContainText("數學式示範");
    await expect(top.getByRole("link", { name: "親子共學怎麼用", exact: true })).toHaveAttribute("href", "/guide/");
    await expect(top.getByRole("link", { name: "CarlMath", exact: true })).toHaveAttribute("href", "/");
    await scrollToSection(page, "提取題");
    await expect(top).toBeInViewport();
  });

  test("左側固定目錄依序列出 9 段，捲動後仍在畫面上", async ({ page }) => {
    await page.goto(unitPath);
    await expect(toc(page).getByRole("link")).toHaveText(SECTIONS);
    await expect(page.getByRole("button", { name: "目錄" })).toBeHidden();
    await scrollToSection(page, "提取題");
    await expect(toc(page)).toBeInViewport();
    const [t, m] = [await toc(page).boundingBox(), await page.getByRole("main").boundingBox()];
    expect(t!.x + t!.width).toBeLessThanOrEqual(m!.x);
  });

  test("捲到第 4 段時，目錄標出第 4 段，且只有這一段", async ({ page }) => {
    await page.goto(unitPath);
    await expect(tocLink(page, "情境開場")).toHaveAttribute("aria-current", "location");
    await scrollToSection(page, "推理");
    await expect(tocLink(page, "推理")).toHaveAttribute("aria-current", "location");
    await expect(toc(page).locator('[aria-current="location"]')).toHaveCount(1);
    await scrollToSection(page, "常見迷思");
    await expect(tocLink(page, "常見迷思")).toHaveAttribute("aria-current", "location");
    await scrollToSection(page, "直覺");
    await expect(tocLink(page, "直覺")).toHaveAttribute("aria-current", "location");
  });

  test("目錄下列出同階段單元並標出目前單元", async ({ page }) => {
    await page.goto(unitPath);
    const stage = page.getByRole("navigation", { name: "同階段單元" });
    await expect(stage.getByRole("link")).toHaveText(["數一數", "合起來", "和的示範", "● 數學式示範"]);
    await expect(stage.locator('[aria-current="page"]')).toHaveText("● 數學式示範");
    expect(await stage.getByRole("link").evaluateAll((els) => els.map((el) => el.getAttribute("href")))).toEqual([
      "/units/fx-count/",
      "/units/fx-add/",
      "/units/sum-demo/",
      "/units/math-demo/",
    ]);
  });

  test("字級 17px、行高 1.85，正文寬在 38–44rem 之間", async ({ page }) => {
    await page.goto(unitPath);
    const p = page.getByRole("main").locator("p").first();
    const style = await p.evaluate((el) => ({ size: getComputedStyle(el).fontSize, line: getComputedStyle(el).lineHeight }));
    expect(style.size).toBe("17px");
    expect(style.line).toBe("31.45px");
    const width = (await p.boundingBox())!.width;
    expect(width).toBeGreaterThanOrEqual(38 * 16);
    expect(width).toBeLessThanOrEqual(44 * 16);
  });

  test("教具邊註在正文右側", async ({ page }) => {
    await page.goto(unitPath);
    const note = page.getByRole("note");
    await expect(note).toContainText("情境、圖、符號對照");
    const [n, p, f] = [await note.boundingBox(), await page.getByRole("main").locator("p").first().boundingBox(), await page.getByRole("figure").boundingBox()];
    expect(n!.x).toBeGreaterThanOrEqual(p!.x + p!.width);
    expect(Math.abs(n!.y - f!.y)).toBeLessThan(30);
  });
});

test.describe("捲到頁底", () => {
  // 頁底時最後一段標題會落在「目前段落」判定線（視窗上方 20%）之下，只靠標題位置標不到它
  test.use({ viewport: WIDE });

  for (const path of [unitPath, sumPath]) {
    test(`捲到頁底時目錄標出最後一段「下一步」（${path}）`, async ({ page }) => {
      await page.goto(path);
      await expect(tocLink(page, "情境開場")).toHaveAttribute("aria-current", "location");
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await expect(tocLink(page, "下一步")).toHaveAttribute("aria-current", "location");
      await expect(toc(page).locator('[aria-current="location"]')).toHaveCount(1);
    });

    test(`點目錄的「下一步」後標出它（${path}）`, async ({ page }) => {
      await page.goto(path);
      await tocLink(page, "下一步").click();
      await expect(tocLink(page, "下一步")).toHaveAttribute("aria-current", "location");
    });
  }
});

test.describe("中等寬度版面", () => {
  test.use({ viewport: MID });

  test("邊註併回正文，目錄仍在左側", async ({ page }) => {
    await page.goto(unitPath);
    const [n, p] = [await page.getByRole("note").boundingBox(), await page.getByRole("main").locator("p").first().boundingBox()];
    expect(n!.x).toBeGreaterThanOrEqual(p!.x - 1);
    expect(n!.x + n!.width).toBeLessThanOrEqual(p!.x + p!.width + 1);
    await expect(toc(page)).toBeVisible();
  });
});

test.describe("手機寬度版面", () => {
  test.use({ viewport: NARROW });

  test("目錄收進「目錄」按鈕；點開展開，點段落連結跳轉並收合", async ({ page }) => {
    await page.goto(unitPath);
    const button = page.getByRole("button", { name: "目錄" });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    await expect(toc(page)).toBeHidden();

    await button.click();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    await expect(toc(page)).toBeVisible();
    await expect(toc(page).getByRole("link")).toHaveText(SECTIONS);

    await tocLink(page, "直覺").click();
    await expect(page).toHaveURL(/#%E7%9B%B4%E8%A6%BA$/);
    await expect(toc(page)).toBeHidden();
    await expect(button).toHaveAttribute("aria-expanded", "false");
    const heading = page.getByRole("heading", { level: 2, name: "直覺" });
    await expect(heading).toBeInViewport();
    expect((await heading.boundingBox())!.y).toBeGreaterThanOrEqual(44);
  });

  test("邊註併回正文", async ({ page }) => {
    await page.goto(unitPath);
    const [n, p] = [await page.getByRole("note").boundingBox(), await page.getByRole("main").locator("p").first().boundingBox()];
    expect(n!.x).toBeGreaterThanOrEqual(p!.x - 1);
    expect(n!.x + n!.width).toBeLessThanOrEqual(p!.x + p!.width + 1);
  });
});

const hrefs = (links: import("@playwright/test").Locator) => links.evaluateAll((els) => els.map((el) => el.getAttribute("href")));

test.describe("meta 列與頁尾", () => {
  test.use({ viewport: WIDE });

  test("顯示建議年級、直接先修，以及依建議閱讀順序的建議先讀", async ({ page }) => {
    await page.goto(unitPath);
    await expect(page.getByText("建議年級：3 年級", { exact: true })).toBeVisible();
    const prerequisites = page.getByRole("paragraph").filter({ hasText: "先修：" });
    await expect(prerequisites.getByRole("link")).toHaveText(["合起來", "和的示範"]);
    expect(await hrefs(prerequisites.getByRole("link"))).toEqual(["/units/fx-add/", "/units/sum-demo/"]);
    await expect(prerequisites).toContainText("合起來尚未撰寫");

    const suggested = page.getByRole("navigation", { name: "建議先讀" });
    await expect(suggested.getByRole("listitem")).toHaveText(
      ["數一數", "合起來尚未撰寫", "和的示範"].map((text) => new RegExp(`^\\s*${text}\\s*$`)),
    );
    expect(await hrefs(suggested.getByRole("link"))).toEqual(["/units/fx-count/", "/units/fx-add/", "/units/sum-demo/"]);
  });

  test("頁尾有上一個與下一個單元", async ({ page }) => {
    await page.goto(unitPath);
    const pager = page.getByRole("navigation", { name: "上一個與下一個單元" });
    await expect(pager.getByRole("link")).toHaveText(["← 上一個單元和的示範", "下一個單元 →比大小"]);
    expect(await hrefs(pager.getByRole("link"))).toEqual(["/units/sum-demo/", "/units/fx-compare/"]);
  });
});

test.describe("已讀", () => {
  test.use({ viewport: WIDE });
  const prerequisiteLink = (page: Page, name: string) =>
    page.getByRole("paragraph").filter({ hasText: "先修：" }).getByRole("link", { name });

  test("沒開過先修的閱讀頁時沒有 ✓；開過再回來，該先修標籤出現 ✓，未讀的不標", async ({ page }) => {
    await page.goto(unitPath);
    await expect(page.getByRole("main")).not.toContainText("✓");

    await page.goto(sumPath);
    await page.goto(unitPath);
    await expect(prerequisiteLink(page, "和的示範")).toContainText("✓");
    await expect(prerequisiteLink(page, "合起來")).not.toContainText("✓");
  });

  test("只開過未撰寫的單元頁不算已讀", async ({ page }) => {
    await page.goto("/units/fx-add/");
    await page.goto(unitPath);
    await expect(page.getByRole("main")).not.toContainText("✓");
  });

  test("localStorage 拋例外時頁面照常顯示，只是不標 ✓", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("storage denied");
        },
      });
    });
    await page.goto(sumPath);
    await page.goto(unitPath);
    await expect(page.getByRole("heading", { level: 1, name: "數學式示範" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveCount(9);
    await expect(page.getByRole("main")).not.toContainText("✓");
    await scrollToSection(page, "推理");
    await expect(tocLink(page, "推理")).toHaveAttribute("aria-current", "location");
  });

  test("儲存內容損毀時一律顯示未讀", async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("cm-read", "{壞掉"));
    await page.goto(unitPath);
    await expect(page.getByRole("main")).not.toContainText("✓");
  });
});

test.describe("下一步", () => {
  test.use({ viewport: WIDE });

  test("下一個單元不依賴本單元時，列出反向依賴，其後接固定的複習建議", async ({ page }) => {
    await page.goto(unitPath);
    const hook = page.getByText("接著學比大小。", { exact: true });
    const heading = page.getByRole("heading", { level: 3, name: "這個單元會在這些地方用上" });
    await expect(page.getByRole("heading", { level: 2 }).last()).toHaveText("下一步");
    const list = heading.locator("xpath=following-sibling::*[1]");
    await expect(list.getByRole("listitem")).toHaveText([/^\s*分數尚未撰寫\s*$/, /^\s*比例尚未撰寫\s*$/]);
    expect(await hrefs(list.getByRole("link"))).toEqual(["/units/fx-fraction/", "/units/fx-ratio/"]);
    await expect(page.getByRole("heading", { level: 3, name: "下一個單元" })).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 3, name: "複習建議" })).toBeVisible();
    await expect(page.getByText(REVIEW_ADVICE, { exact: true })).toBeVisible();
    const [h, l, r] = [await hook.boundingBox(), await heading.boundingBox(), await page.getByText(REVIEW_ADVICE).boundingBox()];
    expect(l!.y).toBeGreaterThan(h!.y);
    expect(r!.y).toBeGreaterThan(l!.y);
  });

  test("下一個單元依賴本單元時，只預告下一個單元", async ({ page }) => {
    await page.goto(sumPath);
    const heading = page.getByRole("heading", { level: 3, name: "下一個單元" });
    const list = heading.locator("xpath=following-sibling::*[1]");
    await expect(list.getByRole("listitem")).toHaveText([/^\s*數學式示範\s*$/]);
    expect(await hrefs(list.getByRole("link"))).toEqual(["/units/math-demo/"]);
    await expect(page.getByRole("heading", { level: 3, name: "這個單元會在這些地方用上" })).toHaveCount(0);
    await expect(page.getByText(REVIEW_ADVICE, { exact: true })).toBeVisible();
  });
});

test.describe("停用 JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("內容完整，目錄錨點可用，沒有水平捲軸", async ({ page }) => {
    await page.goto(unitPath);
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(SECTIONS);
    await expect(page.getByRole("button", { name: "目錄" })).toBeHidden();
    await expect(toc(page)).toBeVisible();
    await expect(toc(page).getByRole("link")).toHaveText(SECTIONS);
    await expect(page.getByText("第 1 題是 7 個")).toBeHidden(); // 解析預設收合；details 不靠 JavaScript
    await page.locator("details").first().getByText("看解析", { exact: true }).click();
    await expect(page.getByText("第 1 題是 7 個")).toBeVisible();

    await tocLink(page, "範例").click();
    await expect(page).toHaveURL(/#%E7%AF%84%E4%BE%8B$/);
    await expect(page.getByRole("heading", { level: 2, name: "範例" })).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test("320px 寬沒有水平捲軸", async ({ page }) => {
  test.skip(test.info().project.name !== "narrow", "只在 320px 寬的 project 驗證");
  for (const path of [unitPath, sumPath]) {
    await page.goto(path);
    await expect(page.getByRole("banner").getByRole("link", { name: "親子共學怎麼用", exact: true })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("button", { name: "目錄" })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  await page.getByRole("button", { name: "目錄" }).click();
  const open = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(open).toBeLessThanOrEqual(0);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`axe 在另一篇一般篇與展開的目錄、解析下無 serious/critical 違規（${colorScheme}）`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    for (const path of [sumPath, unitPath]) {
      await page.goto(path);
      if (await page.getByRole("button", { name: "目錄" }).isVisible()) await page.getByRole("button", { name: "目錄" }).click();
      for (const summary of await page.locator("details > summary").all()) await summary.click();
      const { violations } = await new AxeBuilder({ page }).analyze();
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious, `${path} ${JSON.stringify(serious, null, 2)}`).toEqual([]);
    }
  });
}
