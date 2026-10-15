import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.CARLMATH_TEST_PORT ?? 4392);
if (!Number.isInteger(port) || port < 1024 || port > 65535) {
  throw new Error("CARLMATH_TEST_PORT 必須是 1024 到 65535 的整數。");
}
const baseURL = `http://127.0.0.1:${port}`;
// e2e 測試的是 build:e2e 以 fixture 內容建出來的站台
const outDir = process.env.ASTRO_OUT_DIR ?? "dist-e2e";

export default defineConfig({
  testDir: "./tests",
  testMatch: "*.spec.ts",
  // 首頁有進場淡入；測試一律看動態結束後的最終狀態（內容、結構與對比），不取樣過渡中的畫面
  use: { baseURL, trace: "retain-on-failure", reducedMotion: "reduce" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    {
      name: "desktop-dark",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, colorScheme: "dark" },
    },
    {
      name: "narrow",
      use: { ...devices["Desktop Chrome"], viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true },
    },
  ],
  webServer: {
    command: `ASTRO_OUT_DIR=${outDir} pnpm run preview --port ${port} --ignore-lock`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
