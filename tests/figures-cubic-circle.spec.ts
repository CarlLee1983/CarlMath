import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("三次相切及穿越圖使用 C 曲線，坐標圓完整且等比例", async ({ page }) => {
  await page.goto("/units/math-demo/");
  const graph = page.locator("svg.fg-fig"), plane = page.locator("svg.cp-fig");
  await expect(graph).toHaveCount(1);
  await expect(graph.locator("path.fg-curve")).toHaveCount(3);
  await expect(graph.locator(".fg-endpoint")).toHaveCount(0);
  for (const path of await graph.locator("path.fg-curve").all()) await expect(path).toHaveAttribute("d", /^M .* C /);
  await expect(plane.locator(".cp-circle")).toHaveCount(1);
  await expect(plane.locator(".cp-circle")).toHaveAttribute("cx", "240");
  await expect(plane.locator(".cp-circle")).toHaveAttribute("cy", "234");
  await expect(plane.locator(".cp-circle")).toHaveAttribute("r", "120");
  await expect(plane.locator(".cp-point")).toHaveCount(3);
  await expect(plane.locator(".cp-segment")).toHaveCount(1);
  const bounds = await plane.locator(".cp-circle").evaluate((circle) => {
    const b = (circle as SVGGraphicsElement).getBBox();
    return { left: b.x, top: b.y, right: b.x + b.width, bottom: b.y + b.height };
  });
  expect(bounds).toEqual({ left: 120, top: 114, right: 360, bottom: 354 });
});

for (const theme of ["light", "dark"] as const) {
  test(`三次與圓 ${theme} 的實際字框、曲線避讓與可存取性`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/units/math-demo/");
    await page.evaluate(() => document.fonts.ready);
    for (const svg of await page.locator("svg.fg-fig, svg.cp-fig").all()) {
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
    expect((await new AxeBuilder({ page }).include("svg.fg-fig, svg.cp-fig").analyze()).violations).toEqual([]);
  });
}
