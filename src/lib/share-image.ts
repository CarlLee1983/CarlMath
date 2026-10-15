import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

// 分享圖模組：「圖上要放的文字 → PNG 位元組與檔名」。build 時執行；
// 版面、字型載入、SVG 轉 PNG 與雜湊都封裝在這裡，呼叫端只給文字。

/** 改版面時加一，所有分享圖的檔名都會換，社群平台因此重抓。 */
export const TEMPLATE_VERSION = 1;
export const SHARE_IMAGE_WIDTH = 1200;
export const SHARE_IMAGE_HEIGHT = 630;

/** 圖上固定出現的網址文字（單元圖右下角），也納入雜湊。 */
const HOST_TEXT = "math.gravito.dev";
const BRAND_TEXT = "CarlMath";

const COLORS = { sand: "#ddd6c6", charcoal: "#2a2a26", moss: "#4f6238" };

/** 圖上要放的文字。有 `stage` 的是單元圖（左上階段名、右下品牌與網址），沒有的是預設圖。 */
export interface ShareCard {
  /** 檔名前綴：預設圖是 `default`，單元圖是單元 id */
  id: string;
  /** 階段名（單元圖） */
  stage?: string;
  /** 大字：單元標題；預設圖是 CarlMath */
  title: string;
  /** 下方一行：核心問題；預設圖是首頁標語 */
  question: string;
}

/** 圖上實際會出現的全部文字，雜湊的輸入。 */
function visibleTexts(card: ShareCard): string[] {
  const texts = [card.title, card.question];
  if (card.stage) texts.unshift(card.stage, BRAND_TEXT, HOST_TEXT);
  return texts;
}

/** 檔名：`<id>-<hash>.png`；hash 取自圖上全部文字與模板版本，相同輸入必得相同檔名。`templateVersion` 只供測試覆寫。 */
export function shareImageFileName(card: ShareCard, templateVersion: number = TEMPLATE_VERSION): string {
  const hash = createHash("sha256")
    .update(JSON.stringify([templateVersion, visibleTexts(card)]))
    .digest("hex")
    .slice(0, 10);
  return `${card.id}-${hash}.png`;
}

// ── 字型 ──────────────────────────────────────────────────────────────────
// @fontsource/noto-sans-tc 的 700 字重把字切成多個 woff2，由 unicode-range 標示涵蓋範圍。
// 只載入涵蓋圖上用字的切片；satori 對同名的多個字型會逐字往後找字。

const FONT_DIR = () => resolve("node_modules/@fontsource/noto-sans-tc");

interface FontSlice {
  file: string;
  ranges: [number, number][];
}

function parseSlices(css: string): FontSlice[] {
  return [...css.matchAll(/src:\s*url\(\.\/(files\/[^)]+?\.woff2)\)[^}]*?unicode-range:\s*([^;]+);/g)].map((m) => ({
    file: m[1],
    ranges: m[2].split(",").map((part) => {
      const [from, to = from] = part.trim().replace(/^U\+/i, "").split("-");
      return [parseInt(from, 16), parseInt(to.replace(/^U\+/i, ""), 16)] as [number, number];
    }),
  }));
}

function loadFonts(texts: string[]) {
  const dir = FONT_DIR();
  const slices = parseSlices(readFileSync(resolve(dir, "700.css"), "utf8"));
  const chars = new Set([...texts.join("")].filter((ch) => !/\s/.test(ch)));
  const used = new Map<string, FontSlice>();
  for (const ch of chars) {
    const code = ch.codePointAt(0)!;
    const slice = slices.find((s) => s.ranges.some(([from, to]) => code >= from && code <= to));
    if (!slice) throw new Error(`分享圖字型缺字：「${ch}」(U+${code.toString(16)}) 不在 Noto Sans TC 700 的任何切片內`);
    used.set(slice.file, slice);
  }
  return [...used.keys()].map((file) => ({
    name: `Noto Sans TC ${file}`,
    data: readFileSync(resolve(dir, file)),
    weight: 700 as const,
    style: "normal" as const,
  }));
}

// ── 版面 ──────────────────────────────────────────────────────────────────

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown): Node => ({
  type,
  props: { style: { display: "flex", ...style }, children },
});

/** 底部的細數線：一條苔綠橫線加上等距刻點。 */
function numberLine(): Node {
  const ticks = Array.from({ length: 13 }, (_, i) =>
    h("div", {
      position: "absolute",
      left: i * 88 - 1.5,
      top: i % 4 === 0 ? -14 : -8,
      width: 3,
      height: i % 4 === 0 ? 29 : 17,
      background: COLORS.moss,
    }),
  );
  return h("div", { position: "relative", width: 1056, height: 3, background: COLORS.moss }, ticks);
}

function layout(card: ShareCard): Node {
  const isUnit = Boolean(card.stage);
  const titleSize = isUnit ? 84 : 148;
  return h(
    "div",
    {
      flexDirection: "column",
      justifyContent: "space-between",
      width: SHARE_IMAGE_WIDTH,
      height: SHARE_IMAGE_HEIGHT,
      boxSizing: "border-box",
      padding: 72,
      background: COLORS.sand,
      color: COLORS.charcoal,
      fontFamily: "Noto Sans TC",
      fontWeight: 700,
    },
    [
      h("div", { fontSize: 34, color: COLORS.moss, height: 44 }, card.stage ?? ""),
      h("div", { flexDirection: "column" }, [
        h("div", { fontSize: titleSize, lineHeight: 1.15 }, card.title),
        h("div", { fontSize: 44, lineHeight: 1.4, marginTop: 20 }, card.question),
      ]),
      h("div", { flexDirection: "column", gap: 28 }, [
        numberLine(),
        h(
          "div",
          { justifyContent: "flex-end", fontSize: 30, height: 40, gap: 20 },
          isUnit ? [h("div", {}, BRAND_TEXT), h("div", { color: COLORS.moss }, HOST_TEXT)] : "",
        ),
      ]),
    ],
  );
}

/** 排版並轉成 PNG；回傳位元組與（含雜湊的）檔名。 */
export async function renderShareImage(card: ShareCard): Promise<{ fileName: string; png: Uint8Array }> {
  const svg = await satori(layout(card) as never, {
    width: SHARE_IMAGE_WIDTH,
    height: SHARE_IMAGE_HEIGHT,
    fonts: loadFonts(visibleTexts(card)),
  });
  const png = new Resvg(svg, { fitTo: { mode: "width", value: SHARE_IMAGE_WIDTH } }).render().asPng();
  return { fileName: shareImageFileName(card), png };
}
