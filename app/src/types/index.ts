// 성별
export type Gender = "male" | "female";

// 급수 등급
export type LevelGrade = "A" | "B" | "C" | "D" | "E";
export type LevelSubGrade = "상" | "중" | "하";

// 모임원
export interface Member {
  id: string;
  name: string;
  gender: Gender;
  level: number; // 내부 점수 (1~100)
  createdAt: Date;
}

// 일정 상태
export type ScheduleStatus = "upcoming" | "in_progress" | "completed";

// 일정
export interface Schedule {
  id: string;
  date: string; // "2025-01-15"
  startTime: string; // "19:00"
  endTime: string; // "22:00"
  courtCount: number;
  location: string;
  status: ScheduleStatus;
  createdAt: Date;
}

// 참여자 상태
export type ParticipantStatus = "registered" | "waiting" | "playing" | "left";

// 일정 참여자
export interface Participant {
  memberId: string;
  status: ParticipantStatus;
  joinedAt: Date | null; // '대기중' 전환 시점
  leftAt: Date | null; // '퇴장' 전환 시점
  gamesPlayed: number;
  lastGameEndedAt: Date | null;
}

// 게임 상태
export type GameStatus = "waiting" | "in_progress" | "completed";

// 게임
export interface Game {
  id: string;
  courtNumber: number;
  status: GameStatus;
  team1: [string, string]; // [memberId, memberId]
  team2: [string, string]; // [memberId, memberId]
  startedAt: Date | null;
  endedAt: Date | null;
}

// 매칭 우선순위
export type MatchingPriority =
  | "games_per_hour"
  | "avoid_repeat"
  | "gender_balance"
  | "level_balance";

// 급수 점수 계산용
export interface LevelInfo {
  grade: LevelGrade;
  subGrade: LevelSubGrade;
  score: number;
  display: string; // "B중" 등
}
