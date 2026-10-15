import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** 內容根目錄：環境變數 CARLMATH_CONTENT_DIR（相對於專案根目錄或絕對路徑），空值時用 `content`。 */
export function contentRoot(dir: string | undefined = process.env.CARLMATH_CONTENT_DIR): string {
  return resolve(dir || "content");
}

/**
 * 內容集合 glob loader 的 base：內容根目錄下的 `subdir`。
 * 絕對路徑要轉成檔案 URL，否則會被當成相對路徑，靜默產出空站。
 */
export function contentLoaderBase(dir: string | undefined, subdir: string): URL {
  return pathToFileURL(resolve(contentRoot(dir), subdir));
}
