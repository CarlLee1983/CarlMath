import { test, expect, type Page } from "@playwright/test";

// 取自色票 token 的淺色與深色值（computed color 格式）
const LIGHT = {
  "--bg": "rgb(251, 250, 247)",
  "--fg": "rgb(34, 37, 42)",
  "--accent": "rgb(47, 111, 222)",
  "--family": "rgb(138, 90, 0)",
};
const DARK = {
  "--bg": "rgb(23, 25, 28)",
  "--fg": "rgb(230, 228, 223)",
  "--accent": "rgb(122, 167, 255)",
  "--family": "rgb(240, 192, 96)",
};

// 以探針元素讀 token 的實際顏色，不依賴 token 在 CSS 裡的寫法
async function readTokens(page: Page) {
  return page.evaluate((names) => {
    const probe = document.createElement("div");
    document.body.append(probe);
    const result: Record<string, string> = {};
    for (const name of names) {
      probe.style.color = `var(${name})`;
      result[name] = getComputedStyle(probe).color;
    }
    probe.remove();
    return result;
  }, Object.keys(LIGHT));
}

const setTheme = (page: Page, theme: string) =>
  page.evaluate((t) => document.documentElement.setAttribute("data-theme", t), theme);

// 顏色方案由各 describe 自行指定，只在 desktop project 跑一次
test.beforeEach(({}, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "以 describe 的 colorScheme 驗證");
});

async function expectTokens(page: Page, expected: Record<string, string>) {
  expect(await readTokens(page)).toEqual(expected);
  // body 背景走 --bg
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(expected["--bg"]);
}

test.describe("系統為淺色", () => {
  test.use({ colorScheme: "light" });

  test("預設為淺色 token", async ({ page }) => {
    await page.goto("/");
    await expectTokens(page, LIGHT);
  });

  test('data-theme="dark" 強制深色', async ({ page }) => {
    await page.goto("/");
    await setTheme(page, "dark");
    await expectTokens(page, DARK);
  });

  test('data-theme="light" 維持淺色', async ({ page }) => {
    await page.goto("/");
    await setTheme(page, "light");
    await expectTokens(page, LIGHT);
  });
});

test.describe("系統為深色", () => {
  test.use({ colorScheme: "dark" });

  test("預設為深色 token", async ({ page }) => {
    await page.goto("/");
    await expectTokens(page, DARK);
  });

  test('data-theme="light" 仍為淺色', async ({ page }) => {
    await page.goto("/");
    await setTheme(page, "light");
    await expectTokens(page, LIGHT);
  });

  test('data-theme="dark" 維持深色', async ({ page }) => {
    await page.goto("/");
    await setTheme(page, "dark");
    await expectTokens(page, DARK);
  });
});
