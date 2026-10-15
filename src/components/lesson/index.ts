import Answer from "./Answer.astro";
import Figure from "./Figure.astro";
import Misconception from "./Misconception.astro";
import SkipCheck from "./SkipCheck.astro";

/**
 * 全部教材共用的 MDX 元件對應；閱讀頁以 `<Content components={...} />` 傳入，教材不必 import。
 * `ParentNote`、`Activity` 由 07 票（親子篇版面）補進同一個對應表。
 */
export const lessonComponents = { Answer, Figure, Misconception, SkipCheck };
