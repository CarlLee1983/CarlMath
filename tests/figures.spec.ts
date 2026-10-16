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

// 分數、小數、帶分數數線（fx-ratio fixture）：疊排分數是分子、分數線、分母三個元素，類別 sf-*。
test.describe("NumberLine 有理數", () => {
  const rationalPath = "/units/fx-ratio/";

  test("分數數線：整數刻度只寫整數，分數疊排且不約分（2/4 不寫成 1/2）", async ({ page }) => {
    await page.goto(rationalPath);
    const svg = figure(page, "四等分數線");
    expect(await texts(svg.locator(".nl-num"))).toEqual(["0", "1"]);
    expect(await texts(svg.locator(".sf-num"))).toEqual(["1", "2", "3"]);
    expect(await texts(svg.locator(".sf-den"))).toEqual(["4", "4", "4"]);
    expect(await svg.locator(".nl-tick").count()).toBe(5);
    expect(await svg.locator(".nl-point").count()).toBe(1);
    expect(await svg.locator(".nl-jump").count()).toBe(1);
    expect(await svg.locator(".nl-span").count()).toBe(1);
  });

  test("疊排結構：分子在分數線上、分母在下，與刻度同一個 x，各刻度的分數線等長", async ({ page }) => {
    await page.goto(rationalPath);
    const svg = figure(page, "四等分數線");
    const ticks = nums(await attrs(svg.locator(".nl-tick"), "x1"));
    const groups = await svg.locator(".sf").evaluateAll((els) =>
      els.map((g) => {
        const n = (sel: string, name: string) => Number(g.querySelector(sel)!.getAttribute(name));
        return {
          numX: n(".sf-num", "x"),
          numY: n(".sf-num", "y"),
          denX: n(".sf-den", "x"),
          denY: n(".sf-den", "y"),
          barY: n(".sf-bar", "y1"),
          barMid: (n(".sf-bar", "x1") + n(".sf-bar", "x2")) / 2,
          barLen: n(".sf-bar", "x2") - n(".sf-bar", "x1"),
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
    expect(await style(svg.locator(".sf-num"), "fontSize")).toBe("22px");
    expect(await style(svg.locator(".sf-den"), "fontSize")).toBe("22px");
    expect(await style(svg.locator(".sf-bar"), "strokeWidth")).toBe("2px");
    expect(await style(svg.locator(".nl-tick:not(.nl-tick-zero)"), "strokeWidth")).toBe("2px");
    expect(await texts(svg.locator(".nl-label"))).toEqual(["跳", "半條"]);
  });

  test("有疊排分數時，距離括號與標籤在分數下方，不重疊", async ({ page }) => {
    await page.goto(rationalPath);
    const svg = figure(page, "四等分數線");
    const fracBottom = await svg.locator(".sf").evaluateAll((els) => Math.max(...els.map((el) => (el as SVGGraphicsElement).getBBox().y + (el as SVGGraphicsElement).getBBox().height)));
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
    expect(await svg.locator(".sf").count()).toBe(0);
    const point = Number(await svg.locator(".nl-point").getAttribute("cx"));
    const ticks = nums(await attrs(svg.locator(".nl-tick"), "x1"));
    expect(point).toBeCloseTo(ticks[3]!, 5);
  });

  test("帶分數數線：大於 1 的分數寫成整數接疊排真分數；不開 mixed 則寫假分數", async ({ page }) => {
    await page.goto(rationalPath);
    const mixed = figure(page, "帶分數數線");
    expect(await texts(mixed.locator(".nl-num"))).toEqual(["0", "1", "2"]);
    expect(await texts(mixed.locator(".sf-whole"))).toEqual(["1"]);
    expect(await texts(mixed.locator(".sf-num"))).toEqual(["1", "1"]);
    expect(await texts(mixed.locator(".sf-den"))).toEqual(["2", "2"]);
    const whole = Number(await mixed.locator(".sf-whole").getAttribute("x"));
    const bar = await mixed.locator(".sf").nth(1).locator(".sf-bar").evaluate((el) => Number(el.getAttribute("x1")));
    expect(whole).toBeLessThan(bar);
    const improper = figure(page, "假分數數線");
    expect(await texts(improper.locator(".sf-num"))).toEqual(["1", "3"]);
    expect(await improper.locator(".sf-whole").count()).toBe(0);
  });

  test("超過 10 段的分數數線只標整數、兩端點與 points", async ({ page }) => {
    await page.goto(rationalPath);
    const svg = figure(page, "分成八分之一");
    expect(await svg.locator(".nl-tick").count()).toBe(25);
    expect(await texts(svg.locator(".nl-num"))).toEqual(["0", "1", "2", "3"]);
    expect(await texts(svg.locator(".sf-num"))).toEqual(["5"]);
    expect(await texts(svg.locator(".sf-den"))).toEqual(["8"]);
  });

  test("labelEvery 可寫分數：每二分之一標一次，分母仍沿用刻度的 4", async ({ page }) => {
    await page.goto(rationalPath);
    const svg = figure(page, "每半個標");
    expect(await texts(svg.locator(".nl-num"))).toEqual(["0", "1", "2"]);
    expect(await texts(svg.locator(".sf-num"))).toEqual(["2", "6"]);
    expect(await texts(svg.locator(".sf-den"))).toEqual(["4", "4"]);
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
      expect(await svg.locator(".sf-num").first().evaluate((el) => getComputedStyle(el).fill)).toBe(fg);
      expect(await svg.locator(".sf-den").first().evaluate((el) => getComputedStyle(el).fill)).toBe(fg);
      expect(await svg.locator(".sf-whole").first().evaluate((el) => getComputedStyle(el).fill)).toBe(fg);
      expect(await svg.locator(".sf-bar").first().evaluate((el) => getComputedStyle(el).stroke)).toBe(fg);
      seen.push(fg);
    }
    expect(seen[0]).not.toBe(seen[1]);
  });
});

// 分數條 FractionBar（fx-ratio fixture）：塗色的份實心 --accent，沒塗的份只有框線；右側標籤與數線共用疊排分數（類別 sf-*）。
test.describe("FractionBar", () => {
  const barPath = "/units/fx-ratio/";

  test("單條：parts 份等分，從左邊連續塗滿 shaded 份，沒有標籤", async ({ page }) => {
    await page.goto(barPath);
    const svg = figure(page, "單條分數條");
    expect(await svg.locator(".fb-bar").count()).toBe(1);
    expect(await svg.locator(".fb-part").count()).toBe(3);
    expect(await svg.locator(".fb-part-shaded").count()).toBe(2);
    expect(await svg.locator(".fb-divider").count()).toBe(2);
    const classes = await svg.locator(".fb-part").evaluateAll((els) => els.map((el) => el.classList.contains("fb-part-shaded")));
    expect(classes).toEqual([true, true, false]);
    expect(await svg.locator(".sf, .fb-num").count()).toBe(0);
    // 沒有標籤時，條的左右端是數線的 from、to（寬 480、左右各留 28）
    const outline = svg.locator(".fb-outline");
    expect(Number(await outline.getAttribute("x"))).toBe(28);
    expect(Number(await outline.getAttribute("x")) + Number(await outline.getAttribute("width"))).toBe(452);
  });

  test("多條：條數、各自的份數與塗色數、長度相同，有標籤時條縮短騰出右側", async ({ page }) => {
    await page.goto(barPath);
    const svg = figure(page, "三條一樣長");
    const bars = svg.locator(".fb-bar");
    expect(await bars.count()).toBe(3);
    expect(await bars.evaluateAll((els) => els.map((el) => el.querySelectorAll(".fb-part").length))).toEqual([2, 4, 8]);
    expect(await bars.evaluateAll((els) => els.map((el) => el.querySelectorAll(".fb-part-shaded").length))).toEqual([1, 2, 4]);
    const outlines = await svg.locator(".fb-outline").evaluateAll((els) => els.map((el) => [el.getAttribute("x"), el.getAttribute("width")]));
    expect(new Set(outlines.map((o) => o.join())).size).toBe(1);
    expect(Number(outlines[0]![0]) + Number(outlines[0]![1])).toBeLessThan(452);
    // 標籤是疊排分數，不約分
    expect(await texts(svg.locator(".sf-num"))).toEqual(["1", "2", "4"]);
    expect(await texts(svg.locator(".sf-den"))).toEqual(["2", "4", "8"]);
    // 分數線與該條的中線同高，分子在上、分母在下
    const rows = await bars.evaluateAll((els) =>
      els.map((el) => {
        const n = (sel: string, name: string) => Number(el.querySelector(sel)!.getAttribute(name));
        return { mid: n(".fb-outline", "y") + n(".fb-outline", "height") / 2, barY: n(".sf-bar", "y1"), numY: n(".sf-num", "y"), denY: n(".sf-den", "y") };
      }),
    );
    for (const r of rows) {
      expect(r.barY).toBeCloseTo(r.mid, 5);
      expect(r.numY).toBeLessThan(r.barY);
      expect(r.barY).toBeLessThan(r.denY);
    }
  });

  test("整數標籤畫成純文字，不疊排", async ({ page }) => {
    await page.goto(barPath);
    const svg = figure(page, "整條是一");
    expect(await texts(svg.locator(".fb-num"))).toEqual(["1"]);
    expect(await svg.locator(".sf").count()).toBe(0);
    expect(await svg.locator(".fb-part-shaded").count()).toBe(1);
    expect(await svg.locator(".fb-divider").count()).toBe(0);
  });

  test("線寬與字級：外框 3、等分線 2、疊排分數線 2、標籤數字 22", async ({ page }) => {
    await page.goto(barPath);
    const style = (locator: Locator, prop: "fontSize" | "strokeWidth") => locator.first().evaluate((el, p) => getComputedStyle(el)[p], prop);
    const bars = figure(page, "三條一樣長");
    expect(await style(bars.locator(".fb-outline"), "strokeWidth")).toBe("3px");
    expect(await style(bars.locator(".fb-divider"), "strokeWidth")).toBe("2px");
    expect(await style(bars.locator(".sf-bar"), "strokeWidth")).toBe("2px");
    expect(await style(bars.locator(".sf-num"), "fontSize")).toBe("22px");
    expect(await style(figure(page, "整條是一").locator(".fb-num"), "fontSize")).toBe("22px");
  });

  test("標籤與數線的疊排分數是同一種畫法：同類別、字級與分數線寬一樣", async ({ page }) => {
    await page.goto(barPath);
    const read = (locator: Locator) =>
      locator.first().evaluate((el) => {
        const cs = getComputedStyle(el);
        return [el.tagName, cs.fontSize, cs.strokeWidth, cs.fill, cs.stroke, cs.textAnchor].join("|");
      });
    for (const part of [".sf-num", ".sf-den", ".sf-bar"]) {
      expect(await read(figure(page, "三條一樣長").locator(part))).toBe(await read(figure(page, "帶分數數線").locator(part)));
    }
  });

  test("與 0 到 1 的數線對齊：條的左右端與等分線的 x 等於數線的刻度 x（viewBox 與畫面）", async ({ page }) => {
    await page.goto(barPath);
    const bar = figure(page, "對齊的分數條");
    const line = figure(page, "對齊的數線");
    const ticks = nums(await attrs(line.locator(".nl-tick"), "x1"));
    expect(ticks).toHaveLength(5);
    const outlineX = Number(await bar.locator(".fb-outline").getAttribute("x"));
    const outlineW = Number(await bar.locator(".fb-outline").getAttribute("width"));
    expect(outlineX).toBeCloseTo(ticks[0]!, 5);
    expect(outlineX + outlineW).toBeCloseTo(ticks[4]!, 5);
    expect(nums(await attrs(bar.locator(".fb-divider"), "x1"))).toEqual(ticks.slice(1, 4).map((t) => expect.closeTo(t, 5)));
    // 畫面上也對齊：兩張圖寬度相同，等分線的螢幕 x 與刻度的螢幕 x 相同
    const screenX = (locator: Locator) => locator.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().x + el.getBoundingClientRect().width / 2));
    const [dividers, tickXs] = [await screenX(bar.locator(".fb-divider")), (await screenX(line.locator(".nl-tick"))).slice(1, 4)];
    dividers.forEach((x, i) => expect(x).toBeCloseTo(tickXs[i]!, 0));
  });

  test("320px 下頁面沒有水平捲軸，每張分數條都在視窗內", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "narrow", "只在 320px 專案驗證");
    await page.goto(barPath);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    const rights = await page.locator("svg.fb-fig").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    expect(rights).toHaveLength(4);
    for (const right of rights) expect(right).toBeLessThanOrEqual(320);
  });

  test("主題切換：塗色的份用 --accent，外框用 --fg，沒塗的份不填色，淺色與深色各自隨主題切換", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "以 emulateMedia 切換淺深色，只跑一次");
    await page.goto(barPath);
    const svg = figure(page, "單條分數條");
    const token = (name: string) =>
      page.evaluate((n) => {
        const probe = document.createElement("div");
        document.body.append(probe);
        probe.style.color = `var(${n})`;
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }, name);
    const computed = (locator: Locator, prop: "stroke" | "fill") => locator.first().evaluate((el, p) => getComputedStyle(el)[p], prop);
    const seen: string[] = [];
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const [fg, accent] = [await token("--fg"), await token("--accent")];
      expect(await computed(svg.locator(".fb-part-shaded"), "fill")).toBe(accent);
      expect(await computed(svg.locator(".fb-part:not(.fb-part-shaded)"), "fill")).toBe("none");
      expect(await computed(svg.locator(".fb-outline"), "stroke")).toBe(fg);
      expect(await computed(figure(page, "三條一樣長").locator(".sf-num"), "fill")).toBe(fg);
      seen.push(accent);
    }
    expect(seen[0]).not.toBe(seen[1]);
  });
});

// 單位方格 UnitGrid（math-demo fixture）：塗色的格實心 --accent，沒塗的格只有格線；周長外框沿塗色區的實際邊界，用主線。
test.describe("UnitGrid", () => {
  const gridPath = "/units/math-demo/";

  test("長方形塗色：格數、塗色格數與格數標籤，沒有外框", async ({ page }) => {
    await page.goto(gridPath);
    const svg = figure(page, "長方形塗色");
    expect(await svg.locator(".ug-cell").count()).toBe(20);
    expect(await svg.locator(".ug-cell-shaded").count()).toBe(6);
    const shaded = await svg.locator(".ug-cell").evaluateAll((els) => els.map((el) => el.classList.contains("ug-cell-shaded")));
    // 4 列 × 5 行，左上 2 列 × 3 行塗色
    const expected = Array.from({ length: 20 }, (_, k) => Math.floor(k / 5) < 2 && k % 5 < 3);
    expect(shaded).toEqual(expected);
    expect(await svg.locator(".ug-outline").count()).toBe(0);
    expect(await texts(svg.locator(".ug-num"))).toEqual(["3", "2"]);
  });

  test("不規則塗色加周長外框：外框一條路徑，總長 12 個單位邊（一格 32），文字標籤字級 20", async ({ page }) => {
    await page.goto(gridPath);
    const svg = figure(page, "不規則周長");
    expect(await svg.locator(".ug-cell").count()).toBe(16);
    expect(await svg.locator(".ug-cell-shaded").count()).toBe(5);
    expect(await svg.locator(".ug-outline").count()).toBe(1);
    const d = (await svg.locator(".ug-outline").getAttribute("d"))!;
    const runs = [...d.matchAll(/M([\d.]+) ([\d.]+)L([\d.]+) ([\d.]+)/g)].map((m) => m.slice(1).map(Number) as [number, number, number, number]);
    expect(runs).toHaveLength(6);
    const length = runs.reduce((sum, [x1, y1, x2, y2]) => sum + Math.abs(x2 - x1) + Math.abs(y2 - y1), 0);
    expect(length / 32).toBe(12);
    expect(await texts(svg.locator(".ug-label"))).toEqual(["周長"]);
    expect(await svg.locator(".ug-label").evaluate((el) => getComputedStyle(el).fontSize)).toBe("20px");
    expect(await svg.locator(".ug-num").evaluate((el) => getComputedStyle(el).fontSize)).toBe("22px");
  });

  test("線寬：外框 3、格線 2", async ({ page }) => {
    await page.goto(gridPath);
    const svg = figure(page, "不規則周長");
    expect(await svg.locator(".ug-outline").evaluate((el) => getComputedStyle(el).strokeWidth)).toBe("3px");
    expect(await svg.locator(".ug-cell").first().evaluate((el) => getComputedStyle(el).strokeWidth)).toBe("2px");
  });

  test("320px 下頁面沒有水平捲軸，每張方格都在視窗內", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "narrow", "只在 320px 專案驗證");
    await page.goto(gridPath);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    const rights = await page.locator("svg.ug-fig").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    expect(rights).toHaveLength(2);
    for (const right of rights) expect(right).toBeLessThanOrEqual(320);
  });

  test("主題切換：塗色的格用 --accent，沒塗的格不填色，格線 --muted，外框 --fg，淺色與深色各自隨主題切換", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "以 emulateMedia 切換淺深色，只跑一次");
    await page.goto(gridPath);
    const svg = figure(page, "不規則周長");
    const token = (name: string) =>
      page.evaluate((n) => {
        const probe = document.createElement("div");
        document.body.append(probe);
        probe.style.color = `var(${n})`;
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }, name);
    const computed = (locator: Locator, prop: "stroke" | "fill") => locator.first().evaluate((el, p) => getComputedStyle(el)[p], prop);
    const seen: string[] = [];
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const [fg, muted, accent] = [await token("--fg"), await token("--muted"), await token("--accent")];
      expect(await computed(svg.locator(".ug-cell-shaded"), "fill")).toBe(accent);
      expect(await computed(svg.locator(".ug-cell:not(.ug-cell-shaded)"), "fill")).toBe("none");
      expect(await computed(svg.locator(".ug-cell"), "stroke")).toBe(muted);
      expect(await computed(svg.locator(".ug-outline"), "stroke")).toBe(fg);
      expect(await computed(svg.locator(".ug-label"), "fill")).toBe(fg);
      seen.push(accent);
    }
    expect(seen[0]).not.toBe(seen[1]);
  });
});

// 平面圖形 Shape（fx-ratio fixture，ADR 0003）：外框是主線，輔助線虛線，角弧用 --accent，數字 22、文字標籤 20。
test.describe("Shape", () => {
  const shapePath = "/units/fx-ratio/";
  const style = (locator: Locator, prop: "fontSize" | "strokeWidth" | "strokeDasharray" | "fillOpacity") => locator.first().evaluate((el, p) => getComputedStyle(el)[p], prop);

  test("三角形：頂點字母、度數與「?」、直角記號取代角弧、等邊記號、虛線的高", async ({ page }) => {
    await page.goto(shapePath);
    const svg = figure(page, "直角等腰三角形");
    expect(await svg.getAttribute("viewBox")).toMatch(/^0 0 480 /);
    expect(await texts(svg.locator(".sh-letter"))).toEqual(["A", "B", "C"]);
    expect(await texts(svg.locator(".sh-num:not(.sh-letter)"))).toEqual(["4", "45°", "?"]);
    expect(await texts(svg.locator(".sh-label"))).toEqual(["高"]);
    expect(await svg.locator("polyline.sh-arc").count()).toBe(1);
    expect(await svg.locator("path.sh-arc").count()).toBe(2);
    expect(await svg.locator("line.sh-mark").count()).toBe(2);
    expect(await svg.locator(".sh-guide").count()).toBe(1);
    expect(await svg.locator("polygon.sh-outline").count()).toBe(1);
    expect(await svg.locator("polygon.sh-filled").count()).toBe(0);
  });

  test("線寬、字級、虛線：外框 3、角弧 2.5、記號與輔助線 2、數字 22、文字標籤 20、輔助線是虛線", async ({ page }) => {
    await page.goto(shapePath);
    const svg = figure(page, "直角等腰三角形");
    expect(await style(svg.locator(".sh-outline"), "strokeWidth")).toBe("3px");
    expect(await style(svg.locator(".sh-arc"), "strokeWidth")).toBe("2.5px");
    expect(await style(svg.locator(".sh-mark"), "strokeWidth")).toBe("2px");
    expect(await style(svg.locator(".sh-guide"), "strokeWidth")).toBe("2px");
    expect(await style(svg.locator(".sh-num"), "fontSize")).toBe("22px");
    expect(await style(svg.locator(".sh-label"), "fontSize")).toBe("20px");
    expect(await style(svg.locator(".sh-guide"), "strokeDasharray")).not.toBe("none");
    expect(await style(svg.locator(".sh-outline"), "strokeDasharray")).toBe("none");
  });

  test("平行四邊形：兩組對邊各有 1 個與 2 個平行箭頭，整塊塗色但外框仍是主線", async ({ page }) => {
    await page.goto(shapePath);
    const svg = figure(page, "平行四邊形");
    expect(await svg.locator("path.sh-mark").count()).toBe(6);
    expect(await svg.locator("polygon.sh-filled").count()).toBe(1);
    expect(await style(svg.locator("polygon.sh-filled"), "strokeWidth")).toBe("3px");
    expect(Number(await style(svg.locator("polygon.sh-filled"), "fillOpacity"))).toBeGreaterThan(0);
    expect(await texts(svg.locator(".sh-num"))).toEqual(["4"]);
  });

  test("虛線高的垂足有直角記號：小方框夾在虛線與底邊之間，用角弧的線型", async ({ page }) => {
    await page.goto(shapePath);
    const svg = figure(page, "平行四邊形");
    expect(await svg.locator(".sh-guide").count()).toBe(1);
    expect(await svg.locator("polyline.sh-arc").count()).toBe(1);
    const { guide, mark } = await svg.evaluate((el) => {
      const g = el.querySelector(".sh-guide")!;
      const pts = el.querySelector("polyline.sh-arc")!.getAttribute("points")!.split(" ").map((p) => p.split(",").map(Number));
      return { guide: ["x1", "y1", "x2", "y2"].map((n) => Number(g.getAttribute(n))), mark: pts };
    });
    // 方框的第一點是垂足（虛線的終點），第二點在虛線上、第四點在底邊上
    expect(mark).toHaveLength(4);
    expect(mark[0]![0]).toBeCloseTo(guide[2]!, 5);
    expect(mark[0]![1]).toBeCloseTo(guide[3]!, 5);
    expect(mark[1]![0]).toBeCloseTo(guide[2]!, 5);
    expect(mark[1]![1]).toBeLessThan(guide[3]!);
    expect(mark[3]![1]).toBeCloseTo(guide[3]!, 5);
    expect(mark[3]![0]).toBeGreaterThan(guide[2]!);
  });

  test("圓：半徑線段長等於圓的半徑，直徑線段長等於兩倍，都有圓心點", async ({ page }) => {
    await page.goto(shapePath);
    const svg = figure(page, "半徑與直徑");
    expect(await svg.locator("circle.sh-outline").count()).toBe(2);
    expect(await svg.locator(".sh-dot").count()).toBe(2);
    const radii = nums(await attrs(svg.locator("circle.sh-outline"), "r"));
    const lengths = await svg.locator("line.sh-outline").evaluateAll((els) =>
      els.map((el) => Math.abs(Number(el.getAttribute("x2")) - Number(el.getAttribute("x1")))),
    );
    expect(lengths).toHaveLength(2);
    expect(lengths[0]).toBeCloseTo(radii[0]!, 5);
    expect(lengths[1]).toBeCloseTo(2 * radii[1]!, 5);
    expect(await texts(svg.locator(".sh-num"))).toEqual(["2", "4"]);
  });

  test("320px 下頁面沒有水平捲軸，每張 Shape 都在視窗內", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "narrow", "只在 320px 專案驗證");
    await page.goto(shapePath);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    const rights = await page.locator("svg.sh-fig").evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
    expect(rights).toHaveLength(3);
    for (const right of rights) expect(right).toBeLessThanOrEqual(320);
  });

  test("主題切換：外框與數字用 --fg、輔助線用 --muted、角弧用 --accent、塗色用 --accent，淺色與深色各自隨主題切換", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "以 emulateMedia 切換淺深色，只跑一次");
    await page.goto(shapePath);
    const triangle = figure(page, "直角等腰三角形");
    const parallelogram = figure(page, "平行四邊形");
    const token = (name: string) =>
      page.evaluate((n) => {
        const probe = document.createElement("div");
        document.body.append(probe);
        probe.style.color = `var(${n})`;
        const color = getComputedStyle(probe).color;
        probe.remove();
        return color;
      }, name);
    const computed = (locator: Locator, prop: "stroke" | "fill") => locator.first().evaluate((el, p) => getComputedStyle(el)[p], prop);
    const seen: string[] = [];
    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const [fg, muted, accent] = [await token("--fg"), await token("--muted"), await token("--accent")];
      expect(await computed(triangle.locator(".sh-outline"), "stroke")).toBe(fg);
      expect(await computed(triangle.locator(".sh-num"), "fill")).toBe(fg);
      expect(await computed(triangle.locator(".sh-guide"), "stroke")).toBe(muted);
      expect(await computed(triangle.locator("path.sh-arc"), "stroke")).toBe(accent);
      expect(await computed(parallelogram.locator(".sh-filled"), "fill")).toBe(accent);
      seen.push(fg);
    }
    expect(seen[0]).not.toBe(seen[1]);
  });
});
