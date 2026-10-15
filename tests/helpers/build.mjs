import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// 注意：build 之間不能並行（package.json 的 test 用 --test-concurrency=1）：
// 並行的 astro build 共用 .astro/ 與 node_modules/.vite，會互相覆蓋而隨機失敗。
// 以指定內容目錄執行 astro build。onSuccess 在輸出目錄被刪除前呼叫，可檢查 build 產物。
export function buildWith(contentDir, onSuccess) {
  const outDir = mkdtempSync(join(tmpdir(), "carlmath-build-"));
  try {
    const result = spawnSync("pnpm", ["exec", "astro", "build"], {
      env: { ...process.env, CARLMATH_CONTENT_DIR: contentDir, ASTRO_OUT_DIR: outDir },
      encoding: "utf8",
    });
    if (result.status === 0) onSuccess?.(outDir);
    return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}
