import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Use the existing accessible title, without adding lesson HTML wrappers.
const titles = /^(角度對應高度|角度對應水平位置|更高也更密的波)$/;

for (const theme of ["light", "dark"] as const) {
  test(`三角近似 ${theme} 的實際字框、曲線避讓與可存取性`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/units/math-demo/");
    await page.evaluate(() => document.fonts.ready);
    for (const svg of await page.locator("svg.fg-fig").filter({ has: page.locator("title").filter({ hasText: titles }) }).all()) {
      const issues = await svg.evaluate((root) => {
        const texts = [...root.querySelectorAll("text")].map((el) => ({ text: el.textContent, box: el.getBBox() }));
        const [, , width, height] = root.getAttribute("viewBox")!.split(/\s+/).map(Number);
        const issues: string[] = [];
        for (let i = 0; i < texts.length; i++) {
          const { box: a, text } = texts[i]!;
          if (a.x < 0 || a.y < 0 || a.x + a.width > width! || a.y + a.height > height!) issues.push(`overflow ${text}`);
          for (const b of [...texts.slice(i + 1).map((t) => t.box), ...[...root.querySelectorAll<SVGGraphicsElement>(".fg-point, .fg-endpoint, .cp-point")].map((el) => el.getBBox())]) {
            if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) issues.push(`overlap ${text}`);
          }
          // Browser geometry is an independent oracle; rendering and placement use analytic curves.
          for (const curve of root.querySelectorAll<SVGGeometryElement>(".fg-curve, .cp-circle, .cp-segment")) {
            const length = curve.getTotalLength(), count = Math.max(1, Math.ceil(length * 2));
            for (let j = 0; j <= count; j++) {
              const p = curve.getPointAtLength(length * j / count);
              if (p.x > a.x && p.x < a.x + a.width && p.y > a.y && p.y < a.y + a.height) {
                issues.push(`curve crosses ${text}`);
                break;
              }
            }
          }
        }
        for (const text of root.querySelectorAll("text")) if (parseFloat(getComputedStyle(text).fontSize) < 20) issues.push("small text");
        for (const curve of root.querySelectorAll(".fg-curve, .cp-circle")) {
          const style = getComputedStyle(curve);
          if (style.fill !== "none" || parseFloat(style.strokeWidth) !== 3 || style.stroke === "none") issues.push("curve style");
        }
        for (const id of (root.getAttribute("aria-labelledby") ?? "").split(" ")) {
          if (!root.querySelector(`[id="${id}"]`) || document.querySelectorAll(`[id="${id}"]`).length !== 1) issues.push(`aria ${id}`);
        }
        return issues;
      });
      expect(issues).toEqual([]);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    const graphs = page.locator("svg.fg-fig").filter({ has: page.locator("title").filter({ hasText: titles }) });
    await expect(graphs).toHaveCount(3);
    for (const graph of await graphs.all()) {
      const aria = await graph.getAttribute("aria-labelledby");
      expect((await new AxeBuilder({ page }).include(`svg[aria-labelledby="${aria}"]`).analyze()).violations).toEqual([]);
    }
  });
}


test("三角 π 刻度、峰谷與無假端點", async ({ page }) => {
  await page.goto("/units/math-demo/");
  const graphs = page.locator("svg.fg-fig").filter({ has: page.locator("title").filter({ hasText: titles }) });
  await expect(graphs).toHaveCount(3);
  for (const graph of await graphs.all()) {
    await expect(graph.locator(".fg-curve")).toHaveCount(1);
    await expect(graph.locator(".fg-endpoint")).toHaveCount(0);
    await expect(graph.locator(".fg-point")).toHaveCount(2);
    for (const label of ["−π", "π", "2π"]) await expect(graph.locator("text").filter({ hasText: new RegExp(`^${label}$`) })).toHaveCount(1);
    const d = await graph.locator(".fg-curve").getAttribute("d");
    expect(d).toMatch(/^M .* L /);
    expect(d).not.toMatch(/NaN|Infinity| Q | C /);
  }
});
