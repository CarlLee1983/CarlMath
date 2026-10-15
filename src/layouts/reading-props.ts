import type { UnitLink } from "../components/UnitLinks.astro";

/** 兩種閱讀版面（側欄目錄、分段步進）共用的 props；單元頁一律傳這一組。 */
export interface ReadingProps {
  title: string;
  description: string;
  unit: { id: string; title: string; coreQuestion: string };
  stageTitle: string;
  /** 全部遞移先修，依建議閱讀順序 */
  suggested: UnitLink[];
  previous: UnitLink | null;
  next: UnitLink | null;
  nextStep: { kind: "next" | "dependents"; units: UnitLink[] };
}
