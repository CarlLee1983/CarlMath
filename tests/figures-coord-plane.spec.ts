import { test, expect } from "@playwright/test";

test("坐標圖：等比例、方向、整數格線、標記與可存取名稱", async ({ page }) => {
  await page.goto("/units/fx-ratio/");
  await page.evaluate(() => document.fonts.ready);
  const svgs = page.locator("svg.cp-fig");
  await expect(svgs).toHaveCount(4);
  const geometry = await svgs.nth(1).evaluate((svg) => {
    const points = [...svg.querySelectorAll("circle")].map((el) => [Number(el.getAttribute("cx")), Number(el.getAttribute("cy"))]);
    const labels = [...svg.querySelectorAll("text")].map((el) => el.textContent);
    const grids = [...svg.querySelectorAll(".cp-grid")].map((el) => ["x1", "y1", "x2", "y2"].map((a) => Number(el.getAttribute(a))));
    return { points, labels, grids };
  });
  expect(geometry.points).toEqual([[240, 234], [360, 234], [270, 204], [120, 294]]);
  expect(geometry.labels.filter((t) => t === "O")).toHaveLength(1);
  expect(geometry.labels).not.toContain("0");
  expect(geometry.grids).toHaveLength(12);
  const quadrants = await svgs.first().locator(".cp-quadrant").allTextContents();
  expect(quadrants).toEqual(["第一象限", "第二象限", "第三象限", "第四象限"]);
  const names = await svgs.evaluateAll((els) => els.map((svg) => {
    const ids = (svg.getAttribute("aria-labelledby") ?? "").split(" ");
    return ids.map((id) => ({ id, local: !!svg.querySelector(`[id="${id}"]`), count: document.querySelectorAll(`[id="${id}"]`).length }));
  }));
  for (const name of names.flat()) expect(name).toMatchObject({ local: true, count: 1 });
  expect(names[1]![0]!.id).not.toBe(names[2]![0]!.id);
  for (const svg of await svgs.all()) {
    const issues = await svg.evaluate((root) => {
      const texts = [...root.querySelectorAll("text")];
      const bounds = texts.map((el) => ({ text: el.textContent, box: el.getBBox() }));
      const [, , width, height] = root.getAttribute("viewBox")!.split(/\s+/).map(Number);
      const issues: string[] = [];
      for (let i = 0; i < bounds.length; i++) {
        const a = bounds[i]!;
        if (a.box.x < 0 || a.box.y < 0 || a.box.x + a.box.width > width! || a.box.y + a.box.height > height!) issues.push(`overflow ${a.text}`);
        for (const point of root.querySelectorAll("circle")) {
          const b = point.getBBox();
          if (a.box.x < b.x + b.width && a.box.x + a.box.width > b.x && a.box.y < b.y + b.height && a.box.y + a.box.height > b.y) issues.push(`point overlap ${a.text}`);
        }
        for (const b of bounds.slice(i + 1)) {
          if (a.box.x < b.box.x + b.box.width && a.box.x + a.box.width > b.box.x && a.box.y < b.box.y + b.box.height && a.box.y + a.box.height > b.box.y) issues.push(`overlap ${a.text}/${b.text}`);
        }
      }
      return issues;
    });
    expect(issues).toEqual([]);
    expect(await svg.locator("text").first().evaluate((el) => getComputedStyle(el).fontSize)).toBe("22px");
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
});


test("距離圖的線段端點、等比例與虛線輔助線符合坐標資料", async ({ page }) => {
  await page.goto("/units/fx-ratio/");
  const svg = page.locator("svg.cp-fig").last();
  await expect(svg.locator(".cp-segment")).toHaveCount(3);
  const segments = await svg.locator(".cp-segment").evaluateAll((els) => els.map((el) => ({
    endpoints: ["x1", "y1", "x2", "y2"].map((a) => Number(el.getAttribute(a))),
    dash: getComputedStyle(el).strokeDasharray,
    stroke: getComputedStyle(el).strokeWidth,
  })));
  expect(segments.map((s) => s.endpoints)).toEqual([[120,294,360,114],[120,294,360,294],[360,294,360,114]]);
  expect(segments[0]).toMatchObject({ dash: "none", stroke: "3px" });
  expect(segments[1]).toMatchObject({ dash: "8px, 6px", stroke: "2px" });
  expect(segments[2]).toMatchObject({ dash: "8px, 6px", stroke: "2px" });
  await expect(svg.locator("desc")).toContainText("在 C 交成直角");
  // Test the rendered glyph boxes against points along the visible lines, independently of the layout's conservative boxes.
  const crossedNames = await svg.evaluate((root) => {
    const crossed: string[] = [];
    for (const text of root.querySelectorAll("text")) {
      const b = text.getBBox();
      for (const line of root.querySelectorAll(".cp-segment")) {
        const [x1,y1,x2,y2] = ["x1","y1","x2","y2"].map((a) => Number(line.getAttribute(a)));
        for (let i = 0; i <= 100; i++) {
          const x = x1! + (x2! - x1!) * i / 100;
          const y = y1! + (y2! - y1!) * i / 100;
          if (x > b.x && x < b.x + b.width && y > b.y && y < b.y + b.height) crossed.push(text.textContent ?? "");
        }
      }
    }
    return crossed;
  });
  expect(crossedNames).toEqual([]);
});
