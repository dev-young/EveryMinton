"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Schedule, Participant, Member, Game, MatchingPriority } from "@/types";
import { gameRepository } from "@/repositories";
import { generateMatches } from "@/lib/matching";
import { scoreToLevelInfo } from "@/lib/level";
import { calculateGamesPerHour, getScheduleStatReferenceAt } from "@/lib/participantStats";
import { useToast } from "@/components/Toast";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { useModalHistory } from "@/hooks/useModalHistory";
import { AddIcon, CloseIcon, MinusIcon } from "@/components/icons";

interface Props {
  scheduleId: string;
  schedule: Schedule;
  participants: Participant[];
  members: Member[];
  games: Game[];
  priorities: MatchingPriority[];
  onClose: () => void;
  onSaved: () => void;
}

export function AutoMatchModal({ scheduleId, schedule, participants, members, games, priorities, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  useLockBodyScroll();
  const { closeWithHistory } = useModalHistory({ onClose });
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragging = useRef(false);
  const dragCurrentY = useRef(0);

  const [includePlayingMembers, setIncludePlayingMembers] = useState(false);

  // 빈 코트 수 계산
  const inProgressGames = games.filter((g) => g.status === "in_progress");
  const emptyCourts = schedule.courtCount === null ? null : Math.max(0, schedule.courtCount - inProgressGames.length);

  // 대기중인 게임에 포함된 유저 ID
  const waitingGamePlayerIds = new Set(
    games
      .filter((g) => g.status === "waiting")
      .flatMap((g) => [...g.team1, ...g.team2])
  );

  // 게임중이 아니고 대기중인 게임도 없는 모임원 수
  const idleCount = participants.filter((p) =>
    p.status === "waiting" && !waitingGamePlayerIds.has(p.memberId)
  ).length;

  const [gameCount, setGameCount] = useState(Math.max(1, Math.floor(idleCount / 4)));

  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{ team1: [string, string]; team2: [string, string] }[]>([]);
  const statReferenceAt = useMemo(() => getScheduleStatReferenceAt(schedule), [schedule]);
  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );
  const participantMap = useMemo(
    () => new Map(participants.map((participant) => [participant.memberId, participant])),
    [participants]
  );

  function closeModal() {
    closeWithHistory();
  }

  // 드래그 닫기
  function handleTouchStart(e: React.TouchEvent) {
    const el = sheetRef.current;
    if (el && el.scrollTop > 0) return;
    dragStartY.current = e.touches[0].clientY;
    dragging.current = true;
    dragCurrentY.current = 0;
    if (el) el.style.transition = "none";
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!dragging.current) return;
    const diff = e.touches[0].clientY - dragStartY.current;
    if (diff > 0) {
      dragCurrentY.current = diff;
      const el = sheetRef.current;
      if (el) el.style.transform = `translateY(${diff}px)`;
      e.preventDefault();
    } else {
      dragging.current = false;
      const el = sheetRef.current;
      if (el) { el.style.transition = "transform 0.2s ease-out"; el.style.transform = "translateY(0)"; }
    }
  }

  function handleTouchEnd() {
    if (!dragging.current) return;
    dragging.current = false;
    const el = sheetRef.current;
    if (el) el.style.transition = "transform 0.2s ease-out";
    if (dragCurrentY.current > 100) {
      if (el) el.style.transform = "translateY(100%)";
      setTimeout(() => closeModal(), 200);
    } else {
      if (el) el.style.transform = "translateY(0)";
    }
  }

  // 미리보기 생성
  const generatePreview = useCallback(() => {
    const results = generateMatches(participants, members, games, priorities, {
      includePlayingMembers,
      gameCount,
      referenceAt: statReferenceAt,
    });
    setPreview(results);
  }, [gameCount, games, includePlayingMembers, members, participants, priorities, statReferenceAt]);

  // 미리보기 자동 생성
  useEffect(() => {
    const timer = window.setTimeout(generatePreview, 0);
    return () => window.clearTimeout(timer);
  }, [generatePreview]);

  function getMember(id: string): Member | undefined {
    return memberMap.get(id);
  }

  function getParticipant(id: string): Participant | undefined {
    return participantMap.get(id);
  }

  function getGPH(id: string): string {
    const p = getParticipant(id);
    if (!p) return "0.0";
    return calculateGamesPerHour(p, statReferenceAt).toFixed(1);
  }

  async function handleConfirm() {
    if (preview.length === 0) {
      showToast("생성할 게임이 없습니다.");
      return;
    }

    setSaving(true);
    try {
      await gameRepository.createMany(
        scheduleId,
        preview.map((match) => ({
          courtNumber: 0,
          status: "waiting",
          team1: match.team1,
          team2: match.team2,
          startedAt: null,
          endedAt: null,
        }))
      );

      closeWithHistory(onSaved);
      showToast(`${preview.length}개 게임이 생성되었습니다.`, "success");
    } catch (error) {
      console.error("자동 매칭 실패:", error);
      showToast("게임 생성에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  const waitingCount = participants.filter((p) => p.status === "waiting").length;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div
        ref={sheetRef}
        className="bg-white rounded-t-2xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 핸들 */}
        <div className="pt-4 px-6">
          <div className="w-9 h-1 bg-[var(--color-border)] rounded-full mx-auto mb-4" />
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">자동 매칭</h2>
            <button
              type="button"
              onClick={closeModal}
              className="flex h-8 w-8 items-center justify-center text-[var(--color-text-muted)]"
              aria-label="닫기"
            >
              <CloseIcon aria-hidden="true" className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 옵션 */}
        <div className="px-6 pb-4">
          <div className="bg-[var(--color-bg)] rounded-xl p-4 space-y-3">
            {/* 게임중 인원 포함 */}
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">게임중 인원 포함</span>
              <button
                onClick={() => setIncludePlayingMembers(!includePlayingMembers)}
                className={`w-11 h-6 rounded-full transition-colors relative ${
                  includePlayingMembers ? "bg-[var(--color-accent)]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                    includePlayingMembers ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* 생성 게임 수 */}
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">생성 게임 수</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setGameCount(Math.max(1, gameCount - 1))}
                  className="flex w-7 h-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                  aria-label="생성 게임 수 줄이기"
                >
                  <MinusIcon aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
                <span className="text-sm font-bold w-4 text-center">{gameCount}</span>
                <button
                  onClick={() => setGameCount(gameCount + 1)}
                  className="flex w-7 h-7 items-center justify-center rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                  aria-label="생성 게임 수 늘리기"
                >
                  <AddIcon aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* 정보 */}
            <p className="text-[11px] text-[var(--color-text-muted)]">
              대기 인원: {waitingCount}명 · 빈 코트: {emptyCourts === null ? "미정" : `${emptyCourts}면`}
            </p>
          </div>
        </div>

        {/* 미리보기 */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <p className="text-sm font-bold mb-2">매칭 미리보기</p>
          {preview.length > 0 ? (
            <div className="space-y-4">
              {preview.map((match, index) => (
                <div key={index} className="bg-white rounded-xl border border-[var(--color-border)] p-3 relative">
                  <span className="absolute -top-2 left-3 bg-white px-1.5 text-[10px] font-semibold text-[var(--color-text-muted)]">게임 {index + 1}</span>
                  <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
                    <div className="grid min-w-0 grid-cols-2 gap-1">
                      {match.team1.map((id) => {
                        const m = getMember(id);
                        if (!m) return null;
                        const isMale = m.gender === "male";
                        const levelInfo = scoreToLevelInfo(m.level);
                        return (
                          <span key={id} className={`flex w-full min-w-0 flex-col items-center rounded-md px-2 py-1.5 text-xs font-medium ${isMale ? "bg-blue-50 text-[var(--color-primary)]" : "bg-pink-50 text-pink-600"}`}>
                            <span className="max-w-full truncate">{m.name}</span>
                            <span className="max-w-full truncate text-[9px] opacity-60">{levelInfo.display} · {getGPH(id)}/h</span>
                          </span>
                        );
                      })}
                    </div>
                    <span className="self-center text-[11px] font-bold text-[var(--color-text-muted)]">VS</span>
                    <div className="grid min-w-0 grid-cols-2 gap-1">
                      {match.team2.map((id) => {
                        const m = getMember(id);
                        if (!m) return null;
                        const isMale = m.gender === "male";
                        const levelInfo = scoreToLevelInfo(m.level);
                        return (
                          <span key={id} className={`flex w-full min-w-0 flex-col items-center rounded-md px-2 py-1.5 text-xs font-medium ${isMale ? "bg-blue-50 text-[var(--color-primary)]" : "bg-pink-50 text-pink-600"}`}>
                            <span className="max-w-full truncate">{m.name}</span>
                            <span className="max-w-full truncate text-[9px] opacity-60">{levelInfo.display} · {getGPH(id)}/h</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--color-text-muted)]">
              <p className="text-sm">매칭 가능한 인원이 부족합니다</p>
              <p className="text-[11px] mt-1">대기중인 인원이 4명 이상이어야 합니다</p>
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 border-t border-[var(--color-border)] flex gap-2">
          <button
            onClick={generatePreview}
            className="px-4 py-3.5 bg-[#f1f5f8] text-[var(--color-text-secondary)] rounded-xl text-sm font-semibold"
          >
            다시 뽑기
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving || preview.length === 0}
            className="flex-1 py-3.5 bg-[var(--color-accent)] text-white rounded-xl text-sm font-bold disabled:bg-gray-300 disabled:cursor-not-allowed active:bg-[var(--color-accent-dark)]"
          >
            {saving ? "생성중..." : `${preview.length}개 게임 생성`}
          </button>
        </div>
      </div>
    </div>
  );
}
