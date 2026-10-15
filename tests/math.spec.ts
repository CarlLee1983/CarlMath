import { test, expect } from "@playwright/test";

const unitPath = "/units/math-demo/";

test("數學式在 build 期渲染成 HTML 與 MathML，頁面沒有數學相關 script", async ({ page }) => {
  await page.goto(unitPath);
  await expect(page.locator(".katex").first()).toBeVisible();
  expect(await page.locator(".katex-mathml math").count()).toBeGreaterThan(0);
  expect(await page.locator(".katex-display").count()).toBe(2);

  const scripts = await page.locator('script:not([type="application/ld+json"])').evaluateAll((els) =>
    els.map((el) => `${el.getAttribute("src") ?? ""}${el.textContent ?? ""}`),
  );
  expect(scripts.filter((s) => /katex|mathjax|math/i.test(s))).toEqual([]);
});

test("320px 寬沒有水平捲軸，極寬的區塊式在自身內水平捲動", async ({ page }) => {
  test.skip(test.info().project.name !== "narrow", "只在 320px 寬的 project 驗證");
  await page.goto(unitPath);
  const overflow = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);

  const wide = page.locator(".katex-display").last();
  const box = await wide.evaluate((el) => ({
    scroll: el.scrollWidth,
    client: el.clientWidth,
    overflowX: getComputedStyle(el).overflowX,
  }));
  expect(box.scroll).toBeGreaterThan(box.client);
  expect(["auto", "scroll"]).toContain(box.overflowX);
});
