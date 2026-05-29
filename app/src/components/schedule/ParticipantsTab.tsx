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
  readOnly?: boolean;
  onAddClick?: () => void;
  onRefresh?: () => void;
}

export function ParticipantsTab({
  scheduleId,
  participants,
  getMember,
  readOnly = false,
  onAddClick,
  onRefresh,
}: Props) {
  const { showToast } = useToast();
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);

  const waiting = participants.filter((participant) => participant.status === "waiting");
  const playing = participants.filter((participant) => participant.status === "playing");
  const registered = participants.filter((participant) => participant.status === "registered");
  const left = participants.filter((participant) => participant.status === "left");

  async function changeStatus(memberId: string, newStatus: ParticipantStatus) {
    try {
      const updates: Partial<Participant> = { status: newStatus };

      if (newStatus === "waiting") {
        updates.joinedAt = new Date();
      } else if (newStatus === "left") {
        updates.leftAt = new Date();
      }

      await participantRepository.update(scheduleId, memberId, updates);
      onRefresh?.();
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
      {!readOnly && onAddClick && (
        <div className="fixed bottom-5 left-1/2 z-30 w-[calc(100%-32px)] max-w-3xl -translate-x-1/2">
          <button
            onClick={onAddClick}
            className="w-full rounded-xl bg-[var(--color-accent)] py-3.5 text-sm font-bold text-white shadow-lg active:bg-[var(--color-accent-dark)]"
          >
            + 참여자 추가
          </button>
        </div>
      )}

      {playing.length > 0 && (
        <ParticipantGroup title="게임중" count={playing.length} color="text-[var(--color-warning)]">
          {playing.map((participant) => (
            <ParticipantItem
              key={participant.memberId}
              participant={participant}
              member={getMember(participant.memberId)}
              actions={
                readOnly ? null : (
                  <StatusButton label="퇴장" color="danger" onClick={() => handleLeave(participant.memberId)} />
                )
              }
            />
          ))}
        </ParticipantGroup>
      )}

      {waiting.length > 0 && (
        <ParticipantGroup title="대기중" count={waiting.length} color="text-[var(--color-accent)]">
          {waiting.map((participant) => (
            <ParticipantItem
              key={participant.memberId}
              participant={participant}
              member={getMember(participant.memberId)}
              actions={
                readOnly ? null : (
                  <StatusButton label="퇴장" color="danger" onClick={() => handleLeave(participant.memberId)} />
                )
              }
            />
          ))}
        </ParticipantGroup>
      )}

      {registered.length > 0 && (
        <ParticipantGroup title="참여 예정" count={registered.length} color="text-[var(--color-primary)]">
          {registered.map((participant) => (
            <ParticipantItem
              key={participant.memberId}
              participant={participant}
              member={getMember(participant.memberId)}
              actions={
                readOnly ? null : (
                  <StatusButton
                    label="참여"
                    color="accent"
                    onClick={() => changeStatus(participant.memberId, "waiting")}
                  />
                )
              }
            />
          ))}
        </ParticipantGroup>
      )}

      {left.length > 0 && (
        <ParticipantGroup title="퇴장" count={left.length} color="text-[var(--color-text-muted)]">
          {left.map((participant) => (
            <ParticipantItem
              key={participant.memberId}
              participant={participant}
              member={getMember(participant.memberId)}
              dimmed
              actions={null}
            />
          ))}
        </ParticipantGroup>
      )}

      {participants.length === 0 && (
        <div className="py-12 text-center text-[var(--color-text-muted)]">
          <p className="mb-2 text-3xl">👥</p>
          <p className="text-sm">참여자가 없습니다</p>
          {!readOnly && <p className="mt-1 text-xs">참여자를 추가하세요</p>}
        </div>
      )}

      {!readOnly && leaveTarget && (
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
      <p className={`mb-2 text-xs font-semibold ${color}`}>
        {title} ({count}명)
      </p>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
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
    <div
      className={`flex items-center border-b border-[#f4f7f9] px-3.5 py-3 last:border-b-0 ${dimmed ? "opacity-50" : ""}`}
    >
      <div
        className={`mr-3 flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
          isMale ? "bg-blue-50 text-[var(--color-primary)]" : "bg-pink-50 text-pink-600"
        }`}
      >
        {member.name.charAt(0)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{member.name}</p>
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
    <button onClick={onClick} className={`rounded-md px-3 py-1.5 text-[11px] font-semibold ${colorClass}`}>
      {label}
    </button>
  );
}
