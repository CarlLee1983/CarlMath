import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";

// Explicit software WebGL makes the normal-render test meaningful on headless CI.
test.use({ launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });
const path = "/geometry/volume/";
const room = (page: Page) => page.locator("[data-geometry-classroom]");
const dimension = (page: Page, name: string) => room(page).locator(`input[name="${name}"]`);
async function setDimension(page: Page, name: string, value: number) {
  await dimension(page, name).fill(String(value));
}
async function open(page: Page) {
  await page.goto(path);
  await expect(room(page)).toBeVisible();
  await expect(room(page).locator("[data-render-status]")).toHaveAttribute("data-state", /ready|fallback/);
}

async function trackDrawCalls(page: Page) {
  await page.addInitScript(() => {
    const state = window as typeof window & { __geometryDrawCalls: number };
    state.__geometryDrawCalls = 0;
    const original = WebGL2RenderingContext.prototype.drawElementsInstanced;
    WebGL2RenderingContext.prototype.drawElementsInstanced = function (...args) {
      state.__geometryDrawCalls++;
      return Reflect.apply(original, this, args);
    };
  });
}
const drawCalls = (page: Page) => page.evaluate(() => (window as typeof window & { __geometryDrawCalls: number }).__geometryDrawCalls);

test("WebGL 真正啟動，初始模型及圖解同步", async ({ page, context, hasTouch }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await trackDrawCalls(page);
  await open(page);
  await expect(room(page).locator("[data-render-status]")).toHaveAttribute("data-state", "ready");
  await expect.poll(() => page.evaluate(() => (window as typeof window & { __geometryDrawCalls: number }).__geometryDrawCalls)).toBeGreaterThan(0);
  await expect(room(page).locator("canvas")).toBeVisible();
  await expect(dimension(page, "length")).toHaveValue("3");
  await expect(dimension(page, "width")).toHaveValue("2");
  await expect(dimension(page, "height")).toHaveValue("2");
  await expect(room(page).locator("[data-layer-count]")).toHaveText("1");
  await expect(room(page).locator("[data-volume]")).toHaveText("12");
  await expect(room(page).locator("[data-layer-area]")).toHaveText("6");
  await expect(room(page).locator("[data-fallback]")).toBeVisible();
  const canvas = room(page).locator("canvas");
  await canvas.scrollIntoViewIfNeeded();
  const beforeDrag = await canvas.screenshot();
  const beforeDraws = await drawCalls(page);
  const box = (await canvas.boundingBox())!;
  const x = box.x + box.width * 0.45;
  const y = box.y + box.height * 0.5;
  if (hasTouch) {
    // Send real browser touch input, so OrbitControls receives native pointer capture.
    const session = await context.newCDPSession(page);
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
    for (let step = 1; step <= 5; step++) {
      await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + step * 12, y: y + step * 4 }] });
    }
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await session.detach();
  } else {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 70, y + 25, { steps: 5 });
    await page.mouse.up();
  }
  await expect.poll(() => drawCalls(page)).toBeGreaterThan(beforeDraws);
  expect((await canvas.screenshot()).equals(beforeDrag)).toBe(false);
  await room(page).locator("[data-reset-view]").click();
  await expect(room(page).locator("[data-render-status]")).toHaveAttribute("data-state", "ready");
  expect(errors).toEqual([]);
});

test("調整尺寸、逐層堆疊、上限與重新開始", async ({ page }) => {
  await open(page);
  await setDimension(page, "length", 4);
  await setDimension(page, "width", 3);
  await setDimension(page, "height", 3);
  await expect(room(page).locator("[data-layer-area]")).toHaveText("12");
  await expect(room(page).locator("[data-volume]")).toHaveText("36");
  const count = room(page).locator("[data-layer-count]");
  const add = room(page).locator("[data-add-layer]");
  await expect(count).toHaveText("1");
  await add.click();
  await expect(count).toHaveText("2");
  await add.click();
  await expect(count).toHaveText("3");
  await expect(add).toBeDisabled();
  await room(page).locator("[data-show-all]").click();
  await expect(count).toHaveText("3");
  await room(page).locator("[data-reset-stack]").click();
  await expect(count).toHaveText("1");
  await expect(add).toBeEnabled();
  await room(page).locator("[data-show-all]").click();
  await expect(count).toHaveText("3");
  await setDimension(page, "height", 1);
  await expect(count).toHaveText("1");
  await expect(add).toBeDisabled();
  await expect(room(page).locator("[data-volume]")).toHaveText("12");
});

test("正方體鎖定三邊且切回長方體後可獨立調整", async ({ page }) => {
  await open(page);
  await dimension(page, "cube").check();
  await expect(dimension(page, "width")).toHaveValue("3");
  await expect(dimension(page, "height")).toHaveValue("3");
  await expect(dimension(page, "width")).toBeDisabled();
  await expect(dimension(page, "height")).toBeDisabled();
  await setDimension(page, "length", 8);
  await expect(dimension(page, "width")).toHaveValue("8");
  await expect(dimension(page, "height")).toHaveValue("8");
  await expect(room(page).locator("[data-volume]")).toHaveText("512");
  await expect(room(page).locator("[data-layer-area]")).toHaveText("64");
  await room(page).locator("[data-show-all]").click();
  await expect(room(page).locator("[data-layer-count]")).toHaveText("8");
  await dimension(page, "cube").uncheck();
  await expect(dimension(page, "width")).toBeEnabled();
  await expect(dimension(page, "height")).toBeEnabled();
  await setDimension(page, "width", 1);
  await expect(room(page).locator("[data-volume]")).toHaveText("64");
  await expect(room(page).locator("[data-layer-count]")).toHaveText("1");
});

test("練習題區分無效、錯誤與正確答案，容許重試", async ({ page }) => {
  await open(page);
  const form = page.locator("form[data-practice]");
  const answer = form.locator('input[name="answer"]');
  const feedback = page.locator("[data-feedback]");
  await answer.fill("");
  await form.locator('[type="submit"]').click();
  await expect(feedback).toHaveAttribute("data-state", "invalid");
  await answer.fill("12");
  await form.locator('[type="submit"]').click();
  await expect(feedback).toHaveAttribute("data-state", "incorrect");
  await expect(feedback).not.toBeEmpty();
  await answer.fill("24");
  await form.locator('[type="submit"]').click();
  await expect(feedback).toHaveAttribute("data-state", "correct");
  await expect(feedback).not.toBeEmpty();
});

test("WebGL 不可用仍有可操作的二維分層教具", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, contextId: string, ...args: unknown[]) {
      if (/webgl/i.test(contextId)) return null;
      return Reflect.apply(original, this, [contextId, ...args]);
    } as typeof original;
  });
  await open(page);
  await expect(room(page).locator("[data-render-status]")).toHaveAttribute("data-state", "fallback");
  await expect(room(page).locator("[data-fallback]")).toBeVisible();
  await setDimension(page, "length", 5);
  await expect(room(page).locator("[data-layer-area]")).toHaveText("10");
  await expect(room(page).locator("[data-volume]")).toHaveText("20");
  await room(page).locator("[data-add-layer]").click();
  await expect(room(page).locator("[data-layer-count]")).toHaveText("2");
});

test("320px 螢幕無水平溢出，鍵盤可調整尺寸", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await open(page);
  await dimension(page, "length").focus();
  await page.keyboard.press("ArrowRight");
  await expect(dimension(page, "length")).toHaveValue("4");
  await expect(room(page).locator("[data-volume]")).toHaveText("16");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("教室沒有 serious 或 critical 無障礙問題", async ({ page }) => {
  await open(page);
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});


test("鍵盤視角與縮放按鈕會重新繪製模型", async ({ page }) => {
  await trackDrawCalls(page);
  await open(page);
  await expect(room(page).locator("[data-render-status]")).toHaveAttribute("data-state", "ready");
  await expect.poll(() => drawCalls(page)).toBeGreaterThan(0);
  const canvas = room(page).locator("canvas");
  for (const selector of ['[data-view="front"]', '[data-view="top"]', '[data-view="side"]', '[data-zoom="1.25"]', '[data-zoom="0.8"]']) {
    const before = await canvas.screenshot();
    const count = await drawCalls(page);
    const button = room(page).locator(selector);
    await button.focus();
    await expect(button).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(() => drawCalls(page)).toBeGreaterThan(count);
    expect((await canvas.screenshot()).equals(before)).toBe(false);
    await expect(room(page).locator("[data-volume]")).toHaveText("12");
  }
});

test("繪製途中失去 WebGL 後切換圖解，操作與計算仍可繼續", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  await expect(room(page).locator("[data-render-status]")).toHaveAttribute("data-state", "ready");
  await room(page).locator("canvas").evaluate((canvas) => {
    const gl = (canvas as HTMLCanvasElement).getContext("webgl2");
    const extension = gl?.getExtension("WEBGL_lose_context");
    if (!extension) throw new Error("Software WebGL must support WEBGL_lose_context for this regression test");
    extension.loseContext();
  });
  await expect(room(page).locator("[data-render-status]")).toHaveAttribute("data-state", "fallback");
  await expect(room(page).locator("[data-fallback]")).toBeVisible();
  await setDimension(page, "length", 4);
  await setDimension(page, "width", 3);
  await setDimension(page, "height", 3);
  await expect(room(page).locator("[data-layer-area]")).toHaveText("12");
  await expect(room(page).locator("[data-volume]")).toHaveText("36");
  await room(page).locator("[data-show-all]").click();
  await expect(room(page).locator("[data-layer-count]")).toHaveText("3");
  await room(page).locator("[data-reset-stack]").click();
  await expect(room(page).locator("[data-layer-count]")).toHaveText("1");
  await dimension(page, "cube").check();
  await expect(room(page).locator("[data-volume]")).toHaveText("64");
  await expect(room(page).locator("[data-render-status]")).toHaveAttribute("data-state", "fallback");
  expect(errors).toEqual([]);
});
