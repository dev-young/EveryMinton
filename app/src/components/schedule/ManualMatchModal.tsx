"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Schedule, Participant, Game, Member } from "@/types";
import { gameRepository } from "@/repositories";
import { scoreToLevelInfo } from "@/lib/level";
import { useToast } from "@/components/Toast";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

interface Props {
  scheduleId: string;
  schedule: Schedule;
  participants: Participant[];
  games: Game[];
  getMember: (id: string) => Member | undefined;
  initialSelectedIds?: string[];
  editingGameId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function ManualMatchModal({ scheduleId, schedule, participants, games, getMember, initialSelectedIds, editingGameId, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  useLockBodyScroll();
  const closedRef = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragging = useRef(false);
  const dragCurrentY = useRef(0);

  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds ?? []);
  const [filter, setFilter] = useState<"all" | "idle" | "gameWaiting" | "playing">(initialSelectedIds?.length ? "all" : "idle");

  // 대기중인 게임에 포함된 유저 ID
  const waitingGamePlayerIds = new Set(
    games
      .filter((g) => g.status === "waiting")
      .flatMap((g) => [...g.team1, ...g.team2])
  );

  const dismiss = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    window.history.pushState({ modal: true }, "");
    function handlePopState() { dismiss(); }
    window.addEventListener("popstate", handlePopState);
    return () => { window.removeEventListener("popstate", handlePopState); };
  }, [dismiss]);

  function closeModal() {
    if (closedRef.current) return;
    closedRef.current = true;
    window.history.back();
    onClose();
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

  // 선택 가능한 참여자 (대기중 + 게임중, 정렬 적용)
  const selectableParticipants = participants
    .filter((p) => {
      if (p.status !== "waiting" && p.status !== "playing") return false;
      if (filter === "idle" && (p.status === "playing" || waitingGamePlayerIds.has(p.memberId))) return false;
      if (filter === "gameWaiting" && !waitingGamePlayerIds.has(p.memberId)) return false;
      if (filter === "playing" && p.status !== "playing") return false;
      return true;
    })
    .sort((a, b) => {
      // 1차 정렬: 그 외(0) < 대기중인 게임 있음(1) < 게임중(2)
      function getPriority(p: Participant): number {
        if (p.status === "playing") return 2;
        if (waitingGamePlayerIds.has(p.memberId)) return 1;
        return 0;
      }
      const priorityDiff = getPriority(a) - getPriority(b);
      if (priorityDiff !== 0) return priorityDiff;
      // 2차 정렬: 시간당 게임 횟수 낮은 순
      return calculateGPH(a) - calculateGPH(b);
    });

  function toggleSelect(memberId: string) {
    if (selectedIds.includes(memberId)) {
      setSelectedIds(selectedIds.filter((id) => id !== memberId));
    } else if (selectedIds.length < 4) {
      setSelectedIds([...selectedIds, memberId]);
    }
  }

  async function createGame() {
    if (selectedIds.length !== 4) {
      showToast("4명을 선택해주세요.");
      return;
    }

    try {
      if (editingGameId) {
        // 기존 게임 업데이트
        await gameRepository.update(scheduleId, editingGameId, {
          team1: [selectedIds[0], selectedIds[1]] as [string, string],
          team2: [selectedIds[2], selectedIds[3]] as [string, string],
        });
      } else {
        // 새 게임 생성
        await gameRepository.create(scheduleId, {
          courtNumber: 0,
          status: "waiting",
          team1: [selectedIds[0], selectedIds[1]] as [string, string],
          team2: [selectedIds[2], selectedIds[3]] as [string, string],
          startedAt: null,
          endedAt: null,
        });
      }

      if (!closedRef.current) {
        closedRef.current = true;
        window.history.back();
        onSaved();
      }
    } catch (error) {
      console.error("게임 저장 실패:", error);
      showToast("게임 저장에 실패했습니다.");
    }
  }

  // 슬롯 표시
  const slots = [0, 1, 2, 3].map((i) => {
    const id = selectedIds[i];
    return id ? getMember(id) ?? null : null;
  });

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
    >
      <div
        ref={sheetRef}
        className="bg-white rounded-t-2xl w-full max-w-3xl max-h-[90vh] flex flex-col"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 핸들 */}
        <div className="pt-4 px-6">
          <div className="w-9 h-1 bg-[var(--color-border)] rounded-full mx-auto mb-4" />
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold">수동 매칭</h2>
            <button onClick={closeModal} className="text-xl text-[var(--color-text-muted)] px-1">✕</button>
          </div>
        </div>

        {/* 팀 슬롯 */}
        <div className="px-6 pb-4">
          <div className="bg-[var(--color-bg)] rounded-xl p-3">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-[var(--color-primary)] mb-1.5">팀 A</p>
                <div className="flex gap-1.5">
                  <Slot member={slots[0]} index={0} isNext={selectedIds.length === 0} onRemove={() => setSelectedIds(selectedIds.filter((_, i) => i !== 0))} />
                  <Slot member={slots[1]} index={1} isNext={selectedIds.length === 1} onRemove={() => setSelectedIds(selectedIds.filter((_, i) => i !== 1))} />
                </div>
              </div>
              <span className="text-xs font-bold text-[var(--color-text-muted)]">VS</span>
              <div className="flex-1">
                <p className="text-[10px] font-semibold text-[var(--color-accent)] mb-1.5">팀 B</p>
                <div className="flex gap-1.5">
                  <Slot member={slots[2]} index={2} isNext={selectedIds.length === 2} onRemove={() => setSelectedIds(selectedIds.filter((_, i) => i !== 2))} />
                  <Slot member={slots[3]} index={3} isNext={selectedIds.length === 3} onRemove={() => setSelectedIds(selectedIds.filter((_, i) => i !== 3))} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 필터 */}
        <div className="px-6 pb-2 flex gap-1.5">
          <FilterPill label="전체" active={filter === "all"} onClick={() => setFilter("all")} />
          <FilterPill label="대기중" active={filter === "idle"} onClick={() => setFilter("idle")} />
          <FilterPill label="게임 대기중" active={filter === "gameWaiting"} onClick={() => setFilter("gameWaiting")} />
          <FilterPill label="게임중" active={filter === "playing"} onClick={() => setFilter("playing")} />
        </div>

        {/* 참여자 목록 */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          <div className="grid grid-cols-2 gap-2">
            {selectableParticipants.map((p) => {
              const member = getMember(p.memberId);
              if (!member) return null;
              const isSelected = selectedIds.includes(p.memberId);
              const isMale = member.gender === "male";
              const levelInfo = scoreToLevelInfo(member.level);
              const isInWaitingGame = waitingGamePlayerIds.has(p.memberId);

              return (
                <button
                  key={p.memberId}
                  onClick={() => toggleSelect(p.memberId)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-colors ${
                    isSelected
                      ? isMale
                        ? "border-[var(--color-primary)] bg-blue-50"
                        : "border-pink-400 bg-pink-50"
                      : "border-[var(--color-border)] bg-white"
                  } ${!isSelected && selectedIds.length >= 4 ? "opacity-40" : ""}`}
                  disabled={!isSelected && selectedIds.length >= 4}
                >
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${
                      isMale ? "text-[var(--color-primary)]" : "text-pink-600"
                    }`}>{member.name}</p>
                    <p className="text-[12px] text-[var(--color-text-muted)]">
                      {levelInfo.display}
                      {p.status === "playing" && <span className="text-[var(--color-accent)]"> · 게임중</span>}
                      {isInWaitingGame && <span className="text-amber-600"> · 게임 대기중</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-[13px] font-bold text-[var(--color-primary)]">
                      {calculateGPH(p).toFixed(1)}/h
                    </span>
                    {p.status !== "playing" && (
                      <p className="text-[12px] text-[var(--color-text-muted)]">
                        대기 {calculateWaitMinutes(p)}분
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="px-6 py-4 border-t border-[var(--color-border)]">
          <button
            onClick={createGame}
            disabled={selectedIds.length !== 4}
            className="w-full py-4 bg-[var(--color-accent)] text-white rounded-xl text-sm font-bold disabled:bg-gray-300 disabled:cursor-not-allowed active:bg-[var(--color-accent-dark)]"
          >
            {selectedIds.length === 4
              ? (editingGameId ? "게임 수정" : "게임 생성")
              : `${editingGameId ? "게임 수정" : "게임 생성"} (${selectedIds.length}/4명 선택)`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Slot({ member, index, isNext, onRemove }: { member: Member | null; index: number; isNext: boolean; onRemove: () => void }) {
  if (member) {
    const isMale = member.gender === "male";
    return (
      <div
        className={`flex-1 h-10 rounded-lg flex items-center justify-center text-[11px] font-semibold border-2 relative ${
          isMale ? "border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]" : "border-pink-400 bg-pink-50 text-pink-600"
        }`}
      >
        {member.name}
        <button
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-gray-400 text-white rounded-full text-[9px] flex items-center justify-center"
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex-1 h-10 rounded-lg border-2 border-dashed flex items-center justify-center text-[11px] ${
        isNext ? "border-[var(--color-primary)] bg-blue-50/30 text-[var(--color-primary)]" : "border-[var(--color-border)] text-[var(--color-text-muted)]"
      }`}
    >
      {index + 1}번
    </div>
  );
}

function FilterPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors ${
        active
          ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
          : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border)]"
      }`}
    >
      {label}
    </button>
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
  return Math.floor((new Date().getTime() - reference.getTime()) / 60000);
}
