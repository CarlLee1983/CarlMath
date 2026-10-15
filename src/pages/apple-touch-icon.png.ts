import { Resvg } from "@resvg/resvg-js";
import type { APIRoute } from "astro";
import faviconSvg from "../../public/favicon.svg?raw";

// apple-touch-icon 在 build 時由 public/favicon.svg 轉出，圖案只維護一份。
// iOS 自己會套圓角遮罩，所以用苔綠鋪滿四角（SVG 的圓角外是透明，會變黑）。
const SIZE = 180;
const MOSS = "#4f6238";

export const GET: APIRoute = () => {
  const png = new Resvg(faviconSvg, { fitTo: { mode: "width", value: SIZE }, background: MOSS }).render().asPng();
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
};
