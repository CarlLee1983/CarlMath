import type { UnitLink } from "../components/UnitLinks.astro";

/** 兩種閱讀版面（側欄目錄、分段步進）共用的 props；單元頁一律傳這一組。 */
export interface ReadingProps {
  title: string;
  description: string;
  /** 教材 frontmatter 的 updated（YYYY-MM-DD），作為 article:modified_time */
  modifiedTime?: string;
  /** 單元專屬分享圖，交給文件外殼 */
  image: { url: string; width: number; height: number; alt: string };
  unit: { id: string; title: string; coreQuestion: string };
  stageTitle: string;
  /** 全部遞移先修，依建議閱讀順序 */
  suggested: UnitLink[];
  previous: UnitLink | null;
  next: UnitLink | null;
  nextStep: { kind: "next" | "dependents"; units: UnitLink[] };
}
