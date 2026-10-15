// 內容驗證 CLI：讀內容根目錄的課程地圖，印出違規清單；有 error 時 exit 1。
// 教材驗證（frontmatter、結構、元件）尚未納入：教材 `unit` 與課程地圖 id 的互相核對、
// 以及從教材檔推導 writtenUnitIds，屬於票「05 教材驗證與內容撰寫規範」與「03 未撰寫單元頁與 SEO」。
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { contentRoot } from "../src/content/content-dir.ts";
import { checkCourseMap, createCourseIndex } from "../src/lib/course-map.ts";

const file = join(contentRoot(), "course-map.yaml");
let text: string;
try {
  text = readFileSync(file, "utf8");
} catch (e) {
  console.error(`讀不到課程地圖 ${file}：${(e as Error).message}`);
  process.exit(1);
}

const { courseMap, issues } = checkCourseMap(text);

for (const issue of issues) {
  console.log([issue.level.padEnd(7), issue.code, issue.unitId ?? "-", issue.message].join("\t"));
}

const errors = issues.filter((issue) => issue.level === "error").length;
const warnings = issues.length - errors;
if (courseMap) {
  const units = createCourseIndex(courseMap, []).units;
  const family = units.filter((unit) => unit.family).length;
  console.log(`${courseMap.stages.length} 個階段、${units.length} 個單元、親子共學 ${family} 個；${errors} 個錯誤、${warnings} 個提醒`);
} else {
  console.log(`課程地圖結構有誤；${errors} 個錯誤、${warnings} 個提醒`);
}
process.exit(errors > 0 ? 1 : 0);
