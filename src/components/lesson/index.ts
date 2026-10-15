import Activity from "./Activity.astro";
import Answer from "./Answer.astro";
import Figure from "./Figure.astro";
import Misconception from "./Misconception.astro";
import ParentNote from "./ParentNote.astro";
import SkipCheck from "./SkipCheck.astro";

/**
 * 全部教材共用的 MDX 元件對應；閱讀頁以 `<Content components={...} />` 傳入，教材不必 import。
 */
export const lessonComponents = { Activity, Answer, Figure, Misconception, ParentNote, SkipCheck };
