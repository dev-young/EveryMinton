import { LevelGrade, LevelSubGrade, LevelInfo } from "@/types";

// 등급별 점수 범위 정의
const LEVEL_RANGES: Record<LevelGrade, { min: number; max: number }> = {
  A: { min: 90, max: 100 },
  B: { min: 70, max: 89 },
  C: { min: 40, max: 69 },
  D: { min: 10, max: 39 },
  E: { min: 1, max: 9 },
};

// 세분화 퍼센트
const SUB_GRADE_PERCENT: Record<LevelSubGrade, number> = {
  하: 0.2,
  중: 0.5,
  상: 0.9,
};

/**
 * 등급 + 세분화로 내부 점수를 계산
 */
export function calculateScore(
  grade: LevelGrade,
  subGrade: LevelSubGrade
): number {
  const range = LEVEL_RANGES[grade];
  const size = range.max - range.min + 1;
  return range.min + Math.floor(size * SUB_GRADE_PERCENT[subGrade]);
}

/**
 * 내부 점수로 등급 정보를 역산
 */
export function scoreToLevelInfo(score: number): LevelInfo {
  let grade: LevelGrade = "E";

  for (const [g, range] of Object.entries(LEVEL_RANGES) as [
    LevelGrade,
    { min: number; max: number },
  ][]) {
    if (score >= range.min && score <= range.max) {
      grade = g;
      break;
    }
  }

  const range = LEVEL_RANGES[grade];
  const size = range.max - range.min + 1;
  const position = (score - range.min) / size;

  let subGrade: LevelSubGrade;
  if (position >= 0.7) {
    subGrade = "상";
  } else if (position >= 0.35) {
    subGrade = "중";
  } else {
    subGrade = "하";
  }

  return {
    grade,
    subGrade,
    score,
    display: `${grade}${subGrade}`,
  };
}

/**
 * 모든 가능한 등급 조합과 점수 목록
 */
export function getAllLevelOptions(): LevelInfo[] {
  const grades: LevelGrade[] = ["A", "B", "C", "D", "E"];
  const subGrades: LevelSubGrade[] = ["상", "중", "하"];
  const options: LevelInfo[] = [];

  for (const grade of grades) {
    for (const subGrade of subGrades) {
      const score = calculateScore(grade, subGrade);
      options.push({
        grade,
        subGrade,
        score,
        display: `${grade}${subGrade}`,
      });
    }
  }

  return options;
}
