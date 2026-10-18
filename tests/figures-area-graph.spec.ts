import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const theme of ["light", "dark"] as const) {
  test(`面積圖 ${theme} 的實際字框、曲線避讓與可存取性`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/units/sum-demo/");
    await page.evaluate(() => document.fonts.ready);
    for (const svg of await page.locator("svg.ag-fig").all()) {
      const issues = await svg.evaluate((root) => {
        const texts = [...root.querySelectorAll("text")].map((el) => ({ text: el.textContent, box: el.getBBox() }));
        const [, , width, height] = root.getAttribute("viewBox")!.split(/\s+/).map(Number);
        const issues: string[] = [];
        for (let i = 0; i < texts.length; i++) {
          const { box: a, text } = texts[i]!;
          if (a.x < 0 || a.y < 0 || a.x + a.width > width! || a.y + a.height > height!) issues.push(`overflow ${text}`);
          for (const b of [...texts.slice(i + 1).map((t) => t.box), ...[...root.querySelectorAll<SVGGraphicsElement>(".ag-point")].map((el) => el.getBBox())]) {
            if (a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y) issues.push(`overlap ${text}`);
          }
          // Browser geometry is an independent oracle; rendering and placement use analytic curves.
          for (const curve of root.querySelectorAll<SVGGeometryElement>(".ag-curve, .ag-rectangle")) {
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
        for (const {box, text} of texts) {
          for (const shape of root.querySelectorAll<SVGGeometryElement>(".ag-area, .ag-rectangle")) {
            for (let x = box.x; x <= box.x + box.width; x += 1) for (let y = box.y; y <= box.y + box.height; y += 1) {
              if (shape.isPointInFill(new DOMPoint(x, y))) { issues.push(`fill crosses ${text}`); break; }
            }
          }
        }
        for (const text of root.querySelectorAll("text")) if (parseFloat(getComputedStyle(text).fontSize) < 20) issues.push("small text");
        for (const curve of root.querySelectorAll(".ag-curve")) {
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
    expect((await new AxeBuilder({ page }).include("svg.ag-fig").analyze()).violations).toEqual([]);
  });
}


test("面積圖長條數、零高省略、負區紋理與唯一識別", async ({page}) => {
  await page.goto("/units/sum-demo/");
  const graphs = page.locator("svg.ag-fig");
  await expect(graphs).toHaveCount(5);
  for (const [i, count] of [3,4,7,8,0].entries()) {
    await expect(graphs.nth(i).locator(".ag-rectangle")).toHaveCount(count);
    await expect(graphs.nth(i).locator(".ag-endpoint")).toHaveCount(0);
  }
  await expect(graphs.nth(4).locator(".ag-area")).toHaveCount(2);
  await expect(graphs.nth(4).locator(".ag-negative")).toHaveCount(1);
  const ids = await graphs.locator("pattern").evaluateAll(nodes => nodes.map(node => node.id));
  expect(new Set(ids).size).toBe(5);
  const negativeFill = await graphs.nth(4).locator(".ag-negative").getAttribute("fill");
  expect(negativeFill).toBe(`url(#${ids[4]})`);
});
