"use client";

import { useState } from "react";
import { Participant, Member, ParticipantStatus } from "@/types";
import { participantRepository } from "@/repositories";
import { scoreToLevelInfo } from "@/lib/level";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Props {
  scheduleId: string;
  participants: Participant[];
  getMember: (id: string) => Member | undefined;
  onAddClick: () => void;
  onRefresh: () => void;
}

export function ParticipantsTab({ scheduleId, participants, getMember, onAddClick, onRefresh }: Props) {
  const { showToast } = useToast();
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);

  const waiting = participants.filter((p) => p.status === "waiting");
  const playing = participants.filter((p) => p.status === "playing");
  const registered = participants.filter((p) => p.status === "registered");
  const left = participants.filter((p) => p.status === "left");

  async function changeStatus(memberId: string, newStatus: ParticipantStatus) {
    try {
      const updates: Partial<Participant> = { status: newStatus };

      if (newStatus === "waiting") {
        updates.joinedAt = new Date();
      } else if (newStatus === "left") {
        updates.leftAt = new Date();
      }

      await participantRepository.update(scheduleId, memberId, updates);
      onRefresh();
    } catch (error) {
      console.error("상태 변경 실패:", error);
      showToast("상태 변경에 실패했습니다.");
    }
  }

  function handleLeave(memberId: string) {
    setLeaveTarget(memberId);
  }

  const leaveTargetMember = leaveTarget ? getMember(leaveTarget) : undefined;

  return (
    <div className="pb-20">
      {/* 플로팅 참여자 추가 버튼 */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 max-w-3xl w-[calc(100%-32px)]">
        <button
          onClick={onAddClick}
          className="w-full py-3.5 bg-[var(--color-accent)] text-white rounded-xl text-sm font-bold active:bg-[var(--color-accent-dark)] shadow-lg"
        >
          + 참여자 추가
        </button>
      </div>

      {/* 게임중 */}
      {playing.length > 0 && (
        <ParticipantGroup
          title="게임중"
          count={playing.length}
          color="text-[var(--color-warning)]"
        >
          {playing.map((p) => (
            <ParticipantItem
              key={p.memberId}
              participant={p}
              member={getMember(p.memberId)}
              actions={
                <StatusButton label="퇴장" color="danger" onClick={() => handleLeave(p.memberId)} />
              }
            />
          ))}
        </ParticipantGroup>
      )}

      {/* 대기중 */}
      {waiting.length > 0 && (
        <ParticipantGroup
          title="대기중"
          count={waiting.length}
          color="text-[var(--color-accent)]"
        >
          {waiting.map((p) => (
            <ParticipantItem
              key={p.memberId}
              participant={p}
              member={getMember(p.memberId)}
              actions={
                <StatusButton label="퇴장" color="danger" onClick={() => handleLeave(p.memberId)} />
              }
            />
          ))}
        </ParticipantGroup>
      )}

      {/* 참여 예정 */}
      {registered.length > 0 && (
        <ParticipantGroup
          title="참여 예정"
          count={registered.length}
          color="text-[var(--color-primary)]"
        >
          {registered.map((p) => (
            <ParticipantItem
              key={p.memberId}
              participant={p}
              member={getMember(p.memberId)}
              actions={
                <StatusButton label="대기중으로" color="accent" onClick={() => changeStatus(p.memberId, "waiting")} />
              }
            />
          ))}
        </ParticipantGroup>
      )}

      {/* 퇴장 */}
      {left.length > 0 && (
        <ParticipantGroup
          title="퇴장"
          count={left.length}
          color="text-[var(--color-text-muted)]"
        >
          {left.map((p) => (
            <ParticipantItem
              key={p.memberId}
              participant={p}
              member={getMember(p.memberId)}
              dimmed
              actions={null}
            />
          ))}
        </ParticipantGroup>
      )}

      {/* 빈 상태 */}
      {participants.length === 0 && (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <p className="text-3xl mb-2">👥</p>
          <p className="text-sm">참여자가 없습니다</p>
          <p className="text-xs mt-1">참여자를 추가하세요</p>
        </div>
      )}

      {/* 퇴장 확인 다이얼로그 */}
      {leaveTarget && (
        <ConfirmDialog
          title="퇴장 처리"
          message={`${leaveTargetMember?.name ?? ""}님을 퇴장 처리하시겠습니까?`}
          confirmLabel="퇴장"
          danger
          onCancel={() => setLeaveTarget(null)}
          onConfirm={() => {
            changeStatus(leaveTarget, "left");
            setLeaveTarget(null);
          }}
        />
      )}
    </div>
  );
}

function ParticipantGroup({
  title,
  count,
  color,
  children,
}: {
  title: string;
  count: number;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <p className={`text-xs font-semibold mb-2 ${color}`}>
        {title} ({count}명)
      </p>
      <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm">
        {children}
      </div>
    </div>
  );
}

function ParticipantItem({
  participant,
  member,
  dimmed,
  actions,
}: {
  participant: Participant;
  member: Member | undefined;
  dimmed?: boolean;
  actions: React.ReactNode;
}) {
  if (!member) return null;

  const levelInfo = scoreToLevelInfo(member.level);
  const isMale = member.gender === "male";

  return (
    <div className={`flex items-center px-3.5 py-3 border-b border-[#f4f7f9] last:border-b-0 ${dimmed ? "opacity-50" : ""}`}>
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mr-3 ${
          isMale ? "bg-blue-50 text-[var(--color-primary)]" : "bg-pink-50 text-pink-600"
        }`}
      >
        {member.name.charAt(0)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{member.name}</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {isMale ? "남" : "여"} · {levelInfo.display}
          {participant.gamesPlayed > 0 && ` · 게임 ${participant.gamesPlayed}회`}
        </p>
      </div>
      {actions}
    </div>
  );
}

function StatusButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: "accent" | "danger";
  onClick: () => void;
}) {
  const colorClass =
    color === "accent"
      ? "bg-green-50 text-[var(--color-accent)]"
      : "bg-red-50 text-[var(--color-danger)]";

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-[11px] font-semibold ${colorClass}`}
    >
      {label}
    </button>
  );
}
