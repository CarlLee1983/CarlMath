// 內容驗證 CLI：讀內容根目錄的課程地圖，印出違規清單；有 error 時 exit 1。
// 教材規則（frontmatter、9 段 H2、元件白名單、教具、篇幅）都由 loadContent 套用。
import { contentRoot } from "../src/content/content-dir.ts";
import { formatIssue, loadContent, type LoadedContent } from "../src/lib/content.ts";

let loaded: LoadedContent;
try {
  loaded = loadContent(contentRoot());
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}

const { issues } = loaded;

for (const issue of issues) {
  console.log(formatIssue(issue));
}

const errors = issues.filter((issue) => issue.level === "error").length;
const warnings = issues.length - errors;
if (loaded.ok) {
  const { courseMap, index } = loaded;
  const family = index.units.filter((unit) => unit.family).length;
  console.log(`${courseMap.stages.length} 個階段、${index.units.length} 個單元、親子共學 ${family} 個；${errors} 個錯誤、${warnings} 個提醒`);
} else {
  console.log(`內容有誤；${errors} 個錯誤、${warnings} 個提醒`);
}
process.exit(loaded.ok ? 0 : 1);
