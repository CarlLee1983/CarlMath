import { test, expect, type Locator, type Page } from "@playwright/test";

// 共用教具 AreaModel（ADR 0002、docs/figure-guide.md），以 fx-ratio fixture 裡的教具驗證；從 figures.spec.ts 拆出，避免單檔過長。
const figure = (page: Page, title: string) =>
  page.locator('svg[role="img"]').filter({ has: page.locator("title").getByText(title, { exact: true }) });
const texts = (locator: Locator) => locator.evaluateAll((els) => els.map((el) => el.textContent?.trim() ?? ""));

// 面積模型 AreaModel（fx-ratio fixture）：邊長與格內面積視同刻度數字（22），字母用斜體 SVG 文字，強調列加粗框並淡塗 --accent。
test.describe("AreaModel", () => {
  const areaPath = "/units/fx-ratio/";

  test("1 × 2 含字母：兩格、邊長與面積文字，字母斜體、數字正體", async ({ page }) => {
    await page.goto(areaPath);
    const svg = figure(page, "字母面積一列");
    expect(await svg.locator(".am-block").count()).toBe(2);
    expect(await texts(svg.locator(".am-dim"))).toEqual(["x", "2", "3"]);
    expect(await texts(svg.locator(".am-area"))).toEqual(["3x", "6"]);
    // 斜體只在字母上：x 與 3x 的 x 是斜體 tspan，數字 2、3、6 沒有
    expect(await texts(svg.locator(".am-var"))).toEqual(["x", "x"]);
    expect(await svg.locator(".am-var").first().evaluate((el) => getComputedStyle(el).fontStyle)).toBe("italic");
    expect(await svg.locator(".am-area").nth(1).evaluate((el) => getComputedStyle(el).fontStyle)).toBe("normal");
    expect(await svg.locator("desc").textContent()).toContain("不按比例");
  });

  test("2 × 2 含字母：四格、面積文字與強調列，字母段是固定示意長度", async ({ page }) => {
    await page.goto(areaPath);
    const svg = figure(page, "字母面積四格");
    expect(await svg.locator(".am-block").count()).toBe(4);
    expect(await texts(svg.locator(".am-area"))).toEqual(["x²", "2x", "3x", "6"]);
    expect(await texts(svg.locator(".am-dim"))).toEqual(["x", "2", "x", "3"]);
    const hi = await svg.locator(".am-block").evaluateAll((els) => els.map((el) => el.classList.contains("am-hi")));
    expect(hi).toEqual([false, false, true, true]);
    // 橫邊 x 與縱邊 x 都是固定示意長度（橫 120、縱 70），不隨旁邊的數字改變
    const sizes = await svg.locator(".am-block").evaluateAll((els) => els.map((el) => [Number(el.getAttribute("width")), Number(el.getAttribute("height"))]));
    expect(sizes[0]).toEqual([120, 70]);
  });

  test("字級：邊長與面積 22；線寬：格框 2、強調列 3", async ({ page }) => {
    await page.goto(areaPath);
    const svg = figure(page, "字母面積四格");
    expect(await svg.locator(".am-dim").first().evaluate((el) => getComputedStyle(el).fontSize)).toBe("22px");
    expect(await svg.locator(".am-area").first().evaluate((el) => getComputedStyle(el).fontSize)).toBe("22px");
    expect(await svg.locator(".am-block:not(.am-hi)").first().evaluate((el) => getComputedStyle(el).strokeWidth)).toBe("2px");
    expect(await svg.locator(".am-hi").first().evaluate((el) => getComputedStyle(el).strokeWidth)).toBe("3px");
  });

  test("全是字母段的邊：橫向置中、圖高只到格子底，不留空白", async ({ page }) => {
    await page.goto(areaPath);
    const svg = figure(page, "字母面積置中");
    const [vx, vy, vw, vh] = ((await svg.getAttribute("viewBox")) ?? "").split(/\s+/).map(Number);
    expect([vx, vy, vw]).toEqual([0, 0, 480]);
    const rects = await svg.locator(".am-block").evaluateAll((els) => els.map((el) => ["x", "y", "width", "height"].map((n) => Number(el.getAttribute(n)))));
    const left = rects[0]![0]!;
    const right = rects[1]![0]! + rects[1]![2]!;
    expect((left + right) / 2).toBe(256);
    // 上緣 36、一段 70、下緣 12
    expect(vh).toBe(36 + 70 + 12);
    expect(rects[0]![1]! + rects[0]![3]! + 12).toBe(vh);
  });

  test("缺角格：右下角虛線框、不塗色，格內面積 9，其餘格是實線", async ({ page }) => {
    await page.goto(areaPath);
    const svg = figure(page, "字母面積缺角");
    expect(await svg.locator(".am-block").count()).toBe(4);
    expect(await svg.locator(".am-missing").count()).toBe(1);
    const dashed = await svg.locator(".am-block").evaluateAll((els) => els.map((el) => getComputedStyle(el).strokeDasharray !== "none"));
    expect(dashed).toEqual([false, false, false, true]);
    expect(await svg.locator(".am-missing").evaluate((el) => getComputedStyle(el).fill)).toBe("none");
    expect(await svg.locator(".am-missing").evaluate((el) => getComputedStyle(el).strokeWidth)).toBe("2px");
    expect(await texts(svg.locator(".am-area"))).toEqual(["x²", "3x", "3x", "9"]);
  });

  test("320px 下頁面沒有水平捲軸，每張面積模型都在視窗內", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "narrow", "只在 320px 專案驗證");
    await page.goto(areaPath);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    const rights = await page.locator("svg.am-fig").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    expect(rights).toHaveLength(4);
    for (const right of rights) expect(right).toBeLessThanOrEqual(320);
  });

  test("主題切換：格框與文字 --fg，強調列框線與塗色 --accent，淺色與深色各自隨主題切換", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "以 emulateMedia 切換淺深色，只跑一次");
    await page.goto(areaPath);
    const svg = figure(page, "字母面積四格");
    const token = (name: string) =>
      page.evaluate((n) => {
        const probe = document.createElement("div");
        document.body.append(probe);
        probe.style.color = `var(${n})`;
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }, name);
    const computed = (locator: Locator, prop: "stroke" | "fill") => locator.first().evaluate((el, p) => getComputedStyle(el)[p], prop);
    const seen: string[] = [];
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const [fg, accent] = [await token("--fg"), await token("--accent")];
      expect(await computed(svg.locator(".am-block:not(.am-hi)"), "stroke")).toBe(fg);
      expect(await computed(svg.locator(".am-block:not(.am-hi)"), "fill")).toBe("none");
      expect(await computed(svg.locator(".am-hi"), "stroke")).toBe(accent);
      expect(await computed(svg.locator(".am-hi"), "fill")).toBe(accent);
      expect(await computed(svg.locator(".am-area"), "fill")).toBe(fg);
      expect(await computed(svg.locator(".am-dim"), "fill")).toBe(fg);
      // 缺角格的虛線框也是 --fg、不塗色
      const missing = figure(page, "字母面積缺角").locator(".am-missing");
      expect(await computed(missing, "stroke")).toBe(fg);
      expect(await computed(missing, "fill")).toBe("none");
      seen.push(accent);
    }
    expect(seen[0]).not.toBe(seen[1]);
  });
});
