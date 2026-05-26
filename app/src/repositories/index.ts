import {
  FirebaseMemberRepository,
  FirebaseScheduleRepository,
  FirebaseParticipantRepository,
  FirebaseGameRepository,
} from "./firebase";
import {
  MemberRepository,
  ScheduleRepository,
  ParticipantRepository,
  GameRepository,
} from "./interfaces";

export type {
  MemberRepository,
  ScheduleRepository,
  ParticipantRepository,
  GameRepository,
};

// Repository 인스턴스 (백엔드 변경 시 여기만 교체)
export const memberRepository: MemberRepository =
  new FirebaseMemberRepository();
export const scheduleRepository: ScheduleRepository =
  new FirebaseScheduleRepository();
export const participantRepository: ParticipantRepository =
  new FirebaseParticipantRepository();
export const gameRepository: GameRepository = new FirebaseGameRepository();
