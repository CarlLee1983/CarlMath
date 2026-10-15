import { createHash } from "node:crypto";

/** 共用教具的替代文字檢查：title 必填且不超過 10 個字元，desc 必填（docs/figure-guide.md「替代文字」）。 */
export function assertAltText(component: string, title: unknown, desc: unknown): void {
  if (typeof title !== "string" || title.trim() === "") throw new Error(`<${component}> 必須有 title`);
  if ([...title].length > 10) throw new Error(`<${component}> 的 title 最多 10 個字元：${title}`);
  if (typeof desc !== "string" || desc.trim() === "") throw new Error(`<${component}> 必須有 desc`);
}

/** 圖內 id 的前綴：由參數雜湊而來，同樣的參數每次 build 都得到同樣的輸出。 */
export function figureIdPrefix(tag: string, props: object): string {
  return `${tag}-${createHash("sha1").update(JSON.stringify(props)).digest("hex").slice(0, 8)}`;
}
