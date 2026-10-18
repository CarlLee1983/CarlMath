import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

for (const theme of ["light", "dark"] as const) {
  test(`兩曲線面積 ${theme} 的實際字框、曲線避讓與可存取性`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/units/math-demo/");
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


test("第二曲線以虛線表示，陰影只在兩條曲線之間", async ({page}) => {
  await page.goto("/units/math-demo/");
  const graphs = page.locator("svg.ag-fig");
  await expect(graphs).toHaveCount(2);
  const first = graphs.nth(0);
  // y=x² is split at its vertex, then clipped at y=2 on the right.
  // Both exact Q pieces belong to the same dashed second function.
  const second = first.locator("path.ag-second");
  await expect(first.locator(".ag-second")).toHaveCount(2);
  await expect(second).toHaveCount(2);
  const pieces = await second.evaluateAll(nodes => nodes.map(node => {
    const path = node as SVGPathElement;
    const length = path.getTotalLength();
    return {
      d: path.getAttribute("d")!,
      dash: getComputedStyle(path).strokeDasharray,
      samples: Array.from({length:65}, (_, i) => {
        const p = path.getPointAtLength(length * i / 64);
        return {x:p.x,y:p.y};
      }),
    };
  }));
  const expected = [
    [60,174,120,294,180,294],
    [180,294,180+60*Math.SQRT2,294,180+120*Math.SQRT2,54],
  ];
  for (const [i, piece] of pieces.entries()) {
    expect(piece.dash).toBe("8px, 6px");
    const match = piece.d.match(/^M (\S+) (\S+) Q (\S+) (\S+) (\S+) (\S+)$/);
    expect(match).not.toBeNull();
    const coordinates = match!.slice(1).map(Number);
    for (const [j, coordinate] of coordinates.entries()) {
      expect(Number.isFinite(coordinate)).toBe(true);
      expect(coordinate).toBeCloseTo(expected[i]![j]!, 8);
    }
    // Independent browser geometry covers each complete piece, not just endpoints.
    for (const p of piece.samples) {
      const x = (p.x - 180) / 120;
      // Browser SVG geometry uses single-precision coordinates; the Q data above is checked to 1e-8.
      expect(Math.abs(p.y - (294 - 120*x*x))).toBeLessThan(0.02);
      expect(p.x).toBeGreaterThanOrEqual(expected[i]![0]! - 0.001);
      expect(p.x).toBeLessThanOrEqual(expected[i]![4]! + 0.001);
    }
  }
  const leftEnd = pieces[0]!.samples.at(-1)!;
  const rightStart = pieces[1]!.samples[0]!;
  expect(leftEnd.x).toBeCloseTo(rightStart.x, 4);
  expect(leftEnd.y).toBeCloseTo(rightStart.y, 4);
  expect(leftEnd.x).toBeCloseTo(180, 4);
  expect(leftEnd.y).toBeCloseTo(294, 4);
  await expect(first.locator(".ag-area")).toHaveCount(1);
  await expect(first.locator(".ag-negative")).toHaveCount(0);
  const inside = await first.locator(".ag-area").evaluate((el: SVGGeometryElement) => ({
    between: el.isPointInFill(new DOMPoint(240,249)),
    below: el.isPointInFill(new DOMPoint(240,282)),
    above: el.isPointInFill(new DOMPoint(240,210)),
  }));
  expect(inside).toEqual({between:true,below:false,above:false});
  await expect(graphs.nth(1).locator(".ag-area")).toHaveCount(2);
  await expect(graphs.nth(1).locator(".ag-negative")).toHaveCount(1);
});
