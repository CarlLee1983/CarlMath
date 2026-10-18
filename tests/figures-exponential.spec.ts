import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const theme of ["light", "dark"] as const) {
  test(`指數近似 ${theme} 的實際字框、曲線避讓與可存取性`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/units/sum-demo/");
    await page.evaluate(() => document.fonts.ready);
    for (const svg of await page.locator("svg.fg-fig").all()) {
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
    expect((await new AxeBuilder({ page }).include("svg.fg-fig").analyze()).violations).toEqual([]);
  });
}


test("指數增減圖使用有界M/L近似且全部節點遠離x軸", async ({ page }) => {
  await page.goto("/units/sum-demo/");
  const graphs = page.locator("svg.fg-fig");
  await expect(graphs).toHaveCount(2);
  for (const graph of await graphs.all()) {
    await expect(graph.locator("path.fg-curve")).toHaveCount(1);
    await expect(graph.locator(".fg-endpoint")).toHaveCount(0);
    await expect(graph.locator(".fg-point")).toHaveCount(3);
    const d = await graph.locator("path.fg-curve").getAttribute("d");
    expect(d).toMatch(/^M [-\d.]+ [-\d.]+ L /);
    expect(d).not.toMatch(/[QC]|NaN|Infinity/);
    const nodes = [...d!.matchAll(/[ML] ([^ ]+) ([^ ]+)/g)].map((m) => ({ x: Number(m[1]), y: Number(m[2]) }));
    expect(nodes.length).toBeGreaterThan(10);
    expect(nodes.length).toBeLessThanOrEqual(4097);
    for (const node of nodes) {
      expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true);
      expect(node.y).toBeLessThanOrEqual(350); // x-axis y=354, minimum centre-line separation=4.
    }
  }
});
