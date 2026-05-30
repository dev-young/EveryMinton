import { Member, Schedule, Participant, Game, Feedback } from "@/types";

/**
 * 모임원 Repository 인터페이스
 * 백엔드 변경 시 이 인터페이스의 구현체만 교체하면 됨
 */
export interface MemberRepository {
  getAll(): Promise<Member[]>;
  getById(id: string): Promise<Member | null>;
  getByIds(ids: string[]): Promise<Member[]>;
  create(member: Omit<Member, "id" | "createdAt">): Promise<Member>;
  update(id: string, data: Partial<Omit<Member, "id" | "createdAt">>): Promise<void>;
  delete(id: string): Promise<void>;
  searchByName(name: string): Promise<Member[]>;
}

/**
 * 일정 Repository 인터페이스
 */
export interface ScheduleRepository {
  getAll(): Promise<Schedule[]>;
  getById(id: string): Promise<Schedule | null>;
  create(schedule: Omit<Schedule, "id" | "createdAt">): Promise<Schedule>;
  update(id: string, data: Partial<Omit<Schedule, "id" | "createdAt">>): Promise<void>;
  delete(id: string): Promise<void>;
}

/**
 * 참여자 Repository 인터페이스
 */
export interface ParticipantRepository {
  getAll(scheduleId: string): Promise<Participant[]>;
  get(scheduleId: string, memberId: string): Promise<Participant | null>;
  add(scheduleId: string, participant: Participant): Promise<void>;
  addMany(scheduleId: string, participants: Participant[]): Promise<void>;
  update(
    scheduleId: string,
    memberId: string,
    data: Partial<Participant>
  ): Promise<void>;
  updateMany(
    scheduleId: string,
    updates: { memberId: string; data: Partial<Participant> }[]
  ): Promise<void>;
  remove(scheduleId: string, memberId: string): Promise<void>;
}

/**
 * 게임 Repository 인터페이스
 */
export interface GameRepository {
  getAll(scheduleId: string): Promise<Game[]>;
  getById(scheduleId: string, gameId: string): Promise<Game | null>;
  create(scheduleId: string, game: Omit<Game, "id">): Promise<Game>;
  createMany(scheduleId: string, games: Omit<Game, "id">[]): Promise<Game[]>;
  update(
    scheduleId: string,
    gameId: string,
    data: Partial<Omit<Game, "id">>
  ): Promise<void>;
  delete(scheduleId: string, gameId: string): Promise<void>;
  getActiveGames(scheduleId: string): Promise<Game[]>;
}

/**
 * 피드백 Repository 인터페이스
 */
export interface FeedbackRepository {
  create(feedback: Omit<Feedback, "id" | "createdAt" | "status">): Promise<Feedback>;
}
