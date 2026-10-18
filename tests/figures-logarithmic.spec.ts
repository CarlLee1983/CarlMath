import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Select the three exact fixture curves without an unapproved lesson wrapper.
const fixtureGraphs = 'svg.fg-fig:has(path[d^="M 60 279 L"]), svg.fg-fig:has(path[d^="M 195 414 L"]), svg.fg-fig:has(path[d^="M 187.5 54 L"])';

for (const theme of ["light", "dark"] as const) {
  test(`對數近似 ${theme} 的實際字框、曲線避讓與可存取性`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/units/math-demo/");
    await page.evaluate(() => document.fonts.ready);
    for (const svg of await page.locator(fixtureGraphs).all()) {
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
    expect((await new AxeBuilder({ page }).include(fixtureGraphs).analyze()).violations).toEqual([]);
  });
}


test("對數保持正真數與y軸間隔，三張反向對應圖都有獨立路徑", async ({ page }) => {
  await page.goto("/units/math-demo/");
  const graphs = page.locator(fixtureGraphs);
  await expect(graphs).toHaveCount(3);
  for (let i = 0; i < 3; i++) {
    const graph = graphs.nth(i);
    await expect(graph.locator(".fg-curve")).toHaveCount(1);
    await expect(graph.locator(".fg-endpoint")).toHaveCount(0);
    await expect(graph.locator(".fg-point")).toHaveCount(3);
    const d = await graph.locator(".fg-curve").getAttribute("d");
    expect(d).toMatch(/^M .* L /);
    expect(d).not.toMatch(/NaN|Infinity| Q | C /);
    if (i > 0) {
      const nodes = [...d!.matchAll(/[ML] ([^ ]+) ([^ ]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
      expect(nodes[0]!.x).toBe(i === 1 ? 195 : 187.5);
      for (const point of nodes) expect(point.x).toBeGreaterThanOrEqual(184);
    }
  }
});
