import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Issue, Unit } from "./course-map-model.ts";
import { lessonIssue } from "./lesson-issue.ts";
import type { ParsedActivity, ParsedLesson } from "./lesson-parse.ts";
import { ACTIVITY_HEADING } from "./lesson-structure.ts";

/** `<Activity>` 子內容的六個 H3，依序（「時間」取自 `minutes` 屬性，不是 H3）。元件渲染時也用它。 */
export const ACTIVITY_FIELDS = ["目的", "材料", "步驟", "家長引導語", "卡關時", "回饋語範例"] as const;
const MIN_ACTIVITIES = 1;
const MAX_ACTIVITIES = 3;
const MIN_MINUTES = 5;
const MAX_MINUTES = 15;
const PRINT_PREFIX = "/print/";
/**
 * 可列印材料頁的唯一來源：`src/pages/print/<材料 id>.astro`，網址是 `/print/<材料 id>/`。
 * 以專案根目錄（目前工作目錄）定位，和 contentRoot 相同；astro.config 會被打包到別處執行，不能用 import.meta.url。
 */
const PRINT_PAGES_DIR = resolve("src/pages/print");
const PRINT_URL = /^\/print\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/;

/** `/print/` 連結是否對應到存在的可列印材料頁（寫法必須是 `/print/<材料 id>/`）。 */
function printPageExists(url: string): boolean {
  const id = PRINT_URL.exec(url)?.[1];
  return id !== undefined && existsSync(join(PRINT_PAGES_DIR, `${id}.astro`));
}

/** `minutes` 合格寫法：5–15 的整數（`"10"`），或用短破折號 `–`（U+2013）或 `-` 寫的區間（`"5–10"`、`"5-10"`，前小後大且都在範圍內）。 */
export function validMinutes(minutes: string): boolean {
  const match = /^([1-9]\d*)(?:[–-]([1-9]\d*))?$/.exec(minutes);
  if (!match) return false;
  const from = Number(match[1]);
  const to = match[2] === undefined ? undefined : Number(match[2]);
  const inRange = (n: number) => n >= MIN_MINUTES && n <= MAX_MINUTES;
  return inRange(from) && (to === undefined || (to > from && inRange(to)));
}

/** 顯示用的 `minutes`：區間一律用 `–`（U+2013），不論撰寫時用的是哪一種。 */
export function displayMinutes(minutes: string): string {
  return minutes.replace("-", "–");
}

/** 六個 H3 的問題：缺少、多出、重複、順序錯，各一則描述。 */
function fieldProblems(h3: string[]): string[] {
  const problems: string[] = [];
  const known = ACTIVITY_FIELDS as readonly string[];
  const seen: string[] = [];
  for (const heading of h3) {
    if (!known.includes(heading)) problems.push(`多出不在規格內的 H3「${heading}」`);
    else if (seen.includes(heading)) problems.push(`H3「${heading}」重複出現`);
    else seen.push(heading);
  }
  for (const field of ACTIVITY_FIELDS) if (!seen.includes(field)) problems.push(`缺少 H3「${field}」`);
  const expectedPresent = ACTIVITY_FIELDS.filter((field) => seen.includes(field));
  const mismatch = seen.findIndex((heading, i) => heading !== expectedPresent[i]);
  if (mismatch !== -1) {
    problems.push(`H3 順序錯誤：依序排列時，第 ${mismatch + 1} 個應為「${expectedPresent[mismatch]}」，目前是「${seen[mismatch]}」`);
  }
  return problems;
}

function shapeProblems(activity: ParsedActivity, family: boolean): string[] {
  const problems: string[] = [];
  if (!family) problems.push("只能用在親子篇的「親子活動」段，一般篇不得使用");
  else if (activity.section !== ACTIVITY_HEADING) {
    problems.push(`只能用在親子篇的「${ACTIVITY_HEADING}」段，目前在${activity.section ? `「${activity.section}」` : "第一個 H2 之前"}`);
  }
  if (activity.title === undefined || activity.title.trim() === "") problems.push("title 必填，須為非空字串");
  if (activity.minutes === undefined || !validMinutes(activity.minutes)) {
    const current = activity.minutes === undefined ? "缺漏或不是字串" : JSON.stringify(activity.minutes);
    problems.push(`minutes 須為 ${MIN_MINUTES}–${MAX_MINUTES} 的整數字串或「a–b」區間（例如 "10"、"5–10"，破折號用短破折號 – 或 -），目前是 ${current}`);
  }
  if (activity.leadingContent) problems.push("第一個 H3 之前不得有內容");
  if (activity.strayHeadings > 0) problems.push("子內容只能有六個 H3，不得有其他標題");
  problems.push(...fieldProblems(activity.h3));
  return problems;
}

/**
 * `<Activity>` 規則：
 * - 結構（error）：位置、title、minutes、六個 H3 依序齊全；
 * - 數量（error）：親子篇「親子活動」段有 1–3 個；
 * - 可列印材料（warning）：全篇至少一個材料欄連到 `/print/`（列印頁之後才建，所以不擋 build）。
 */
export function activityIssues(lesson: ParsedLesson, unit: Unit): Issue[] {
  const { path, activities } = lesson;
  const issues: Issue[] = [];
  activities.forEach((activity, i) => {
    for (const problem of shapeProblems(activity, unit.family)) {
      issues.push(lessonIssue("lesson-activity-shape", `教材 ${path} 的第 ${i + 1} 個 <Activity>：${problem}`, unit.id));
    }
  });
  if (!unit.family) return issues;

  if (lesson.h2.includes(ACTIVITY_HEADING)) {
    const count = activities.filter((activity) => activity.section === ACTIVITY_HEADING).length;
    if (count < MIN_ACTIVITIES || count > MAX_ACTIVITIES) {
      issues.push(lessonIssue("lesson-activity-count", `教材 ${path} 的「${ACTIVITY_HEADING}」段有 ${count} 個 <Activity>，應為 ${MIN_ACTIVITIES}–${MAX_ACTIVITIES} 個`, unit.id));
    }
  }
  const printable = activities.some((activity) => activity.materialLinks.some((url) => url.startsWith(PRINT_PREFIX)));
  if (activities.length > 0 && !printable) {
    issues.push(lessonIssue("lesson-activity-printable", `教材 ${path} 沒有任何 <Activity> 的材料欄連到可列印材料（${PRINT_PREFIX}<材料 id>/）；親子篇至少要有一個附可列印材料的活動`, unit.id));
  }
  for (const url of new Set(activities.flatMap((activity) => activity.materialLinks))) {
    if (url.startsWith(PRINT_PREFIX) && !printPageExists(url)) {
      issues.push(lessonIssue("lesson-activity-print-missing", `教材 ${path} 的材料欄連到 ${JSON.stringify(url)}，但沒有這份可列印材料；寫法是 ${PRINT_PREFIX}<材料 id>/，頁面在 src/pages/print/<材料 id>.astro`, unit.id));
    }
  }
  return issues;
}
