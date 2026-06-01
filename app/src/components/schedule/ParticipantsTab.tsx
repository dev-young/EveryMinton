"use client";

import { useState } from "react";
import { Participant, Member, ParticipantStatus } from "@/types";
import { participantRepository } from "@/repositories";
import { scoreToLevelInfo, scoreToViewLevelDisplay } from "@/lib/level";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Props {
  scheduleId: string;
  participants: Participant[];
  getMember: (id: string) => Member | undefined;
  readOnly?: boolean;
  onAddClick?: () => void;
  onMemberClick?: (memberId: string) => void;
  onRefresh?: () => void;
}

export function ParticipantsTab({
  scheduleId,
  participants,
  getMember,
  readOnly = false,
  onAddClick,
  onMemberClick,
  onRefresh,
}: Props) {
  const { showToast } = useToast();
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const [selectedRegisteredIds, setSelectedRegisteredIds] = useState<Set<string>>(new Set());

  const waiting = participants.filter((participant) => participant.status === "waiting");
  const playing = participants.filter((participant) => participant.status === "playing");
  const registered = participants.filter((participant) => participant.status === "registered");
  const left = participants.filter((participant) => participant.status === "left");
  const registeredIdSet = new Set(registered.map((participant) => participant.memberId));
  const activeSelectedRegisteredIds = [...selectedRegisteredIds].filter((memberId) => registeredIdSet.has(memberId));

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

  async function cancelParticipation(memberId: string) {
    try {
      await participantRepository.remove(scheduleId, memberId);
      onRefresh?.();
    } catch (error) {
      console.error("참여 취소 실패:", error);
      showToast("참여 취소에 실패했습니다.");
    }
  }

  function toggleRegisteredSelection(memberId: string) {
    setSelectedRegisteredIds((current) => {
      const next = new Set(current);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  }

  async function cancelSelectedRegistered() {
    const memberIds = activeSelectedRegisteredIds;
    if (memberIds.length === 0) return;

    try {
      await Promise.all(memberIds.map((memberId) => participantRepository.remove(scheduleId, memberId)));
      setSelectedRegisteredIds(new Set());
      onRefresh?.();
    } catch (error) {
      console.error("참여 일괄 취소 실패:", error);
      showToast("참여 일괄 취소에 실패했습니다.");
    }
  }

  async function joinSelectedRegistered() {
    const memberIds = activeSelectedRegisteredIds;
    if (memberIds.length === 0) return;

    try {
      const joinedAt = new Date();
      await participantRepository.updateMany(
        scheduleId,
        memberIds.map((memberId) => ({
          memberId,
          data: { status: "waiting", joinedAt },
        }))
      );
      setSelectedRegisteredIds(new Set());
      onRefresh?.();
    } catch (error) {
      console.error("참여 일괄 처리 실패:", error);
      showToast("참여 일괄 처리에 실패했습니다.");
    }
  }

  const leaveTargetMember = leaveTarget ? getMember(leaveTarget) : undefined;
  const selectedRegisteredCount = activeSelectedRegisteredIds.length;

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
              readOnly={readOnly}
              onClick={readOnly ? undefined : () => onMemberClick?.(participant.memberId)}
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
              readOnly={readOnly}
              onClick={readOnly ? undefined : () => onMemberClick?.(participant.memberId)}
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
        <ParticipantGroup
          title="참여 예정"
          count={registered.length}
          color="text-[var(--color-primary)]"
          headerActions={
            !readOnly && selectedRegisteredCount > 0 ? (
              <div className="flex items-center gap-1.5">
                <BulkActionButton label="취소" color="neutral" onClick={cancelSelectedRegistered} />
                <BulkActionButton label="참여" color="accent" onClick={joinSelectedRegistered} />
              </div>
            ) : null
          }
        >
          {registered.map((participant) => (
            <ParticipantItem
              key={participant.memberId}
              participant={participant}
              member={getMember(participant.memberId)}
              readOnly={readOnly}
              onClick={readOnly ? undefined : () => onMemberClick?.(participant.memberId)}
              selected={selectedRegisteredIds.has(participant.memberId)}
              onProfileClick={readOnly ? undefined : () => toggleRegisteredSelection(participant.memberId)}
              actions={
                readOnly ? null : (
                  <div className="flex gap-1.5">
                    <StatusButton
                      label="취소"
                      color="neutral"
                      onClick={() => cancelParticipation(participant.memberId)}
                    />
                    <StatusButton
                      label="참여"
                      color="accent"
                      onClick={() => changeStatus(participant.memberId, "waiting")}
                    />
                  </div>
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
              readOnly={readOnly}
              onClick={readOnly ? undefined : () => onMemberClick?.(participant.memberId)}
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
  headerActions,
  children,
}: {
  title: string;
  count: number;
  color: string;
  headerActions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
        <p className={`text-xs font-semibold ${color}`}>
          {title} ({count}명)
        </p>
        {headerActions}
      </div>
      <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
        {children}
      </div>
    </div>
  );
}

function ParticipantItem({
  participant,
  member,
  readOnly = false,
  dimmed,
  onClick,
  selected = false,
  onProfileClick,
  actions,
}: {
  participant: Participant;
  member: Member | undefined;
  readOnly?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  selected?: boolean;
  onProfileClick?: () => void;
  actions: React.ReactNode;
}) {
  if (!member) return null;

  const levelInfo = scoreToLevelInfo(member.level);
  const levelDisplay = readOnly ? scoreToViewLevelDisplay(member.level) : levelInfo.display;
  const isMale = member.gender === "male";

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={`flex items-center border-b border-[#f4f7f9] px-3.5 py-3 last:border-b-0 ${
        onClick ? "cursor-pointer active:bg-gray-50" : ""
      } ${selected ? "bg-blue-50/40" : ""} ${dimmed ? "opacity-50" : ""}`}
    >
      <div
        role={onProfileClick ? "button" : undefined}
        tabIndex={onProfileClick ? 0 : undefined}
        onClick={(event) => {
          if (!onProfileClick) return;
          event.stopPropagation();
          onProfileClick();
        }}
        onKeyDown={(event) => {
          if (!onProfileClick) return;
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            onProfileClick();
          }
        }}
        className={`mr-3 flex min-w-0 flex-1 items-center rounded-lg py-1 pr-2 ${
          onProfileClick ? "cursor-pointer active:bg-blue-50" : ""
        }`}
      >
        <div
          className={`mr-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
            selected
              ? "bg-[var(--color-primary)] text-white"
              : isMale
                ? "bg-blue-50 text-[var(--color-primary)]"
                : "bg-pink-50 text-pink-600"
          }`}
        >
          {selected ? "✓" : member.name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{member.name}</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">
            {isMale ? "남" : "여"} · {levelDisplay}
            {participant.gamesPlayed > 0 && ` · 게임 ${participant.gamesPlayed}회`}
          </p>
        </div>
      </div>
      {actions && <div onClick={(event) => event.stopPropagation()}>{actions}</div>}
    </div>
  );
}

function BulkActionButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: "accent" | "neutral";
  onClick: () => void;
}) {
  const colorClass = {
    accent: "bg-green-50 text-[var(--color-accent)]",
    neutral: "bg-gray-100 text-[var(--color-text-muted)]",
  }[color];

  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold ${colorClass}`}
    >
      {label}
    </button>
  );
}

function StatusButton({
  label,
  color,
  onClick,
}: {
  label: string;
  color: "accent" | "danger" | "neutral";
  onClick: () => void;
}) {
  const colorClass = {
    accent: "bg-green-50 text-[var(--color-accent)]",
    danger: "bg-red-50 text-[var(--color-danger)]",
    neutral: "bg-gray-100 text-[var(--color-text-muted)]",
  }[color];

  return (
    <button
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`rounded-md px-3 py-1.5 text-[11px] font-semibold ${colorClass}`}
    >
      {label}
    </button>
  );
}
