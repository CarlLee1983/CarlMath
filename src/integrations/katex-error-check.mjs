import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";

// 第二道關卡：掃描輸出的 HTML，rehype-katex 的錯誤輸出（katex-error）只要殘留就讓 build 失敗。
async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith(".html")) yield path;
  }
}

export default function katexErrorCheck() {
  return {
    name: "carlmath-katex-error-check",
    hooks: {
      "astro:build:done": async ({ dir }) => {
        const root = fileURLToPath(dir);
        const bad = [];
        for await (const file of htmlFiles(root)) {
          if ((await readFile(file, "utf8")).includes("katex-error")) {
            bad.push(relative(root, file));
          }
        }
        if (bad.length > 0) {
          throw new Error(`輸出含有 katex-error（數學式渲染失敗）：\n${bad.map((p) => `  ${p}`).join("\n")}`);
        }
      },
    },
  };
}
