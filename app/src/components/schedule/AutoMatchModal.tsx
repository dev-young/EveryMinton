"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Schedule, Participant, Member, Game, MatchingPriority } from "@/types";
import { gameRepository } from "@/repositories";
import { generateMatches } from "@/lib/matching";
import { scoreToLevelInfo } from "@/lib/level";
import { useToast } from "@/components/Toast";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

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
  const closedRef = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragging = useRef(false);
  const dragCurrentY = useRef(0);

  const [includePlayingMembers, setIncludePlayingMembers] = useState(false);

  // 빈 코트 수 계산
  const inProgressGames = games.filter((g) => g.status === "in_progress");
  const emptyCourts = schedule.courtCount - inProgressGames.length;

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

  // 미리보기 생성
  function generatePreview() {
    const results = generateMatches(participants, members, games, priorities, {
      includePlayingMembers,
      gameCount,
    });
    setPreview(results);
  }

  // 미리보기 자동 생성
  useEffect(() => {
    generatePreview();
  }, [includePlayingMembers, gameCount, participants, members, games, priorities]);

  function getMember(id: string): Member | undefined {
    return members.find((m) => m.id === id);
  }

  function getParticipant(id: string): Participant | undefined {
    return participants.find((p) => p.memberId === id);
  }

  function getGPH(id: string): string {
    const p = getParticipant(id);
    if (!p || !p.joinedAt) return "0.0";
    const now = new Date();
    const minutes = (now.getTime() - p.joinedAt.getTime()) / 60000;
    if (minutes <= 0) return "0.0";
    return ((p.gamesPlayed / minutes) * 60).toFixed(1);
  }

  async function handleConfirm() {
    if (preview.length === 0) {
      showToast("생성할 게임이 없습니다.");
      return;
    }

    setSaving(true);
    try {
      for (const match of preview) {
        await gameRepository.create(scheduleId, {
          courtNumber: 0,
          status: "waiting",
          team1: match.team1,
          team2: match.team2,
          startedAt: null,
          endedAt: null,
        });
      }

      if (!closedRef.current) {
        closedRef.current = true;
        window.history.back();
        onSaved();
      }
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
            <button onClick={closeModal} className="text-xl text-[var(--color-text-muted)] px-1">✕</button>
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
                  className="w-7 h-7 rounded-md border border-[var(--color-border)] text-sm font-bold text-[var(--color-text-secondary)]"
                >
                  −
                </button>
                <span className="text-sm font-bold w-4 text-center">{gameCount}</span>
                <button
                  onClick={() => setGameCount(gameCount + 1)}
                  className="w-7 h-7 rounded-md border border-[var(--color-border)] text-sm font-bold text-[var(--color-text-secondary)]"
                >
                  +
                </button>
              </div>
            </div>

            {/* 정보 */}
            <p className="text-[11px] text-[var(--color-text-muted)]">
              대기 인원: {waitingCount}명 · 빈 코트: {emptyCourts}면
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
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    <div className="flex gap-1">
                      {match.team1.map((id) => {
                        const m = getMember(id);
                        if (!m) return null;
                        const isMale = m.gender === "male";
                        const levelInfo = scoreToLevelInfo(m.level);
                        return (
                          <span key={id} className={`text-xs px-2 py-1.5 rounded-md font-medium flex flex-col items-center ${isMale ? "bg-blue-50 text-[var(--color-primary)]" : "bg-pink-50 text-pink-600"}`}>
                            <span>{m.name}</span>
                            <span className="text-[9px] opacity-60">{levelInfo.display} · {getGPH(id)}/h</span>
                          </span>
                        );
                      })}
                    </div>
                    <span className="text-[11px] font-bold text-[var(--color-text-muted)]">VS</span>
                    <div className="flex gap-1">
                      {match.team2.map((id) => {
                        const m = getMember(id);
                        if (!m) return null;
                        const isMale = m.gender === "male";
                        const levelInfo = scoreToLevelInfo(m.level);
                        return (
                          <span key={id} className={`text-xs px-2 py-1.5 rounded-md font-medium flex flex-col items-center ${isMale ? "bg-blue-50 text-[var(--color-primary)]" : "bg-pink-50 text-pink-600"}`}>
                            <span>{m.name}</span>
                            <span className="text-[9px] opacity-60">{levelInfo.display} · {getGPH(id)}/h</span>
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
