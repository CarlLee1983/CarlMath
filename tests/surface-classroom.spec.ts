import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });
const room = (page: Page) => page.locator("[data-surface-classroom]");
const input = (page: Page, name: string) => room(page).locator(`input[name="${name}"]`);
const area = (page: Page) => room(page).locator("[data-surface-area]");
const status = (page: Page) => room(page).locator("[data-render-status]");
const net = (page: Page) => room(page).locator("svg[data-net], [data-net] svg");
async function open(page: Page) {
  await page.goto("/geometry/surface-area/");
  await expect(room(page)).toBeVisible();
  await expect(status(page)).toHaveAttribute("data-state", /ready|fallback/);
}
async function trackDrawCalls(page: Page) {
  await page.addInitScript(() => {
    const state = window as typeof window & { __surfaceDrawCalls: number };
    state.__surfaceDrawCalls = 0;
    // Mesh renderers can use indexed or non-indexed geometry. Observe real GL calls,
    // not requestAnimationFrame or application counters.
    for (const prototype of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
      for (const name of ["drawElements", "drawArrays"] as const) {
        const original = prototype[name];
        Object.defineProperty(prototype, name, { configurable: true, writable: true, value: function (...args: unknown[]) {
          state.__surfaceDrawCalls++;
          return Reflect.apply(original, this, args);
        } });
      }
    }
  });
}
const drawCalls = (page: Page) => page.evaluate(() => (window as typeof window & { __surfaceDrawCalls: number }).__surfaceDrawCalls);

async function expectNetArea(page: Page, total: number) {
  await expect(net(page).locator("rect[data-face]")).toHaveCount(6);
  const sum = await net(page).locator("rect[data-face]").evaluateAll((rectangles) => rectangles.reduce((sum, rectangle) => {
    return sum + Number(rectangle.getAttribute("width")) * Number(rectangle.getAttribute("height"));
  }, 0));
  const length = Number(await input(page, "length").inputValue());
  const height = Number(await input(page, "height").inputValue());
  const scale = 420 / (length + 2 * height);
  expect(sum / scale ** 2).toBeCloseTo(total, 8);
}

test("真實 WebGL 繪製、公式與六面展開圖同步", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await trackDrawCalls(page);
  await open(page);
  await expect(status(page)).toHaveAttribute("data-state", "ready");
  await expect.poll(() => drawCalls(page)).toBeGreaterThan(0);
  await expect(room(page).locator("canvas")).toBeVisible();
  for (const [name, value] of [["length", "3"], ["width", "2"], ["height", "2"]]) await expect(input(page, name)).toHaveValue(value);
  await expect(area(page)).toHaveText("32");
  await expect(room(page).locator("[data-area-formula]")).toHaveText("2 ×（3 × 2 + 3 × 2 + 2 × 2）");
  await expectNetArea(page, 32);
  expect(errors).toEqual([]);
});

test("尺寸與正方體模式同步，切回長方體可獨立調整", async ({ page }) => {
  await open(page);
  await input(page, "length").fill("4");
  await input(page, "width").fill("3");
  await expect(area(page)).toHaveText("52");
  await expect(room(page).locator("[data-area-formula]")).toHaveText("2 ×（4 × 3 + 4 × 2 + 3 × 2）");
  await expectNetArea(page, 52);
  await input(page, "cube").check();
  for (const name of ["width", "height"]) {
    await expect(input(page, name)).toHaveValue("4");
    await expect(input(page, name)).toBeDisabled();
  }
  await expect(area(page)).toHaveText("96");
  await input(page, "length").fill("8");
  await expect(area(page)).toHaveText("384");
  await expectNetArea(page, 384);
  for (const name of ["width", "height"]) await expect(input(page, name)).toHaveValue("8");
  await input(page, "cube").uncheck();
  for (const name of ["width", "height"]) await expect(input(page, name)).toBeEnabled();
  await input(page, "width").fill("1");
  await expect(area(page)).toHaveText("160");
  await expectNetArea(page, 160);
});

test("展開、摺合與中間狀態真的改變畫面但不改變表面積", async ({ page }) => {
  await trackDrawCalls(page);
  await open(page);
  await expect(status(page)).toHaveAttribute("data-state", "ready");
  const canvas = room(page).locator("canvas");
  await room(page).locator("[data-fold]").click();
  await expect(input(page, "openness")).toHaveValue("0");
  const folded = await canvas.screenshot();
  const count = await drawCalls(page);
  await input(page, "openness").fill("50");
  await expect.poll(() => drawCalls(page)).toBeGreaterThan(count);
  const partial = await canvas.screenshot();
  expect(partial.equals(folded)).toBe(false);
  await room(page).locator("[data-unfold]").click();
  await expect(input(page, "openness")).toHaveValue("100");
  const unfolded = await canvas.screenshot();
  expect(unfolded.equals(partial)).toBe(false);
  expect(unfolded.equals(folded)).toBe(false);
  await expect(area(page)).toHaveText("32");
  await expectNetArea(page, 32);
  await room(page).locator("[data-fold]").click();
  await expect(input(page, "openness")).toHaveValue("0");
});

test("滑鼠或觸控可旋轉，鍵盤可使用視角與縮放按鈕", async ({ page, context, hasTouch }) => {
  await trackDrawCalls(page);
  await open(page);
  await expect(status(page)).toHaveAttribute("data-state", "ready");
  const canvas = room(page).locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const before = await canvas.screenshot();
  const box = (await canvas.boundingBox())!;
  const x = box.x + box.width * 0.4;
  const y = box.y + box.height * 0.5;
  if (hasTouch) {
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 5; step++) await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + step * 12, y: y + step * 4 }] });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 60, y + 20, { steps: 5 });
    await page.mouse.up();
  }
  expect((await canvas.screenshot()).equals(before)).toBe(false);
  for (const selector of ['[data-view="front"]', '[data-view="top"]', '[data-view="side"]', '[data-zoom="1.25"]', '[data-zoom="0.8"]', '[data-reset-view]']) {
    const previous = await canvas.screenshot();
    const count = await drawCalls(page);
    await room(page).locator(selector).focus();
    await page.keyboard.press("Enter");
    await expect.poll(() => drawCalls(page)).toBeGreaterThan(count);
    expect((await canvas.screenshot()).equals(previous)).toBe(false);
  }
  await expect(area(page)).toHaveText("32");
});

test("練習題區分空白、錯誤與正確答案並允許重試", async ({ page }) => {
  await open(page);
  const form = page.locator("form[data-practice]");
  const answer = form.locator('input[name="answer"]');
  const feedback = page.locator("[data-feedback]");
  for (const [value, state] of [["", "invalid"], ["24", "incorrect"], ["52", "correct"]]) {
    await answer.fill(value);
    await form.locator('[type="submit"]').click();
    await expect(feedback).toHaveAttribute("data-state", state);
    await expect(feedback).not.toBeEmpty();
  }
});

for (const mode of ["blocked", "context-lost"] as const) {
  test(`${mode}: 沒有 WebGL 時六面圖解與計算仍能操作`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    if (mode === "blocked") await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
        if (/webgl/i.test(contextId)) return null;
        return Reflect.apply(original, this, [contextId, ...args]);
      } as typeof original;
    });
    await open(page);
    if (mode === "context-lost") {
      await expect(status(page)).toHaveAttribute("data-state", "ready");
      await room(page).locator("canvas").evaluate((canvas) => {
        const extension = (canvas as HTMLCanvasElement).getContext("webgl2")?.getExtension("WEBGL_lose_context");
        if (!extension) throw new Error("Software WebGL must support WEBGL_lose_context");
        extension.loseContext();
      });
    }
    await expect(status(page)).toHaveAttribute("data-state", "fallback");
    await expect(net(page)).toBeVisible();
    await input(page, "length").fill("4");
    await input(page, "width").fill("3");
    await expect(area(page)).toHaveText("52");
    await expectNetArea(page, 52);
    await room(page).locator("[data-unfold]").click();
    await expect(input(page, "openness")).toHaveValue("100");
    await input(page, "cube").check();
    await expect(area(page)).toHaveText("96");
    await expectNetArea(page, 96);
    expect(errors).toEqual([]);
  });
}

test("320px 深色畫面無水平溢出，鍵盤可改邊長與展開進度", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ colorScheme: "dark" });
  await open(page);
  await input(page, "length").focus();
  await page.keyboard.press("ArrowRight");
  await expect(input(page, "length")).toHaveValue("4");
  await expect(area(page)).toHaveText("40");
  await room(page).locator("[data-fold]").click();
  await input(page, "openness").focus();
  await page.keyboard.press("End");
  await expect(input(page, "openness")).toHaveValue("100");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("教室沒有 serious 或 critical 無障礙問題", async ({ page }) => {
  await open(page);
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});
