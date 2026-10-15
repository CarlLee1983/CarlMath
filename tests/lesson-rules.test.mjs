import { test } from "node:test";
import assert from "node:assert/strict";
import { loadContent } from "../src/lib/content.ts";

// 教材規則測試（接縫 1）：每個 fixture 根目錄放一組小型課程地圖，一個單元對應一種案例。
const fixtureRoot = (name) => `tests/fixtures/lessons/${name}`;
const issuesOf = (name, unitId, code) =>
  loadContent(fixtureRoot(name)).issues.filter((i) => i.unitId === unitId && (code === undefined || i.code === code));
// fixture 教材為了精簡都很短，會有篇幅 warning；合格案例只斷言沒有 error。
const errorsOf = (name, unitId) => issuesOf(name, unitId).filter((i) => i.level === "error");

// ---- 規則 1：frontmatter ----

test("frontmatter 多餘欄位回報 lesson-frontmatter-extra 並點名欄位與檔案", () => {
  const [issue, ...rest] = issuesOf("frontmatter", "fm-extra", "lesson-frontmatter-extra");
  assert.equal(issue?.level, "error");
  assert.equal(rest.length, 1);
  assert.match(issue.message, /extra\.mdx/);
  assert.match(`${issue.message}${rest[0].message}`, /title/);
  assert.match(`${issue.message}${rest[0].message}`, /prerequisites/);
});

test("updated 不是合法日期回報 lesson-frontmatter-invalid", () => {
  for (const unit of ["fm-bad-date", "fm-bad-date-text"]) {
    const [issue] = issuesOf("frontmatter", unit, "lesson-frontmatter-invalid");
    assert.equal(issue?.level, "error", unit);
    assert.match(issue.message, /updated/);
  }
});

test("description 不是字串回報 lesson-frontmatter-invalid", () => {
  const [issue] = issuesOf("frontmatter", "fm-bad-description", "lesson-frontmatter-invalid");
  assert.equal(issue?.level, "error");
  assert.match(issue.message, /description/);
});

test("只含 unit、description、updated 的 frontmatter 合格", () => {
  assert.deepEqual(errorsOf("frontmatter", "fm-ok"), []);
});

// ---- 規則 2：一般篇的 9 段 H2 ----

const structure = (root, unit) => issuesOf(root, unit, "lesson-structure");

test("一般篇缺一段 H2 回報 lesson-structure 並指出缺哪段", () => {
  const [issue, ...rest] = structure("structure-general", "sg-missing");
  assert.equal(issue?.level, "error");
  assert.equal(rest.length, 0);
  assert.match(issue.message, /缺少.*「推理」/);
  assert.match(issue.message, /missing\.mdx/);
});

test("一般篇 H2 順序錯誤回報 lesson-structure 並指出哪段位置不對", () => {
  const [issue, ...rest] = structure("structure-general", "sg-order");
  assert.equal(issue?.level, "error");
  assert.equal(rest.length, 0);
  assert.match(issue.message, /順序/);
  assert.match(issue.message, /「範例」/);
});

test("一般篇多出其他 H2 回報 lesson-structure 並指出多的是哪段", () => {
  const [issue, ...rest] = structure("structure-general", "sg-extra");
  assert.equal(issue?.level, "error");
  assert.equal(rest.length, 0);
  assert.match(issue.message, /多出.*「補充」/);
});

test("無先修的單元第 2 段用「暖身」合格", () => {
  assert.deepEqual(structure("structure-general", "sg-base"), []);
});

test("無先修的單元第 2 段用「先修回顧」違規", () => {
  const [issue] = structure("structure-general", "sg-warmup-bad");
  assert.equal(issue?.level, "error");
  assert.match(issue.message, /沒有先修/);
  assert.match(issue.message, /「暖身」/);
  assert.match(issue.message, /「先修回顧」/);
});

test("有先修的單元第 2 段用「先修回顧」合格、用「暖身」違規", () => {
  assert.deepEqual(structure("structure-general", "sg-dep-ok"), []);
  const [issue] = structure("structure-general", "sg-dep-warmup");
  assert.equal(issue?.level, "error");
  assert.match(issue.message, /有先修/);
  assert.match(issue.message, /「先修回顧」/);
  assert.match(issue.message, /「暖身」/);
});

// ---- 規則 2：親子篇的 9 段 H2 ----

test("親子篇依序有 9 段 H2 合格", () => {
  assert.deepEqual(structure("structure-family", "sf-ok"), []);
});

test("親子篇缺「大人先懂」回報 lesson-structure", () => {
  const [issue, ...rest] = structure("structure-family", "sf-missing");
  assert.equal(issue?.level, "error");
  assert.equal(rest.length, 0);
  assert.match(issue.message, /缺少.*「大人先懂」/);
});

test("親子單元寫成一般篇結構違規，指出缺少親子篇的段落", () => {
  const messages = structure("structure-family", "sf-general-body").map((i) => i.message);
  assert.ok(messages.some((m) => /缺少.*「給家長的話」/.test(m)));
  assert.ok(messages.some((m) => /多出.*「直覺」/.test(m)));
});

test("一般單元寫成親子篇結構違規", () => {
  const messages = structure("structure-family", "sf-family-body-on-general").map((i) => i.message);
  assert.ok(messages.some((m) => /缺少.*「直覺」/.test(m)));
  assert.ok(messages.some((m) => /多出.*「給家長的話」/.test(m)));
});

// ---- 規則 3：MDX 元件白名單與 import ----

const componentIssues = (unit) => issuesOf("components", unit).filter((i) => /^lesson-(component|import|export|skipcheck|misconception)/.test(i.code));
const messagesOf = (issues) => issues.map((i) => i.message).join("\n");

test("白名單元件與合法的教具 import（同目錄、站內 figures）合格", () => {
  assert.deepEqual(componentIssues("cm-ok"), []);
  assert.deepEqual(componentIssues("cm-family-ok"), []);
});

test("未列名的元件回報 lesson-component-forbidden 並點名元件", () => {
  const [issue, ...rest] = componentIssues("cm-unlisted");
  assert.equal(rest.length, 0);
  assert.equal(issue.code, "lesson-component-forbidden");
  assert.equal(issue.level, "error");
  assert.match(issue.message, /<Callout>/);
  assert.match(issue.message, /unlisted\.mdx/);
});

test("小寫 HTML、svg 與 fragment 都回報 lesson-component-forbidden", () => {
  const issues = componentIssues("cm-html");
  assert.ok(issues.every((i) => i.code === "lesson-component-forbidden"));
  const text = messagesOf(issues);
  assert.match(text, /<div>/);
  assert.match(text, /<svg>/);
  assert.match(text, /<>/);
});

test("非法 import（非教具檔、套件、具名、namespace、名稱不以 Figure 結尾）回報 lesson-import-forbidden", () => {
  const issues = componentIssues("cm-bad-import");
  const imports = issues.filter((i) => i.code === "lesson-import-forbidden");
  assert.equal(imports.length, 4);
  assert.match(messagesOf(imports), /"\.\/Foo\.astro"/);
  assert.match(messagesOf(imports), /"lodash"/);
  assert.match(messagesOf(imports), /"\.\/XFigure\.astro"/);
  assert.match(messagesOf(imports), /"\.\/YFigure\.astro"/);
  // 用到沒有合法 import 的 <Foo> 也是未列名元件
  assert.ok(issues.some((i) => i.code === "lesson-component-forbidden" && /<Foo>/.test(i.message)));
});

test("來源在別的目錄或不在 src/components/figures/ 的教具 import 違規，其元件也不放行", () => {
  const issues = componentIssues("cm-figure-elsewhere");
  assert.equal(issues.filter((i) => i.code === "lesson-import-forbidden").length, 2);
  const text = messagesOf(issues.filter((i) => i.code === "lesson-component-forbidden"));
  assert.match(text, /<OtherFigure>/);
  assert.match(text, /<LibFigure>/);
});

test("站內共用教具（src/components/figures/）可用 PascalCase 原名 import，不必以 Figure 結尾", () => {
  assert.deepEqual(componentIssues("cm-ok"), []);
});

test("站內教具 import 若名稱非 PascalCase、用具名 import 或蓋掉內建元件名稱則違規", () => {
  const imports = componentIssues("cm-site-bad").filter((i) => i.code === "lesson-import-forbidden");
  assert.equal(imports.length, 3);
  const text = messagesOf(imports);
  assert.match(text, /NumberLine\.astro/);
  assert.match(text, /Counters\.astro/);
  assert.match(text, /Answer\.astro/);
  // 蓋掉內建名稱的 Answer 不會被當成教具放行，其餘內建元件用法不受影響
  assert.deepEqual(componentIssues("cm-site-bad").filter((i) => i.code === "lesson-component-forbidden"), []);
});

test("export 回報 lesson-export-forbidden", () => {
  const [issue, ...rest] = componentIssues("cm-export");
  assert.equal(rest.length, 0);
  assert.equal(issue.code, "lesson-export-forbidden");
  assert.match(issue.message, /export/);
});

test("親子篇使用 <SkipCheck> 回報 lesson-skipcheck-in-family；一般篇可以用", () => {
  const [issue, ...rest] = componentIssues("cm-skipcheck-family");
  assert.equal(rest.length, 0);
  assert.equal(issue.code, "lesson-skipcheck-in-family");
  assert.equal(issue.level, "error");
  assert.deepEqual(componentIssues("cm-ok").filter((i) => i.code === "lesson-skipcheck-in-family"), []);
});

test("<Misconception> 內沒有分隔線回報 lesson-misconception-shape", () => {
  const [issue, ...rest] = componentIssues("cm-mis-none");
  assert.equal(rest.length, 0);
  assert.equal(issue.code, "lesson-misconception-shape");
  assert.equal(issue.level, "error");
  assert.match(issue.message, /恰有一條分隔線/);
  assert.match(issue.message, /misconception-none\.mdx/);
});

test("<Misconception> 內有兩條分隔線回報 lesson-misconception-shape；恰有一條合格", () => {
  const [issue, ...rest] = componentIssues("cm-mis-two");
  assert.equal(rest.length, 0);
  assert.equal(issue.code, "lesson-misconception-shape");
  assert.match(issue.message, /2 條/);
  assert.deepEqual(componentIssues("cm-ok").filter((i) => i.code === "lesson-misconception-shape"), []);
});

test("<Misconception> 內巢狀的分隔線（例如引用裡的 ---）回報 lesson-misconception-shape", () => {
  const [issue, ...rest] = componentIssues("cm-mis-nested");
  assert.equal(rest.length, 0);
  assert.equal(issue.code, "lesson-misconception-shape");
  assert.equal(issue.level, "error");
  assert.match(issue.message, /巢狀/);
});

// ---- 規則 4：教具檔 ----

const figureIssues = (unit, code) => issuesOf("figures", unit, code);

test("教具的 svg 缺 <title> 回報 figure-title-missing，指出檔案與單元", () => {
  const [issue, ...rest] = figureIssues("fg-no-title", "figure-title-missing");
  assert.equal(issue?.level, "error");
  assert.equal(rest.length, 0);
  assert.match(issue.message, /NoTitleFigure\.astro/);
  assert.deepEqual(figureIssues("fg-no-title", "figure-desc-missing"), []);
});

test("教具的 svg 缺 <desc> 回報 figure-desc-missing", () => {
  const [issue, ...rest] = figureIssues("fg-no-desc", "figure-desc-missing");
  assert.equal(issue?.level, "error");
  assert.equal(rest.length, 0);
  assert.match(issue.message, /NoDescFigure\.astro/);
  assert.deepEqual(figureIssues("fg-no-desc", "figure-title-missing"), []);
});

test("沒有任何教材 import 的教具檔也會檢查（不帶 unitId）", () => {
  const issues = loadContent(fixtureRoot("figures")).issues.filter((i) => /OrphanFigure\.astro/.test(i.message));
  assert.deepEqual(issues.map((i) => i.code), ["figure-title-missing"]);
  assert.equal(issues[0].unitId, undefined);
});

test("屬性與行內 style 寫死 hex（3/4/6/8 位、大小寫）回報 figure-color-not-token", () => {
  const issues = figureIssues("fg-hex-attr", "figure-color-not-token");
  assert.equal(issues.length, 5);
  assert.ok(issues.every((i) => i.level === "error"));
  const text = messagesOf(issues);
  for (const hex of ["#fff", "#1A2b3C", "#abcd", "#12345678", "#f00"]) assert.ok(text.includes(hex), hex);
});

test("<style> 區塊寫死 hex 回報 figure-color-not-token，註解與 url(#id) 不算", () => {
  const issues = figureIssues("fg-hex-style", "figure-color-not-token");
  assert.equal(issues.length, 2);
  const text = messagesOf(issues);
  assert.ok(text.includes("#e63946"));
  assert.ok(text.includes("var(--accent, #333)"), "var() 帶 hex fallback 違規");
  assert.ok(!text.includes("#000"));
  assert.ok(!text.includes("#ring"));
});

test("巢狀 CSS 與 @media 內的顏色宣告也會檢查（red、rgb() 違規，var(--accent) 合格）", () => {
  const issues = figureIssues("fg-nested", "figure-color-not-token");
  assert.equal(issues.length, 2);
  const text = messagesOf(issues);
  assert.ok(text.includes("red"));
  assert.ok(text.includes("rgb(1, 2, 3)"));
  assert.ok(!text.includes("var(--accent)"));
});

test("顏色名稱與 rgb()、hsl() 違規；none、transparent、inherit 合格", () => {
  const issues = figureIssues("fg-names", "figure-color-not-token");
  assert.equal(issues.length, 3);
  const text = messagesOf(issues);
  for (const value of ["red", "rgb(0, 0, 0)", "hsl(0 0% 0%)"]) assert.ok(text.includes(value), value);
});

test("教具 script 裡的 hex 色碼字串常值違規，其他字串不算", () => {
  const issues = figureIssues("fg-script", "figure-color-not-token");
  assert.equal(issues.length, 1);
  assert.match(issues[0].message, /#f00/);
  assert.match(issues[0].message, /ScriptFigure\.astro/);
});

test("title/desc 齊全且只用 currentColor、CSS 變數、url(#id) 與 id 選擇器的教具合格", () => {
  assert.deepEqual(errorsOf("figures", "fg-ok"), []);
});

// ---- 規則 5：篇幅（warning，不擋）----

const lengthIssues = (unit) => issuesOf("length", unit, "lesson-length-out-of-range");

test("字數在範圍內沒有篇幅提醒（一般篇與親子篇）", () => {
  for (const unit of ["ln-ok", "ln-family-ok", "ln-answer-not-counted"]) assert.deepEqual(lengthIssues(unit), [], unit);
});

test("一般篇過短與過長各出 warning，訊息寫出實際字數與範圍", () => {
  const [short, ...r1] = lengthIssues("ln-short");
  assert.equal(short?.level, "warning");
  assert.equal(r1.length, 0);
  assert.match(short.message, /字數 \d+/);
  assert.match(short.message, /2,000–3,500/);
  assert.match(short.message, /過短/);
  const [long] = lengthIssues("ln-long");
  assert.equal(long?.level, "warning");
  assert.match(long.message, /2,000–3,500/);
  assert.match(long.message, /過長/);
});

test("親子篇用 2,500–4,000 的範圍：2,331 字對親子篇過短，對一般篇範圍則合格", () => {
  const [short] = lengthIssues("ln-family-short");
  assert.equal(short?.level, "warning");
  assert.match(short.message, /字數 2331/);
  assert.match(short.message, /2,500–4,000/);
  const [long] = lengthIssues("ln-family-long");
  assert.match(long.message, /過長/);
});

test("<Answer> 內的字不計：本文合格、連解析會超標的教材沒有提醒；本文過短、連解析會合格的教材仍有提醒", () => {
  assert.deepEqual(lengthIssues("ln-answer-not-counted"), []);
  const [issue] = lengthIssues("ln-answer-not-padding");
  assert.match(issue.message, /過短/);
});

test("字數 = 漢字 + 拉丁單字 + 數字串，不含數學式、import、<Answer>", () => {
  // 9 個 H2 標題共 24 個漢字；9 段內文各「甲乙 ab 12」= 4；式子、import 與 <Answer> 內的字不計。
  const [issue] = lengthIssues("ln-count");
  assert.match(issue.message, /字數 60（/);
});

test("篇幅提醒不擋：只有 warning 時 ok 仍為 true", () => {
  assert.equal(loadContent(fixtureRoot("length")).issues.filter((i) => i.level === "error").length, 0);
  assert.equal(loadContent(fixtureRoot("length")).ok, true);
});
