import { test, expect, type Locator, type Page } from "@playwright/test";

// 共用教具 NumberLine 與 Counters（ADR 0002、docs/figure-guide.md），以 sum-demo fixture 裡的教具驗證。
const path = "/units/sum-demo/";
// aria-labelledby 串接 title 與 desc，無障礙名稱是兩者相連；以圖內 <title> 的文字定位。
const figure = (page: Page, title: string) =>
  page.locator('svg[role="img"]').filter({ has: page.locator("title").getByText(title, { exact: true }) });

const attrs = (locator: Locator, name: string) => locator.evaluateAll((els, n) => els.map((el) => el.getAttribute(n)), name);
const texts = (locator: Locator) => locator.evaluateAll((els) => els.map((el) => el.textContent?.trim() ?? ""));
const nums = (values: (string | null)[]) => values.map(Number);

test.describe("共用結構", () => {
  test("每張教具都是 role=img，aria-labelledby 指向圖內的 title 與 desc，id 加前綴且不重複，只寫 viewBox", async ({ page }) => {
    await page.goto(path);
    const svgs = page.locator("figure.fig svg");
    expect(await svgs.count()).toBe(7);
    const report = await svgs.evaluateAll((els) =>
      els.map((svg) => {
        const ids = (svg.getAttribute("aria-labelledby") ?? "").split(/\s+/).filter(Boolean);
        return {
          role: svg.getAttribute("role"),
          labelledBy: ids.map((id) => document.getElementById(id)).map((el) => (el && svg.contains(el) ? el.tagName : null)),
          ids: [...svg.querySelectorAll("[id]")].map((el) => el.id),
          width: svg.getAttribute("width"),
          height: svg.getAttribute("height"),
          viewBoxWidth: Number(svg.getAttribute("viewBox")?.split(/\s+/)[2]),
        };
      }),
    );
    for (const svg of report) {
      expect(svg.role).toBe("img");
      expect(svg.labelledBy).toEqual(["title", "desc"]);
      for (const id of svg.ids) expect(id).toMatch(/^(nl|ct)-/);
      expect(svg.width).toBeNull();
      expect(svg.height).toBeNull();
      expect(svg.viewBoxWidth).toBe(480);
    }
    const allIds = report.flatMap((svg) => svg.ids);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  test("寬螢幕上顯示寬不超過 32rem", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "narrow", "窄螢幕另測");
    await page.goto(path);
    const box = await figure(page, "從 3 跳到 7").boundingBox();
    expect(box!.width).toBeLessThanOrEqual(32 * 16);
    expect(box!.width).toBeGreaterThan(400);
  });

  test("320px 寬沒有水平捲軸，教具不超出畫面", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "narrow", "只在 320px 驗證");
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    for (const box of await page.locator("figure.fig svg").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right))) {
      expect(box).toBeLessThanOrEqual(320);
    }
  });
});

test.describe("NumberLine", () => {
  test("10 段以內每格標數字，間隔等距，0 的刻度加粗", async ({ page }) => {
    await page.goto(path);
    const svg = figure(page, "從 3 跳到 7");
    expect(await texts(svg.locator(".nl-num"))).toEqual(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"]);
    const xs = nums(await attrs(svg.locator(".nl-tick"), "x1"));
    expect(xs).toHaveLength(11);
    const gaps = xs.slice(1).map((x, i) => x - xs[i]!);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 5);
    expect(await svg.locator(".nl-tick-zero").count()).toBe(1);
    expect(await svg.locator(".nl-tick-zero").getAttribute("x1")).toBe(String(xs[0]));
  });

  test("線寬與字級符合規範：主線 3、刻度 2、0 刻度加粗、跳躍弧 2.5、數字 22、標籤 20", async ({ page }) => {
    await page.goto(path);
    const svg = figure(page, "從 3 跳到 7");
    const width = (locator: Locator) => locator.first().evaluate((el) => getComputedStyle(el).strokeWidth);
    const size = (locator: Locator) => locator.first().evaluate((el) => getComputedStyle(el).fontSize);
    expect(await width(svg.locator(".nl-axis"))).toBe("3px");
    expect(await width(svg.locator(".nl-tick:not(.nl-tick-zero)"))).toBe("2px");
    expect(await width(svg.locator(".nl-tick-zero"))).toBe("3px");
    expect(await width(svg.locator(".nl-jump"))).toBe("2.5px");
    expect(await size(svg.locator(".nl-num"))).toBe("22px");
    expect(await size(svg.locator(".nl-label"))).toBe("20px");
    expect(await texts(svg.locator(".nl-label"))).toEqual(["+4", "4 格"]);
    expect(await svg.locator(".nl-point").count()).toBe(1);
    expect(await svg.locator(".nl-span").count()).toBe(1);
  });

  test("起點不是 step 的倍數時，10 段以內仍每格標數字", async ({ page }) => {
    await page.goto(path);
    expect(await texts(figure(page, "單數的數線").locator(".nl-num"))).toEqual(["1", "3", "5", "7", "9"]);
  });

  test("超過 10 段只標 0、每 5、終點與 points", async ({ page }) => {
    await page.goto(path);
    const svg = figure(page, "0 到 20 的數線");
    expect(await texts(svg.locator(".nl-num"))).toEqual(["0", "5", "7", "10", "15", "20"]);
    expect(await svg.locator(".nl-tick").count()).toBe(21);
  });
});

test.describe("Counters", () => {
  const centers = (svg: Locator) =>
    svg.locator(".ct-counter").evaluateAll((els) => els.map((el) => [Number(el.getAttribute("cx")), Number(el.getAttribute("cy"))]));

  test("row 排成一排；marked 的圓塗滿、其餘空心，不只靠顏色區分", async ({ page }) => {
    await page.goto(path);
    const svg = figure(page, "一排 7 顆");
    const points = await centers(svg);
    expect(points).toHaveLength(7);
    expect(new Set(points.map(([, y]) => y)).size).toBe(1);
    expect(await svg.locator(".ct-counter.ct-marked").count()).toBe(3);
    const fills = await svg.locator(".ct-counter").evaluateAll((els) => els.map((el) => getComputedStyle(el).fill));
    expect(fills.slice(3).every((f) => f === "none")).toBe(true);
    expect(fills.slice(0, 3).every((f) => f !== "none")).toBe(true);
  });

  test("grid 依 columns 換排", async ({ page }) => {
    await page.goto(path);
    const points = await centers(figure(page, "兩排 10 顆"));
    expect(points).toHaveLength(10);
    expect(new Set(points.map(([, y]) => y)).size).toBe(2);
    expect(new Set(points.map(([x]) => x)).size).toBe(5);
  });

  test("scatter 用固定 seed：同樣參數畫兩次位置相同，且圓點不重疊", async ({ page }) => {
    await page.goto(path);
    const [a, b] = [await centers(figure(page, "散開的 8 顆")), await centers(figure(page, "再畫一次 8 顆"))];
    expect(a).toHaveLength(8);
    expect(b).toEqual(a);
    const r = Number(await figure(page, "散開的 8 顆").locator(".ct-counter").first().getAttribute("r"));
    for (let i = 0; i < a.length; i++) {
      for (let j = i + 1; j < a.length; j++) {
        expect(Math.hypot(a[i]![0]! - a[j]![0]!, a[i]![1]! - a[j]![1]!)).toBeGreaterThanOrEqual(2 * r);
      }
    }
  });
});

test.describe("主題切換", () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "以 emulateMedia 切換淺深色，只跑一次");
  });

  // 以探針元素讀 token 的實際顏色，和教具元素的 computed 顏色比對
  const token = (page: Page, name: string) =>
    page.evaluate((n) => {
      const probe = document.createElement("div");
      document.body.append(probe);
      probe.style.color = `var(${n})`;
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    }, name);
  const computed = (locator: Locator, prop: "stroke" | "fill") => locator.first().evaluate((el, p) => getComputedStyle(el)[p], prop);

  test("數線主線用 --fg、點與跳躍弧用 --accent，圓點標記的用 --accent、其餘空心 --fg，淺色與深色各自隨主題切換", async ({ page }) => {
    await page.goto(path);
    const line = figure(page, "從 3 跳到 7");
    const counters = figure(page, "一排 7 顆");
    const seen: string[] = [];
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const [fg, accent] = [await token(page, "--fg"), await token(page, "--accent")];
      expect(await computed(line.locator(".nl-axis"), "stroke")).toBe(fg);
      expect(await computed(line.locator(".nl-point"), "fill")).toBe(accent);
      expect(await computed(line.locator(".nl-jump"), "stroke")).toBe(accent);
      expect(await computed(counters.locator(".ct-marked"), "fill")).toBe(accent);
      expect(await computed(counters.locator(".ct-counter:not(.ct-marked)"), "stroke")).toBe(fg);
      seen.push(fg);
    }
    expect(seen[0]).not.toBe(seen[1]);
  });
});

// 分數、小數、帶分數數線（fx-ratio fixture）：疊排分數是分子、分數線、分母三個元素，類別 nl-frac-*。
test.describe("NumberLine 有理數", () => {
  const rationalPath = "/units/fx-ratio/";

  test("分數數線：整數刻度只寫整數，分數疊排且不約分（2/4 不寫成 1/2）", async ({ page }) => {
    await page.goto(rationalPath);
    const svg = figure(page, "四等分數線");
    expect(await texts(svg.locator(".nl-num"))).toEqual(["0", "1"]);
    expect(await texts(svg.locator(".nl-frac-num"))).toEqual(["1", "2", "3"]);
    expect(await texts(svg.locator(".nl-frac-den"))).toEqual(["4", "4", "4"]);
    expect(await svg.locator(".nl-tick").count()).toBe(5);
    expect(await svg.locator(".nl-point").count()).toBe(1);
    expect(await svg.locator(".nl-jump").count()).toBe(1);
    expect(await svg.locator(".nl-span").count()).toBe(1);
  });

  test("疊排結構：分子在分數線上、分母在下，與刻度同一個 x，各刻度的分數線等長", async ({ page }) => {
    await page.goto(rationalPath);
    const svg = figure(page, "四等分數線");
    const ticks = nums(await attrs(svg.locator(".nl-tick"), "x1"));
    const groups = await svg.locator(".nl-frac").evaluateAll((els) =>
      els.map((g) => {
        const n = (sel: string, name: string) => Number(g.querySelector(sel)!.getAttribute(name));
        return {
          numX: n(".nl-frac-num", "x"),
          numY: n(".nl-frac-num", "y"),
          denX: n(".nl-frac-den", "x"),
          denY: n(".nl-frac-den", "y"),
          barY: n(".nl-frac-bar", "y1"),
          barMid: (n(".nl-frac-bar", "x1") + n(".nl-frac-bar", "x2")) / 2,
          barLen: n(".nl-frac-bar", "x2") - n(".nl-frac-bar", "x1"),
        };
      }),
    );
    expect(groups).toHaveLength(3);
    groups.forEach((g, i) => {
      expect(g.numY).toBeLessThan(g.barY);
      expect(g.barY).toBeLessThan(g.denY);
      expect(g.numX).toBeCloseTo(ticks[i + 1]!, 5);
      expect(g.denX).toBeCloseTo(ticks[i + 1]!, 5);
      expect(g.barMid).toBeCloseTo(ticks[i + 1]!, 5);
      expect(g.barLen).toBe(groups[0]!.barLen);
    });
  });

  test("疊排分數字級 22、分數線寬同刻度（2px）；文字標籤不計入刻度分數", async ({ page }) => {
    await page.goto(rationalPath);
    const svg = figure(page, "四等分數線");
    const style = (locator: Locator, prop: "fontSize" | "strokeWidth") => locator.first().evaluate((el, p) => getComputedStyle(el)[p], prop);
    expect(await style(svg.locator(".nl-frac-num"), "fontSize")).toBe("22px");
    expect(await style(svg.locator(".nl-frac-den"), "fontSize")).toBe("22px");
    expect(await style(svg.locator(".nl-frac-bar"), "strokeWidth")).toBe("2px");
    expect(await style(svg.locator(".nl-tick:not(.nl-tick-zero)"), "strokeWidth")).toBe("2px");
    expect(await texts(svg.locator(".nl-label"))).toEqual(["跳", "半條"]);
  });

  test("有疊排分數時，距離括號與標籤在分數下方，不重疊", async ({ page }) => {
    await page.goto(rationalPath);
    const svg = figure(page, "四等分數線");
    const fracBottom = await svg.locator(".nl-frac").evaluateAll((els) => Math.max(...els.map((el) => (el as SVGGraphicsElement).getBBox().y + (el as SVGGraphicsElement).getBBox().height)));
    const span = await svg.locator(".nl-span").evaluate((el) => (el as SVGGraphicsElement).getBBox().y);
    expect(span).toBeGreaterThan(fracBottom);
    const viewBoxHeight = (await svg.getAttribute("viewBox"))!.split(" ").map(Number)[3]!;
    const labelBottom = await svg.locator(".nl-label").last().evaluate((el) => (el as SVGGraphicsElement).getBBox().y + (el as SVGGraphicsElement).getBBox().height);
    expect(viewBoxHeight).toBeGreaterThanOrEqual(labelBottom);
  });

  test("小數數線：每格 0.1，照十進位寫，沒有疊排分數", async ({ page }) => {
    await page.goto(rationalPath);
    const svg = figure(page, "小數數線");
    expect(await texts(svg.locator(".nl-num"))).toEqual(["0", "0.1", "0.2", "0.3", "0.4", "0.5", "0.6", "0.7", "0.8", "0.9", "1"]);
    expect(await svg.locator(".nl-frac").count()).toBe(0);
    const point = Number(await svg.locator(".nl-point").getAttribute("cx"));
    const ticks = nums(await attrs(svg.locator(".nl-tick"), "x1"));
    expect(point).toBeCloseTo(ticks[3]!, 5);
  });

  test("帶分數數線：大於 1 的分數寫成整數接疊排真分數；不開 mixed 則寫假分數", async ({ page }) => {
    await page.goto(rationalPath);
    const mixed = figure(page, "帶分數數線");
    expect(await texts(mixed.locator(".nl-num"))).toEqual(["0", "1", "2"]);
    expect(await texts(mixed.locator(".nl-frac-whole"))).toEqual(["1"]);
    expect(await texts(mixed.locator(".nl-frac-num"))).toEqual(["1", "1"]);
    expect(await texts(mixed.locator(".nl-frac-den"))).toEqual(["2", "2"]);
    const whole = Number(await mixed.locator(".nl-frac-whole").getAttribute("x"));
    const bar = await mixed.locator(".nl-frac").nth(1).locator(".nl-frac-bar").evaluate((el) => Number(el.getAttribute("x1")));
    expect(whole).toBeLessThan(bar);
    const improper = figure(page, "假分數數線");
    expect(await texts(improper.locator(".nl-frac-num"))).toEqual(["1", "3"]);
    expect(await improper.locator(".nl-frac-whole").count()).toBe(0);
  });

  test("超過 10 段的分數數線只標整數、兩端點與 points", async ({ page }) => {
    await page.goto(rationalPath);
    const svg = figure(page, "分成八分之一");
    expect(await svg.locator(".nl-tick").count()).toBe(25);
    expect(await texts(svg.locator(".nl-num"))).toEqual(["0", "1", "2", "3"]);
    expect(await texts(svg.locator(".nl-frac-num"))).toEqual(["5"]);
    expect(await texts(svg.locator(".nl-frac-den"))).toEqual(["8"]);
  });

  test("labelEvery 可寫分數：每二分之一標一次，分母仍沿用刻度的 4", async ({ page }) => {
    await page.goto(rationalPath);
    const svg = figure(page, "每半個標");
    expect(await texts(svg.locator(".nl-num"))).toEqual(["0", "1", "2"]);
    expect(await texts(svg.locator(".nl-frac-num"))).toEqual(["2", "6"]);
    expect(await texts(svg.locator(".nl-frac-den"))).toEqual(["4", "4"]);
  });

  test("320px 下頁面沒有水平捲軸，每張有理數數線都在視窗內", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "narrow", "只在 320px 專案驗證");
    await page.goto(rationalPath);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    const widths = await page.locator("svg.nl-fig").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    for (const right of widths) expect(right).toBeLessThanOrEqual(320);
  });

  test("主題切換：分數與分數線用 --fg，淺色與深色各自隨主題切換", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "以 emulateMedia 切換淺深色，只跑一次");
    await page.goto(rationalPath);
    const svg = figure(page, "帶分數數線");
    const token = () =>
      page.evaluate(() => {
        const probe = document.createElement("div");
        document.body.append(probe);
        probe.style.color = "var(--fg)";
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      });
    const seen: string[] = [];
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const fg = await token();
      expect(await svg.locator(".nl-frac-num").first().evaluate((el) => getComputedStyle(el).fill)).toBe(fg);
      expect(await svg.locator(".nl-frac-den").first().evaluate((el) => getComputedStyle(el).fill)).toBe(fg);
      expect(await svg.locator(".nl-frac-whole").first().evaluate((el) => getComputedStyle(el).fill)).toBe(fg);
      expect(await svg.locator(".nl-frac-bar").first().evaluate((el) => getComputedStyle(el).stroke)).toBe(fg);
      seen.push(fg);
    }
    expect(seen[0]).not.toBe(seen[1]);
  });
});
