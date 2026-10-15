import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";

for (const path of ["/", "/units/math-demo/", "/map/"]) {
  test(`axe 在 ${path} 無 serious/critical 違規`, async ({ page }) => {
    await page.goto(path);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
}
