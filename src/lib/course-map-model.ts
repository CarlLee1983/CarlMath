import { z } from "astro/zod";

export type IssueCode =
  | "invalid-yaml"
  | "missing-field"
  | "invalid-type"
  | "empty-grades"
  | "invalid-id"
  | "duplicate-id"
  | "prerequisite-missing"
  | "prerequisite-after"
  | "family-grade-out-of-range"
  | "empty-content-without-note";

export interface Issue {
  level: "error" | "warning";
  code: IssueCode;
  message: string;
  unitId?: string;
}

const curriculum108Schema = z.object({
  /** 課綱年級（1–12），非空 */
  grades: z.array(z.number().int()).min(1),
  /** 課綱學習內容代碼，可為空（超出 12 甲時以 note 說明） */
  content: z.array(z.string()),
  performance: z.array(z.string()).optional(),
  note: z.string().optional(),
});

const unitSchema = z.object({
  id: z.string(),
  title: z.string(),
  coreQuestion: z.string(),
  /** 只列直接先修 */
  prerequisites: z.array(z.string()),
  family: z.boolean(),
  curriculum108: curriculum108Schema,
});

const stageSchema = z.object({
  id: z.string(),
  title: z.string(),
  units: z.array(unitSchema),
});

/** 排列順序即建議閱讀順序 */
export const courseMapSchema = z.object({ stages: z.array(stageSchema) });

export type CourseMap = z.infer<typeof courseMapSchema>;
export type Stage = CourseMap["stages"][number];
export type Unit = Stage["units"][number];

/** 全部單元，依建議閱讀順序 */
export function allUnits(courseMap: CourseMap): Unit[] {
  return courseMap.stages.flatMap((stage) => stage.units);
}
