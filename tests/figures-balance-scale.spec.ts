import { test, expect, type Locator, type Page } from "@playwright/test";

// 共用教具 BalanceScale（ADR 0002、docs/figure-guide.md），以 fx-ratio fixture 裡的三種天平驗證：平衡、tilt、removed。
const figure = (page: Page, title: string) =>
  page.locator('svg[role="img"]').filter({ has: page.locator("title").getByText(title, { exact: true }) });
const texts = (locator: Locator) => locator.evaluateAll((els) => els.map((el) => el.textContent?.trim() ?? ""));
const beamEnds = async (svg: Locator) => {
  const [y1, y2] = await svg.locator("line.bs-frame").nth(2).evaluate((el) => [Number(el.getAttribute("y1")), Number(el.getAttribute("y2"))]);
  return { left: y1!, right: y2! };
};

test.describe("BalanceScale", () => {
  const path = "/units/fx-ratio/";

  test("平衡：橫樑等高，盒子是方形斜體 x、砝碼是圓形 1，沒有虛線框", async ({ page }) => {
    await page.goto(path);
    const svg = figure(page, "平衡的天平");
    const ends = await beamEnds(svg);
    expect(ends.left).toBe(ends.right);
    expect(await svg.locator("rect.bs-item").count()).toBe(2);
    expect(await svg.locator("circle.bs-item").count()).toBe(10);
    expect(await texts(svg.locator(".bs-var"))).toEqual(["x", "x"]);
    expect(await svg.locator(".bs-var").first().evaluate((el) => getComputedStyle(el).fontStyle)).toBe("italic");
    expect(await svg.locator(".bs-sym:not(.bs-var)").first().evaluate((el) => getComputedStyle(el).fontStyle)).toBe("normal");
    expect(await texts(svg.locator(".bs-sym:not(.bs-var)"))).toEqual(Array(10).fill("1"));
    expect(await svg.locator(".bs-removed").count()).toBe(0);
  });

  test("tilt：左邊較重，左端比右端低", async ({ page }) => {
    await page.goto(path);
    const ends = await beamEnds(figure(page, "往左傾的天平"));
    expect(ends.left).toBeGreaterThan(ends.right);
  });

  test("removed：虛線框是 stroke-dasharray、不塗色，其餘物件實線", async ({ page }) => {
    await page.goto(path);
    const svg = figure(page, "拿掉砝碼");
    expect(await svg.locator(".bs-removed").count()).toBe(6);
    expect(await svg.locator(".bs-item:not(.bs-removed)").count()).toBe(3);
    const dash = await svg.locator(".bs-removed").evaluateAll((els) => els.map((el) => getComputedStyle(el).strokeDasharray));
    for (const d of dash) expect(d).not.toBe("none");
    const solid = await svg.locator(".bs-item:not(.bs-removed)").evaluateAll((els) => els.map((el) => getComputedStyle(el).strokeDasharray));
    for (const d of solid) expect(d).toBe("none");
    const fills = await svg.locator(".bs-removed").evaluateAll((els) => els.map((el) => getComputedStyle(el).fill));
    for (const f of fills) expect(f).toBe("none");
  });

  test("字級：物件內符號 22；線寬：框架 3、吊繩 2、物件框 2", async ({ page }) => {
    await page.goto(path);
    const svg = figure(page, "拿掉砝碼");
    expect(await svg.locator(".bs-sym").first().evaluate((el) => getComputedStyle(el).fontSize)).toBe("22px");
    expect(await svg.locator("line.bs-frame").first().evaluate((el) => getComputedStyle(el).strokeWidth)).toBe("3px");
    expect(await svg.locator("line.bs-string").first().evaluate((el) => getComputedStyle(el).strokeWidth)).toBe("2px");
    expect(await svg.locator(".bs-item").first().evaluate((el) => getComputedStyle(el).strokeWidth)).toBe("2px");
  });

  test("320px 下頁面沒有水平捲軸，每張天平都在視窗內", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "narrow", "只在 320px 專案驗證");
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    const rights = await page.locator("svg.bs-fig").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    expect(rights).toHaveLength(3);
    for (const right of rights) expect(right).toBeLessThanOrEqual(320);
  });

  test("主題切換：框架與符號 --fg、吊繩 --muted、物件塗色 --accent，淺色與深色各自隨主題切換", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "以 emulateMedia 切換淺深色，只跑一次");
    await page.goto(path);
    const svg = figure(page, "拿掉砝碼");
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
      const [fg, muted, accent] = [await token("--fg"), await token("--muted"), await token("--accent")];
      expect(await computed(svg.locator("line.bs-frame"), "stroke")).toBe(fg);
      expect(await computed(svg.locator("line.bs-string"), "stroke")).toBe(muted);
      expect(await computed(svg.locator(".bs-item:not(.bs-removed)"), "fill")).toBe(accent);
      expect(await computed(svg.locator(".bs-item:not(.bs-removed)"), "stroke")).toBe(fg);
      expect(await computed(svg.locator(".bs-removed"), "stroke")).toBe(fg);
      expect(await computed(svg.locator(".bs-sym"), "fill")).toBe(fg);
      seen.push(accent);
    }
    expect(seen[0]).not.toBe(seen[1]);
  });
});
