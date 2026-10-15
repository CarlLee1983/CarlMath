import { allUnits, type CourseMap, type Stage, type Unit } from "./course-map-model.ts";

/**
 * 「下一步」清單：
 * - `next`：只預告下一個單元（最後一個單元時 units 為空）
 * - `dependents`：下一個單元不依賴本單元，列出全部直接反向依賴
 */
export interface NextStep {
  kind: "next" | "dependents";
  units: Unit[];
}

export interface CourseIndex {
  /** 建議閱讀順序的全部單元 */
  readonly units: readonly Unit[];
  /** 全站序號，從 1 起 */
  sequenceOf(unitId: string): number;
  stageOf(unitId: string): Stage;
  previous(unitId: string): Unit | null;
  next(unitId: string): Unit | null;
  prerequisites(unitId: string): Unit[];
  /** 遞移先修，依建議閱讀順序，不含自己 */
  transitivePrerequisites(unitId: string): Unit[];
  /** 直接反向依賴，依建議閱讀順序 */
  dependents(unitId: string): Unit[];
  /** 課綱年級的最小到最大 */
  gradeRange(unitId: string): { min: number; max: number };
  isWritten(unitId: string): boolean;
  nextStep(unitId: string): NextStep;
}

/** 由（已通過驗證的）課程地圖建立查詢物件；`writtenUnitIds` 是已有教材檔的單元 id。查詢不存在的單元會丟出錯誤。 */
export function createCourseIndex(courseMap: CourseMap, writtenUnitIds: Iterable<string>): CourseIndex {
  const units = allUnits(courseMap);
  const position = new Map(units.map((unit, index) => [unit.id, index]));
  const stageById = new Map(courseMap.stages.flatMap((stage) => stage.units.map((unit) => [unit.id, stage] as const)));
  const written = new Set(writtenUnitIds);

  const positionOf = (unitId: string): number => {
    const index = position.get(unitId);
    if (index === undefined) throw new Error(`課程地圖沒有單元「${unitId}」`);
    return index;
  };
  const assertKnown = (unitId: string): void => void positionOf(unitId);
  const byId = (unitId: string): Unit => units[positionOf(unitId)]!;
  const directDependents = (unitId: string) => units.filter((unit) => unit.prerequisites.includes(unitId));
  const next = (unitId: string) => units[positionOf(unitId) + 1] ?? null;

  return {
    units,
    sequenceOf: (unitId) => positionOf(unitId) + 1,
    stageOf(unitId) {
      assertKnown(unitId);
      return stageById.get(unitId)!;
    },
    previous: (unitId) => units[positionOf(unitId) - 1] ?? null,
    next,
    prerequisites: (unitId) => byId(unitId).prerequisites.map(byId),
    transitivePrerequisites(unitId) {
      const reached = new Set<string>();
      const walk = (id: string) => {
        for (const prerequisite of byId(id).prerequisites) {
          if (!reached.has(prerequisite)) {
            reached.add(prerequisite);
            walk(prerequisite);
          }
        }
      };
      walk(unitId);
      return units.filter((unit) => reached.has(unit.id));
    },
    dependents(unitId) {
      assertKnown(unitId);
      return directDependents(unitId);
    },
    gradeRange(unitId) {
      const { grades } = byId(unitId).curriculum108;
      return { min: Math.min(...grades), max: Math.max(...grades) };
    },
    isWritten(unitId) {
      assertKnown(unitId);
      return written.has(unitId);
    },
    nextStep(unitId) {
      const following = next(unitId);
      const direct = directDependents(unitId);
      if (following && !following.prerequisites.includes(unitId) && direct.length > 0) {
        return { kind: "dependents", units: direct };
      }
      return { kind: "next", units: following ? [following] : [] };
    },
  };
}

/** 建議閱讀順序中第一個親子共學單元；沒有時回傳 undefined。 */
export function firstFamilyUnit(index: CourseIndex): Unit | undefined {
  return index.units.find((unit) => unit.family);
}
