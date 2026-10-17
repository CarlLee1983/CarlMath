import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("函數圖區分真正端點與視窗裁切，常數圖保留水平線", async ({ page }) => {
  await page.goto("/units/fx-ratio/");
  const graphs = page.locator("svg.fg-fig");
  await expect(graphs).toHaveCount(4);
  const domain = graphs.nth(0);
  const ends = await domain.locator(".fg-endpoint").evaluateAll((els) => els.map((el) => ({ x: +el.getAttribute("cx")!, y: +el.getAttribute("cy")!, open: el.classList.contains("fg-open") })));
  expect(ends).toEqual([{ x: 120, y: 384, open: true }, { x: 360, y: 144, open: false }]);
  const line = await graphs.nth(1).locator(".fg-curve").evaluate((el) => ["x1", "y1", "x2", "y2"].map((a) => +el.getAttribute(a)!));
  expect(line).toEqual([150, 414, 330, 54]);
  await expect(graphs.nth(1).locator(".fg-endpoint")).toHaveCount(0);
  await expect(graphs.nth(3).locator(".fg-endpoint")).toHaveCount(1);
  const constant = await graphs.nth(3).locator(".fg-curve").evaluate((el) => ["y1", "y2"].map((a) => +el.getAttribute(a)!));
  expect(constant).toEqual([114, 114]);
  await expect(graphs.locator(".fg-grid")).toHaveCount(0);
  const names = await graphs.evaluateAll((els) => els.flatMap((svg) => (svg.getAttribute("aria-labelledby") ?? "").split(" ").map((id) => ({ local: !!svg.querySelector(`[id="${id}"]`), count: document.querySelectorAll(`[id="${id}"]`).length }))));
  expect(names).toHaveLength(8);
  for (const name of names) expect(name).toEqual({ local: true, count: 1 });
});

for (const theme of ["light", "dark"] as const) {
  test(`函數圖 ${theme} 字級、標記避讓與可存取資訊`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/units/fx-ratio/");
    await page.evaluate(() => document.fonts.ready);
    for (const svg of await page.locator("svg.fg-fig").all()) {
      const issues = await svg.evaluate((root) => {
        const bounds = [...root.querySelectorAll("text")].map((el) => ({ text: el.textContent, box: el.getBBox() }));
        const [, , width, height] = root.getAttribute("viewBox")!.split(/\s+/).map(Number);
        const issues: string[] = [];
        for (let i = 0; i < bounds.length; i++) {
          const a = bounds[i]!;
          if (a.box.x < 0 || a.box.y < 0 || a.box.x + a.box.width > width! || a.box.y + a.box.height > height!) issues.push(`overflow ${a.text}`);
          for (const b of [...bounds.slice(i + 1).map((b) => b.box), ...[...root.querySelectorAll("circle")].map((el) => el.getBBox())]) {
            if (a.box.x < b.x + b.width && a.box.x + a.box.width > b.x && a.box.y < b.y + b.height && a.box.y + a.box.height > b.y) issues.push(`overlap ${a.text}`);
          }
          for (const line of root.querySelectorAll(".fg-curve")) {
            const [x1, y1, x2, y2] = ["x1", "y1", "x2", "y2"].map((k) => +line.getAttribute(k)!);
            for (let j = 0; j <= 100; j++) {
              const x = x1! + (x2! - x1!) * j / 100;
              const y = y1! + (y2! - y1!) * j / 100;
              if (x > a.box.x && x < a.box.x + a.box.width && y > a.box.y && y < a.box.y + a.box.height) issues.push(`curve crosses ${a.text}`);
            }
          }
        }
        return issues;
      });
      expect(issues).toEqual([]);
      const fontSizes = await svg.locator("text").evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).fontSize)));
      expect(fontSizes.every((size) => size >= 20)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    expect((await new AxeBuilder({ page }).include("svg.fg-fig").analyze()).violations).toEqual([]);
  });
}
