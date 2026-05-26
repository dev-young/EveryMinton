"use client";

import { Participant, Member } from "@/types";
import { scoreToLevelInfo } from "@/lib/level";

interface Props {
  participants: Participant[];
  getMember: (id: string) => Member | undefined;
}

export function WaitingTab({ participants, getMember }: Props) {
  // 대기중인 참여자만 (시간당 게임 횟수 낮은 순 정렬)
  const waitingParticipants = participants
    .filter((p) => p.status === "waiting")
    .map((p) => {
      const member = getMember(p.memberId);
      const gph = calculateGPH(p);
      const waitMinutes = calculateWaitMinutes(p);
      return { ...p, member, gph, waitMinutes };
    })
    .sort((a, b) => a.gph - b.gph);

  if (waitingParticipants.length === 0) {
    return (
      <div className="text-center py-12 text-[var(--color-text-muted)]">
        <p className="text-3xl mb-2">⏳</p>
        <p className="text-sm">대기중인 인원이 없습니다</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm font-bold">대기중 ({waitingParticipants.length}명)</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">시간당 게임 횟수 낮은 순</p>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm">
        {waitingParticipants.map((item, index) => {
          if (!item.member) return null;
          const levelInfo = scoreToLevelInfo(item.member.level);
          const isMale = item.member.gender === "male";

          return (
            <div
              key={item.memberId}
              className="flex items-center px-3.5 py-3 border-b border-[#f4f7f9] last:border-b-0"
            >
              {/* 순위 */}
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mr-3 ${
                  index < 2
                    ? "bg-red-50 text-[var(--color-danger)]"
                    : "bg-blue-50 text-[var(--color-primary)]"
                }`}
              >
                {index + 1}
              </span>

              {/* 이름 */}
              <span className="flex-1 text-sm font-semibold">{item.member.name}</span>

              {/* 성별 */}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded mr-2 font-semibold ${
                  isMale ? "bg-blue-50 text-[var(--color-primary)]" : "bg-pink-50 text-pink-600"
                }`}
              >
                {isMale ? "남" : "여"}
              </span>

              {/* 통계 */}
              <div className="text-right">
                <div className="text-xs font-bold">{item.gph.toFixed(1)} 게임/h</div>
                <div className="text-[11px] text-[var(--color-text-muted)]">
                  대기 {item.waitMinutes}분
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function calculateGPH(participant: Participant): number {
  if (!participant.joinedAt) return 0;
  const now = new Date();
  const minutesElapsed = (now.getTime() - participant.joinedAt.getTime()) / 60000;
  if (minutesElapsed <= 0) return 0;
  return (participant.gamesPlayed / minutesElapsed) * 60;
}

function calculateWaitMinutes(participant: Participant): number {
  const reference = participant.lastGameEndedAt ?? participant.joinedAt;
  if (!reference) return 0;
  const now = new Date();
  return Math.floor((now.getTime() - reference.getTime()) / 60000);
}
