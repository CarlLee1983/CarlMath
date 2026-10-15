import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Locator, type Page } from "@playwright/test";

// 親子篇閱讀頁（分段步進）。內容是 tests/fixtures/site/lessons/fx-count.mdx：
// 沒有先修、沒有上一個單元，下一個單元是 fx-add（未撰寫）；sum-demo 以它為先修。
const familyPath = "/units/fx-count/";
const sumPath = "/units/sum-demo/";
const SECTIONS = ["給家長的話", "情境開場", "開始前", "大人先懂", "常見迷思", "親子活動", "練習與解析", "隔天再問", "下一步"];
const PARENT_NOTE =
  "這一篇寫給你。你不需要自己很會數學：先讀「大人先懂」，再挑一個親子活動帶孩子做。你負責安排和提問，不需要講解；孩子負責動手、說出想法。陪孩子的時候，請避免說「我數學不好」，這句話容易讓孩子也開始怕數學。第一次使用，請先看「親子共學怎麼用」。";
const WIDE = { width: 1280, height: 800 };
const NARROW = { width: 320, height: 700 };

const dots = (page: Page) => page.getByRole("navigation", { name: "段落進度" }).getByRole("link");
const dot = (page: Page, n: number) => dots(page).nth(n - 1);
const visibleTitles = (page: Page) => page.getByRole("heading", { level: 2 });
const nextButton = (page: Page, title: string) => page.getByRole("button", { name: `下一段：${title}`, exact: true });
const prevButton = (page: Page) => page.getByRole("button", { name: "上一段", exact: true });
const card = (page: Page, title: string) => page.getByRole("region", { name: title, exact: true });
const hashOf = (title: string) => new RegExp(`#${encodeURIComponent(title)}$`);
/** 點進度點跳到第 n 段，並確認那一段顯示出來。 */
async function openSection(page: Page, n: number) {
  await dot(page, n).click();
  await expect(visibleTitles(page)).toHaveText([SECTIONS[n - 1]!]);
}
// 進度點的細條畫在 ::before
const background = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el, "::before").backgroundColor);
const borderColor = (locator: Locator) => locator.evaluate((el) => getComputedStyle(el).borderTopColor);
const hrefs = (links: Locator) => links.evaluateAll((els) => els.map((el) => el.getAttribute("href")));

test.describe("分段步進", () => {
  test.use({ viewport: WIDE });

  test("初始只顯示第 1 段；頁首有麵包屑、標題、核心問題與 9 格進度點", async ({ page }) => {
    await page.goto(familyPath);
    await expect(visibleTitles(page)).toHaveText(["給家長的話"]);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("數一數");
    await expect(page.getByText("怎麼知道有幾個？", { exact: true })).toBeVisible();
    const crumbs = page.getByRole("navigation", { name: "麵包屑" });
    await expect(crumbs.getByRole("listitem")).toHaveText(["課程地圖", "階段甲", "數一數"]);
    await expect(crumbs.getByRole("link", { name: "課程地圖", exact: true })).toHaveAttribute("href", "/map/");
    await expect(dots(page)).toHaveCount(9);
    await expect(page.getByText("1 / 9", { exact: true })).toBeVisible();
    await expect(page.getByRole("banner").getByRole("link", { name: "親子共學怎麼用", exact: true })).toHaveAttribute("href", "/guide/");
    await expect(page.getByRole("banner").getByRole("link", { name: "CarlMath", exact: true })).toHaveAttribute("href", "/");
  });

  test("下一段按鈕前進，按鈕文字含下一段標題；第 1 段沒有「上一段」，最後一段沒有「下一段」", async ({ page }) => {
    await page.goto(familyPath);
    await expect(prevButton(page)).toHaveCount(0);
    await expect(nextButton(page, "情境開場")).toBeVisible();

    await nextButton(page, "情境開場").click();
    await expect(visibleTitles(page)).toHaveText(["情境開場"]);
    await expect(prevButton(page)).toBeVisible();
    await expect(nextButton(page, "開始前")).toBeVisible();

    await prevButton(page).click();
    await expect(visibleTitles(page)).toHaveText(["給家長的話"]);
    await expect(prevButton(page)).toHaveCount(0);

    await dot(page, 8).click();
    await expect(nextButton(page, "下一步")).toBeVisible();
    await nextButton(page, "下一步").click();
    await expect(visibleTitles(page)).toHaveText(["下一步"]);
    await expect(page.getByRole("button", { name: /^下一段/ })).toHaveCount(0);
    await expect(prevButton(page)).toBeVisible();
  });

  test("點進度點跳段，目前段標 aria-current，其他段沒有", async ({ page }) => {
    await page.goto(familyPath);
    await expect(dot(page, 1)).toHaveAttribute("aria-current", "step");
    await openSection(page, 6);
    await expect(dot(page, 6)).toHaveAttribute("aria-current", "step");
    await expect(page.locator('nav[aria-label="段落進度"] [aria-current]')).toHaveCount(1);
    await expect(page.getByText("6 / 9", { exact: false })).toBeVisible();
    await openSection(page, 2);
    await expect(dot(page, 2)).toHaveAttribute("aria-current", "step");
  });

  test("進度點的名稱含段名，和孩子一起的段另有標示", async ({ page }) => {
    await page.goto(familyPath);
    await expect(dot(page, 1)).toHaveAccessibleName("第 1 段：給家長的話");
    await expect(dot(page, 6)).toHaveAccessibleName("第 6 段：親子活動（和孩子一起）");
    await expect(dot(page, 8)).toHaveAccessibleName("第 8 段：隔天再問（和孩子一起）");
    await expect(dot(page, 9)).toHaveAccessibleName("第 9 段：下一步");
  });

  test("只有第 6–8 段標「和孩子一起」", async ({ page }) => {
    await page.goto(familyPath);
    for (let n = 1; n <= 9; n++) {
      await openSection(page, n);
      // 三張金框卡各有一個標示，只有目前顯示的那一張看得到
      await expect(page.getByText("和孩子一起", { exact: true }).filter({ visible: true })).toHaveCount(n >= 6 && n <= 8 ? 1 : 0);
    }
  });

  test("第 6–8 段的卡片是金框，其他段是一般框線（淺色與深色）", async ({ page }) => {
    const family = { light: "rgb(138, 90, 0)", dark: "rgb(240, 192, 96)" };
    const line = { light: "rgb(227, 224, 216)", dark: "rgb(46, 49, 54)" };
    await page.goto(familyPath);
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const n of [5, 6, 7, 8, 9]) {
        await openSection(page, n);
        const expected = n >= 6 && n <= 8 ? family[scheme] : line[scheme];
        expect(await borderColor(card(page, SECTIONS[n - 1]!)), `${scheme} 第 ${n} 段`).toBe(expected);
      }
    }
  });

  test("內文 18px、行高 1.85", async ({ page }) => {
    await page.goto(familyPath);
    await openSection(page, 2);
    const style = await card(page, "情境開場").getByText("走在路上，孩子指著樹上的鳥問").evaluate((el) => ({ size: getComputedStyle(el).fontSize, line: getComputedStyle(el).lineHeight }));
    expect(style.size).toBe("18px");
    expect(style.line).toBe("33.3px");
  });

  test("進度點：目前段、看過的段、和孩子一起的段各有樣式（淺色）", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    const colors = { current: "rgb(47, 111, 222)", seen: "rgb(232, 240, 253)", unseen: "rgb(227, 224, 216)", family: "rgb(253, 245, 225)", familyCurrent: "rgb(138, 90, 0)" };
    await page.goto(familyPath);
    expect(await background(dot(page, 1))).toBe(colors.current);
    expect(await background(dot(page, 2))).toBe(colors.unseen);
    expect(await background(dot(page, 6))).toBe(colors.family);
    await nextButton(page, "情境開場").click();
    expect(await background(dot(page, 1))).toBe(colors.seen);
    expect(await background(dot(page, 2))).toBe(colors.current);
    await openSection(page, 6);
    expect(await background(dot(page, 6))).toBe(colors.familyCurrent);
    expect(await background(dot(page, 2))).toBe(colors.seen);
    expect(await background(dot(page, 3))).toBe(colors.unseen); // 跳過的段不算看過
    await openSection(page, 7);
    expect(await background(dot(page, 6))).toBe(colors.seen);
  });
});

test.describe("換段後的焦點", () => {
  test.use({ viewport: WIDE });

  test("按鈕、進度點換段後，焦點移到新段的標題", async ({ page }) => {
    await page.goto(familyPath);
    await nextButton(page, "情境開場").click();
    await expect(page.getByRole("heading", { level: 2, name: "情境開場" })).toBeFocused();
    await dot(page, 6).click();
    await expect(page.getByRole("heading", { level: 2, name: "親子活動" })).toBeFocused();
    await prevButton(page).click();
    await expect(page.getByRole("heading", { level: 2, name: "常見迷思" })).toBeFocused();
  });
});

test.describe("腳本載入失敗", () => {
  test.use({ viewport: WIDE });

  test("分段腳本載入失敗時 9 段仍全部可見，內容不被鎖住", async ({ page }) => {
    // 版面的 script 入口（Astro 把 family-reading 腳本打包在裡面）載入失敗
    await page.route(/FamilyReadingLayout[^/]*\.js/, (route) => route.abort());
    await page.goto(familyPath);
    await expect(visibleTitles(page)).toHaveText(SECTIONS);
    await expect(page.getByRole("button", { name: /段/ })).toHaveCount(0);
  });
});

test.describe("網址 hash", () => {
  test.use({ viewport: WIDE });

  test("帶 hash 開頁會停在該段，不會顯示第 1 段", async ({ page }) => {
    await page.goto(`${familyPath}#${encodeURIComponent("隔天再問")}`);
    await expect(visibleTitles(page)).toHaveText(["隔天再問"]);
    await expect(dot(page, 8)).toHaveAttribute("aria-current", "step");
    await expect(nextButton(page, "下一步")).toBeVisible();
  });

  test("換段會更新 hash，重新整理後停在該段", async ({ page }) => {
    await page.goto(familyPath);
    await nextButton(page, "情境開場").click();
    await expect(page).toHaveURL(hashOf("情境開場"));
    await openSection(page, 7);
    await expect(page).toHaveURL(hashOf("練習與解析"));
    await page.reload();
    await expect(visibleTitles(page)).toHaveText(["練習與解析"]);
    await prevButton(page).click();
    await expect(page).toHaveURL(hashOf("親子活動"));
  });

  test("手動改 hash 也會換段", async ({ page }) => {
    await page.goto(familyPath);
    await page.evaluate((hash) => (location.hash = hash), encodeURIComponent("常見迷思"));
    await expect(visibleTitles(page)).toHaveText(["常見迷思"]);
  });

  test("不認得的 hash 停在第 1 段，換段後 hash 改成該段", async ({ page }) => {
    await page.goto(`${familyPath}#${encodeURIComponent("不存在的段落")}`);
    await expect(visibleTitles(page)).toHaveText(["給家長的話"]);
    await nextButton(page, "情境開場").click();
    await expect(page).toHaveURL(hashOf("情境開場"));
  });
});

test.describe("段落內容", () => {
  test.use({ viewport: WIDE });

  test("最後一段有上一個／下一個單元連結與「下一步」清單", async ({ page }) => {
    await page.goto(`${familyPath}#${encodeURIComponent("下一步")}`);
    const last = card(page, "下一步");
    await expect(last.getByText("下一個單元會把兩堆東西合起來數。", { exact: true })).toBeVisible();
    const list = last.getByRole("heading", { level: 3, name: "下一個單元" }).locator("xpath=following-sibling::*[1]");
    await expect(list.getByRole("listitem")).toHaveText([/^\s*合起來尚未撰寫\s*$/]);
    expect(await hrefs(list.getByRole("link"))).toEqual(["/units/fx-add/"]);
    await expect(last.getByRole("heading", { level: 3, name: "複習建議" })).toBeVisible();
    await expect(last.getByText("隔一天、一週、一個月，各回來做一次本篇的提取題，先不看解析；卡住的題目，回到對應段落重讀。", { exact: true })).toBeVisible();
    const pager = last.getByRole("navigation", { name: "上一個與下一個單元" });
    await expect(pager.getByRole("link")).toHaveText(["下一個單元 →合起來"]); // 第一個單元沒有上一個
    expect(await hrefs(pager.getByRole("link"))).toEqual(["/units/fx-add/"]);
  });

  test("只有最後一段有單元導覽與「下一步」清單", async ({ page }) => {
    await page.goto(familyPath);
    // 其他段的卡片被收起來，所以用 CSS 選擇器數（getByRole 不計入看不見的元素）
    await expect(page.locator('nav[aria-label="上一個與下一個單元"]')).toHaveCount(1);
    await expect(page.locator(".next-step")).toHaveCount(1);
    await expect(page.getByRole("navigation", { name: "上一個與下一個單元" })).toBeHidden();
    await openSection(page, 8);
    await expect(page.getByRole("navigation", { name: "上一個與下一個單元" })).toBeHidden();
    await openSection(page, 9);
    await expect(page.getByRole("navigation", { name: "上一個與下一個單元" })).toBeVisible();
  });

  test("「建議先讀」位於「開始前」段，接在該段內容之後", async ({ page }) => {
    await page.goto(familyPath);
    await expect(page.locator('nav[aria-label="建議先讀"]')).toHaveCount(1);
    await openSection(page, 3);
    const suggested = card(page, "開始前").getByRole("navigation", { name: "建議先讀" });
    await expect(suggested).toBeVisible();
    await expect(suggested).toContainText("不需要先讀其他單元。");
    const [body, nav] = [await card(page, "開始前").getByText("孩子已經能一個一個指著數到 10").boundingBox(), await suggested.boundingBox()];
    expect(nav!.y).toBeGreaterThan(body!.y);
    await openSection(page, 2);
    await expect(page.getByRole("navigation", { name: "建議先讀" })).toBeHidden();
  });

  test("<ParentNote> 顯示固定文字並連到「親子共學怎麼用」", async ({ page }) => {
    await page.goto(familyPath);
    const note = page.getByRole("note", { name: "給家長的話" });
    await expect(note).toContainText(PARENT_NOTE);
    const link = note.getByRole("link", { name: "親子共學怎麼用", exact: true });
    await expect(link).toHaveAttribute("href", "/guide/");
    await link.click();
    await expect(page).toHaveURL(/\/guide\/$/);
  });

  test("<Answer> 在分段步進版用「翻開」樣式，預設收合，點開才顯示", async ({ page }) => {
    await page.goto(familyPath);
    await openSection(page, 7);
    expect(await page.locator("details[open]").count()).toBe(0);
    const first = card(page, "練習與解析").locator("details").first();
    const summary = first.getByText("看解析", { exact: true });
    await expect(summary).toBeVisible();
    await expect(first.getByText("第 1 題的答案是 6 個")).toBeHidden();
    const style = (el: Locator) =>
      el.evaluate((node) => ({ border: getComputedStyle(node.closest("details")!).borderTopStyle, before: getComputedStyle(node, "::before").content }));
    expect(await style(summary)).toEqual({ border: "dashed", before: '"翻開："' });

    await summary.click();
    await expect(first.getByText("第 1 題的答案是 6 個")).toBeVisible();
    expect(await style(summary)).toEqual({ border: "solid", before: "none" });
    await expect(page.getByText("全部展開")).toHaveCount(0);
  });

  test("一般篇的 <Answer> 維持原本樣式", async ({ page }) => {
    await page.goto("/units/math-demo/");
    const before = await page.locator("details > summary").first().evaluate((node) => getComputedStyle(node, "::before").content);
    expect(before).toBe('"▸ "');
  });

  test("<Activity>：金框卡片，表頭有名稱與「約 N 分鐘」，欄位依序固定", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(familyPath);
    await openSection(page, 6);
    const activities = card(page, "親子活動").locator(".activity");
    await expect(activities).toHaveCount(2);
    const [first, second] = [activities.nth(0), activities.nth(1)];
    await expect(first.getByRole("heading", { level: 3 })).toHaveText("客廳數數");
    await expect(first).toContainText("約 5–10 分鐘");
    await expect(second.getByRole("heading", { level: 3 })).toHaveText("數字卡配對");
    await expect(second).toContainText("約 10 分鐘");
    expect(await borderColor(first)).toBe("rgb(138, 90, 0)");

    for (const activity of [first, second]) {
      await expect(activity.locator("dt")).toHaveText(["目的", "材料", "時間", "步驟", "家長引導語", "卡關時", "回饋語範例"]);
    }
    await expect(first.locator("dd").nth(2)).toHaveText("5–10 分鐘"); // 時間欄取自 minutes
    await expect(first.locator("dd").nth(1)).toContainText("家裡的 7 個小物");
    await expect(first.locator("dd").nth(3).getByRole("listitem")).toHaveText(["把小物排成一排。", "孩子用手指著，一個一個數。", "數完問：「所以一共有幾個？」"]);
    await expect(first.locator("dd").nth(4)).toContainText("你剛剛最後數到幾？");
    await expect(first.locator("dd").nth(6)).toContainText("你把數過的移開，所以沒有數重複。");
    await expect(page.getByRole("heading", { level: 3, name: "目的" })).toHaveCount(0); // 六個 H3 變成定義列表的 dt
  });

  test("<Activity> 材料欄的可列印材料連結可點", async ({ page }) => {
    await page.goto(familyPath);
    await openSection(page, 6);
    const link = card(page, "親子活動").getByRole("link", { name: "數字卡 0–20", exact: true });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", "/print/number-cards/");
  });

  test("<Activity> 寬螢幕兩欄：名稱在左、內容在右", async ({ page }) => {
    await page.goto(familyPath);
    await openSection(page, 6);
    const first = card(page, "親子活動").locator(".activity").first();
    const [dt, dd] = [await first.locator("dt").first().boundingBox(), await first.locator("dd").first().boundingBox()];
    expect(dd!.x).toBeGreaterThan(dt!.x + dt!.width - 1);
    expect(Math.abs(dd!.y - dt!.y)).toBeLessThan(8);
  });
});

test.describe("<Activity> 窄螢幕", () => {
  test.use({ viewport: NARROW });

  test("改成單欄：內容在名稱下方", async ({ page }) => {
    await page.goto(familyPath);
    await openSection(page, 6);
    const first = card(page, "親子活動").locator(".activity").first();
    const [dt, dd] = [await first.locator("dt").first().boundingBox(), await first.locator("dd").first().boundingBox()];
    expect(dd!.y).toBeGreaterThan(dt!.y + dt!.height - 1);
    expect(Math.abs(dd!.x - dt!.x)).toBeLessThan(2);
  });
});

test.describe("已讀", () => {
  test.use({ viewport: WIDE });

  test("開過親子篇後，以它為先修的一般篇出現 ✓，未讀的先修不標", async ({ page }) => {
    const chip = (name: string) => page.getByRole("paragraph").filter({ hasText: "先修：" }).getByRole("link", { name });
    await page.goto(sumPath);
    await expect(page.getByRole("main")).not.toContainText("✓");

    await page.goto(familyPath);
    expect(JSON.parse((await page.evaluate(() => localStorage.getItem("cm-read")))!)).toEqual(["sum-demo", "fx-count"]);
    await page.goto(sumPath);
    await expect(chip("數一數")).toContainText("✓");
    await expect(chip("合起來")).not.toContainText("✓");
  });

  test("localStorage 拋例外時親子篇照常分段閱讀", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new Error("storage denied");
        },
      });
    });
    await page.goto(familyPath);
    await nextButton(page, "情境開場").click();
    await expect(visibleTitles(page)).toHaveText(["情境開場"]);
  });
});

test.describe("停用 JavaScript", () => {
  test.use({ javaScriptEnabled: false, viewport: WIDE });

  test("9 段全部可見，沒有按鈕，進度點是錨點", async ({ page }) => {
    await page.goto(familyPath);
    await expect(visibleTitles(page)).toHaveText(SECTIONS);
    await expect(page.getByRole("button", { name: /段/ })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "建議先讀" })).toBeVisible();
    await expect(page.getByRole("note", { name: "給家長的話" })).toBeVisible();
    await expect(page.getByText("和孩子一起", { exact: true })).toHaveCount(3);

    await dot(page, 7).click();
    await expect(page).toHaveURL(hashOf("練習與解析"));
    await expect(page.getByRole("heading", { level: 2, name: "練習與解析" })).toBeInViewport();
    await expect(page.getByText("第 1 題的答案是 6 個")).toBeHidden(); // 解析仍然預設收合，details 不靠 JavaScript
    await card(page, "練習與解析").getByText("看解析", { exact: true }).first().click();
    await expect(page.getByText("第 1 題的答案是 6 個")).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test("320px 寬每一段都沒有水平捲軸", async ({ page }) => {
  test.skip(test.info().project.name !== "narrow", "只在 320px 寬的 project 驗證");
  await page.goto(familyPath);
  for (let n = 1; n <= 9; n++) {
    await openSection(page, n);
    for (const summary of await page.locator("details > summary:visible").all()) await summary.click();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, `第 ${n} 段`).toBeLessThanOrEqual(0);
  }
  await expect(page.getByRole("banner").getByRole("link", { name: "親子共學怎麼用", exact: true })).toBeVisible();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`axe 在親子篇每一段（含展開的解析）無 serious/critical 違規（${colorScheme}）`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto(familyPath);
    for (let n = 1; n <= 9; n++) {
      await openSection(page, n);
      for (const summary of await page.locator("details > summary:visible").all()) await summary.click();
      const { violations } = await new AxeBuilder({ page }).analyze();
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious, `第 ${n} 段 ${JSON.stringify(serious, null, 2)}`).toEqual([]);
    }
  });
}
