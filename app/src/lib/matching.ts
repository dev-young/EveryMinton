import { Participant, Member, Game, MatchingPriority } from "@/types";

interface MatchCandidate {
  memberId: string;
  member: Member;
  participant: Participant;
  gph: number; // 시간당 게임 횟수
}

interface MatchResult {
  team1: [string, string];
  team2: [string, string];
}

const MALE_LEVEL_ADJUSTMENT = 20;

/**
 * 자동 매칭 알고리즘
 * 우선순위에 따라 최적의 4명 조합을 선택하고 팀을 구성
 */
export function generateMatches(
  participants: Participant[],
  members: Member[],
  _games: Game[],
  priorities: MatchingPriority[],
  options: {
    includePlayingMembers: boolean;
    gameCount: number;
  }
): MatchResult[] {
  // 매칭 대상 후보 구성
  const candidates = getCandidates(participants, members, options.includePlayingMembers);

  if (candidates.length < 4) return [];

  const results: MatchResult[] = [];
  const usedIds = new Set<string>();

  for (let i = 0; i < options.gameCount; i++) {
    const available = candidates.filter((c) => !usedIds.has(c.memberId));
    if (available.length < 4) break;

    const selected = selectBestFour(available, priorities);
    if (!selected) break;

    const teamResult = assignTeams(selected, priorities);
    results.push(teamResult);

    selected.forEach((c) => usedIds.add(c.memberId));
  }

  return results;
}

/**
 * 매칭 대상 후보 목록 생성
 */
function getCandidates(
  participants: Participant[],
  members: Member[],
  includePlayingMembers: boolean
): MatchCandidate[] {
  return participants
    .filter((p) => {
      if (p.status === "waiting") return true;
      if (p.status === "playing" && includePlayingMembers) return true;
      return false;
    })
    .map((p) => {
      const member = members.find((m) => m.id === p.memberId);
      if (!member) return null;
      return {
        memberId: p.memberId,
        member,
        participant: p,
        gph: calculateGPH(p),
      };
    })
    .filter((c): c is MatchCandidate => c !== null);
}

/**
 * 우선순위에 따라 최적의 4명 선택
 */
function selectBestFour(
  candidates: MatchCandidate[],
  priorities: MatchingPriority[]
): MatchCandidate[] | null {
  if (candidates.length < 4) return null;

  // 시간당 게임 횟수가 낮은 순으로 기본 정렬 + 동일 값 내 랜덤 셔플
  const sorted = [...candidates].sort((a, b) => {
    const diff = a.gph - b.gph;
    if (Math.abs(diff) < 0.3) return Math.random() - 0.5; // 비슷한 값이면 랜덤
    return diff;
  });

  // 기본: 시간당 게임 횟수가 가장 낮은 4명 선택
  let selected = sorted.slice(0, 4);

  // 성별 밸런스 우선순위가 높으면 조정
  const genderPriorityIndex = priorities.indexOf("gender_balance");
  if (genderPriorityIndex !== -1 && genderPriorityIndex < 2) {
    selected = selectWithGenderBalance(sorted, selected);
  }

  return selected;
}

/**
 * 성별 밸런스를 고려한 4명 선택
 * 가능하면 남2여2, 아니면 남3여1 또는 남1여3
 */
function selectWithGenderBalance(
  sorted: MatchCandidate[],
  defaultSelection: MatchCandidate[]
): MatchCandidate[] {
  const males = sorted.filter((c) => c.member.gender === "male");
  const females = sorted.filter((c) => c.member.gender === "female");

  // 남2 여2 가능한지
  if (males.length >= 2 && females.length >= 2) {
    return [...males.slice(0, 2), ...females.slice(0, 2)];
  }

  // 남3 여1 또는 남1 여3
  if (males.length >= 3 && females.length >= 1) {
    return [...males.slice(0, 3), ...females.slice(0, 1)];
  }
  if (females.length >= 3 && males.length >= 1) {
    return [...males.slice(0, 1), ...females.slice(0, 3)];
  }

  return defaultSelection;
}

/**
 * 4명을 2팀으로 배정
 * 급수 밸런스를 고려하여 팀 간 실력 차이 최소화
 */
function assignTeams(
  selected: MatchCandidate[],
  priorities: MatchingPriority[]
): MatchResult {
  const levelPriorityIndex = priorities.indexOf("level_balance");

  // 급수 밸런스가 우선순위에 있으면 실력 균형 맞추기
  if (levelPriorityIndex !== -1) {
    // 실력순 정렬 후 1,4번 vs 2,3번 (지그재그 배정)
    const bySLevel = [...selected].sort(
      (a, b) => getEffectiveLevel(b.member) - getEffectiveLevel(a.member)
    );
    return {
      team1: [bySLevel[0].memberId, bySLevel[3].memberId],
      team2: [bySLevel[1].memberId, bySLevel[2].memberId],
    };
  }

  // 기본: 앞 2명 vs 뒤 2명
  return {
    team1: [selected[0].memberId, selected[1].memberId],
    team2: [selected[2].memberId, selected[3].memberId],
  };
}

/**
 * 시간당 게임 횟수 계산
 */
function calculateGPH(participant: Participant): number {
  if (!participant.joinedAt) return 0;
  const now = new Date();
  const minutesElapsed =
    (now.getTime() - participant.joinedAt.getTime()) / 60000;
  if (minutesElapsed <= 0) return 0;
  return (participant.gamesPlayed / minutesElapsed) * 60;
}

/**
 * 매칭용 실력 점수.
 * 표시/저장 급수는 유지하고, 실제 경기 밸런스 계산에만 성별 보정을 적용한다.
 */
function getEffectiveLevel(member: Member): number {
  return member.level + (member.gender === "male" ? MALE_LEVEL_ADJUSTMENT : 0);
}
