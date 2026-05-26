"use client";

import { useState, useEffect } from "react";
import { Schedule, Game, Participant, Member } from "@/types";
import { gameRepository, participantRepository } from "@/repositories";
import { scoreToLevelInfo } from "@/lib/level";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Props {
  scheduleId: string;
  schedule: Schedule;
  games: Game[];
  participants: Participant[];
  getMember: (id: string) => Member | undefined;
  onManualMatch: () => void;
  onAutoMatch: () => void;
  onEditGame: (playerIds: string[], gameId: string) => void;
  onRefresh: () => void;
}

export function CourtsTab({ scheduleId, schedule, games, participants, getMember, onManualMatch, onAutoMatch, onEditGame, onRefresh }: Props) {
  const { showToast } = useToast();
  const [endingGameId, setEndingGameId] = useState<string | null>(null);
  const [cancellingGameId, setCancellingGameId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // 1분마다 리렌더링하여 경과 시간 업데이트
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const inProgressGames = games.filter((g) => g.status === "in_progress");
  const waitingGames = games
    .filter((g) => g.status === "waiting")
    .sort((a, b) => {
      const aMinGph = Math.min(...[...a.team1, ...a.team2].map((id) => {
        const p = participants.find((pt) => pt.memberId === id);
        return p ? calculateGPH(p) : Infinity;
      }));
      const bMinGph = Math.min(...[...b.team1, ...b.team2].map((id) => {
        const p = participants.find((pt) => pt.memberId === id);
        return p ? calculateGPH(p) : Infinity;
      }));
      return aMinGph - bMinGph;
    });

  // 코트별 진행중 게임 매핑
  const courts: (Game | null)[] = [];
  for (let i = 1; i <= schedule.courtCount; i++) {
    const game = inProgressGames.find((g) => g.courtNumber === i) ?? null;
    courts.push(game);
  }

  // 빈 코트 번호 찾기
  function getAvailableCourt(): number | null {
    const usedCourts = new Set(inProgressGames.map((g) => g.courtNumber));
    for (let i = 1; i <= schedule.courtCount; i++) {
      if (!usedCourts.has(i)) return i;
    }
    return null;
  }

  async function startGame(gameId: string) {
    try {
      const game = games.find((g) => g.id === gameId);
      if (!game) return;

      const courtNumber = getAvailableCourt();
      if (courtNumber === null) {
        showToast("빈 코트가 없습니다.");
        return;
      }

      await gameRepository.update(scheduleId, gameId, {
        status: "in_progress",
        courtNumber,
        startedAt: new Date(),
      });

      // 배정된 4명을 '게임중'으로 전환
      const playerIds = [...game.team1, ...game.team2];
      for (const memberId of playerIds) {
        await participantRepository.update(scheduleId, memberId, { status: "playing" });
      }

      onRefresh();
    } catch (error) {
      console.error("게임 시작 실패:", error);
      showToast("게임 시작에 실패했습니다.");
    }
  }

  async function endGame(gameId: string) {
    try {
      const game = games.find((g) => g.id === gameId);
      if (!game) return;

      const now = new Date();
      await gameRepository.update(scheduleId, gameId, {
        status: "completed",
        endedAt: now,
      });

      // 배정된 4명을 '대기중'으로 전환 + 게임 수 증가
      const playerIds = [...game.team1, ...game.team2];
      for (const memberId of playerIds) {
        const participant = participants.find((p) => p.memberId === memberId);
        await participantRepository.update(scheduleId, memberId, {
          status: "waiting",
          gamesPlayed: (participant?.gamesPlayed ?? 0) + 1,
          lastGameEndedAt: now,
        });
      }

      setEndingGameId(null);
      onRefresh();
      showToast("게임이 종료되었습니다.", "success");
    } catch (error) {
      console.error("게임 종료 실패:", error);
      showToast("게임 종료에 실패했습니다.");
    }
  }

  async function cancelInProgressGame(gameId: string) {
    try {
      const game = games.find((g) => g.id === gameId);
      if (!game) return;

      // 게임을 대기 상태로 되돌림
      await gameRepository.update(scheduleId, gameId, {
        status: "waiting",
        courtNumber: 0,
        startedAt: null,
      });

      // 배정된 4명을 '대기중'으로 전환
      const playerIds = [...game.team1, ...game.team2];
      for (const memberId of playerIds) {
        await participantRepository.update(scheduleId, memberId, { status: "waiting" });
      }

      setCancellingGameId(null);
      onRefresh();
      showToast("게임이 취소되었습니다.", "info");
    } catch (error) {
      console.error("게임 취소 실패:", error);
      showToast("게임 취소에 실패했습니다.");
    }
  }

  async function cancelGame(gameId: string) {
    try {
      await gameRepository.delete(scheduleId, gameId);
      onRefresh();
      showToast("게임이 취소되었습니다.", "info");
    } catch (error) {
      console.error("게임 취소 실패:", error);
      showToast("게임 취소에 실패했습니다.");
    }
  }

  const emptyCourts = courts.filter((g) => g === null).length;

  return (
    <div className="pb-20">
      {/* 코트 현황 */}
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm font-bold">코트 현황</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          사용 {inProgressGames.length} / 전체 {schedule.courtCount}
        </p>
      </div>

      {courts.map((game, index) => (
        <div key={index} className="bg-white rounded-xl border border-[var(--color-border)] p-4 mb-3 shadow-sm">
          {game ? (
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-bold">코트 {index + 1}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-50 text-[var(--color-accent)] font-semibold">
                    진행중 : {game.startedAt && formatElapsed(game.startedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex gap-1">
                    {game.team1.map((id) => <PlayerChip key={id} member={getMember(id)} />)}
                  </div>
                  <span className="text-[9.5px] font-bold text-[var(--color-text-muted)]">VS</span>
                  <div className="flex gap-1">
                    {game.team2.map((id) => <PlayerChip key={id} member={getMember(id)} />)}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setEndingGameId(game.id)}
                  className="px-2.5 py-1 bg-[var(--color-danger)] text-white rounded-md text-[10px] font-semibold"
                >
                  종료
                </button>
                <button
                  onClick={() => setCancellingGameId(game.id)}
                  className="px-2.5 py-1 bg-[#f1f5f8] text-[var(--color-text-secondary)] rounded-md text-[10px] font-semibold"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold">코트 {index + 1}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-[var(--color-text-muted)] font-semibold">
                  비어있음
                </span>
              </div>
              <div className="text-center py-2 text-xs text-[var(--color-text-muted)]">
                배정된 게임 없음
              </div>
            </div>
          )}
        </div>
      ))}

      {/* 대기중인 게임 */}
      {waitingGames.length > 0 && (
        <div className="mt-5">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm font-bold">대기중인 게임</p>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-semibold">
              {waitingGames.length}개
            </span>
          </div>

          {waitingGames.map((game) => {
            const playerIds = [...game.team1, ...game.team2];
            const hasPlayingMember = playerIds.some((id) => {
              const p = participants.find((p) => p.memberId === id);
              return p?.status === "playing";
            });
            const canStart = emptyCourts > 0 && !hasPlayingMember;

            let longPressTimer: ReturnType<typeof setTimeout> | null = null;

            function handleTouchStart() {
              longPressTimer = setTimeout(() => {
                onEditGame(playerIds, game.id);
              }, 600);
            }

            function handleTouchEnd() {
              if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
              }
            }

            return (
              <div
                key={game.id}
                className="bg-white rounded-xl border border-[var(--color-border)] p-4 mb-3 shadow-sm border-l-4 border-l-amber-400"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
              >
                <div className="flex items-center gap-3">
                  {/* 팀 표시 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex gap-1">
                        {game.team1.map((id) => <PlayerChipDetail key={id} member={getMember(id)} participant={participants.find((p) => p.memberId === id)} />)}
                      </div>
                      <span className="text-[9.5px] font-bold text-[var(--color-text-muted)]">VS</span>
                      <div className="flex gap-1">
                        {game.team2.map((id) => <PlayerChipDetail key={id} member={getMember(id)} participant={participants.find((p) => p.memberId === id)} />)}
                      </div>
                    </div>
                    {hasPlayingMember && (
                      <p className="text-[11px] text-gray-500 mt-2">⚠ 게임중인 인원 포함</p>
                    )}
                  </div>

                  {/* 버튼 (우측 세로 나열) */}
                  <div className="flex flex-col gap-1.5">
                    <button
                      onClick={() => startGame(game.id)}
                      disabled={!canStart}
                      className="px-3 py-1.5 bg-[var(--color-accent)] text-white rounded-md text-[10px] font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                      시작
                    </button>
                    <button
                      onClick={() => cancelGame(game.id)}
                      className="px-3 py-1.5 bg-[#f1f5f8] text-[var(--color-text-secondary)] rounded-md text-[10px] font-semibold"
                    >
                      취소
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 하단 플로팅 버튼 */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 flex gap-2 z-30 max-w-3xl w-[calc(100%-32px)]">
        <button
          onClick={onAutoMatch}
          className="flex-1 py-3.5 bg-[var(--color-accent)] text-white rounded-xl text-sm font-bold active:bg-[var(--color-accent-dark)] shadow-lg"
        >
          ⚡ 자동 매칭
        </button>
        <button
          onClick={onManualMatch}
          className="flex-1 py-3.5 bg-[var(--color-primary)] text-white rounded-xl text-sm font-bold active:bg-[var(--color-primary-dark)] shadow-lg"
        >
          ✋ 수동 매칭
        </button>
      </div>

      {/* 게임 종료 확인 */}
      {endingGameId && (
        <ConfirmDialog
          title="게임 종료"
          message="이 게임을 종료하시겠습니까?"
          confirmLabel="종료"
          danger
          onCancel={() => setEndingGameId(null)}
          onConfirm={() => endGame(endingGameId)}
        />
      )}

      {/* 게임 취소 확인 */}
      {cancellingGameId && (
        <ConfirmDialog
          title="게임 취소"
          message="이 게임을 취소하고 대기 상태로 되돌리시겠습니까?"
          confirmLabel="되돌리기"
          cancelLabel="닫기"
          danger
          onCancel={() => setCancellingGameId(null)}
          onConfirm={() => cancelInProgressGame(cancellingGameId)}
        />
      )}
    </div>
  );
}

function PlayerChip({ member }: { member: Member | undefined }) {
  if (!member) return null;
  const isMale = member.gender === "male";
  const levelInfo = scoreToLevelInfo(member.level);
  return (
    <span
      className={`px-1.5 py-1 rounded-md flex flex-col items-center ${
        isMale ? "bg-blue-50 text-[var(--color-primary)]" : "bg-pink-50 text-pink-600"
      }`}
    >
      <span className="text-sm font-bold">{member.name}</span>
      <span className="text-[9.5px] opacity-60">{levelInfo.grade}조</span>
    </span>
  );
}

function PlayerChipDetail({ member, participant }: { member: Member | undefined; participant: Participant | undefined }) {
  if (!member) return null;
  const isMale = member.gender === "male";
  const levelInfo = scoreToLevelInfo(member.level);
  const gph = participant ? calculateGPH(participant) : 0;
  const isPlaying = participant?.status === "playing";
  const bgColor = isPlaying
    ? `bg-gray-100 ${isMale ? "text-[var(--color-primary)]" : "text-pink-600"}`
    : isMale
    ? "bg-blue-50 text-[var(--color-primary)]"
    : "bg-pink-50 text-pink-600";
  return (
    <span className={`px-1.5 py-1 rounded-md flex flex-col items-center ${bgColor}`}>
      <span className="text-sm font-bold">{member.name}</span>
      <span className="text-[9.5px] opacity-60">{levelInfo.display} · {gph.toFixed(1)}/h</span>
    </span>
  );
}

function calculateGPH(participant: Participant): number {
  if (!participant.joinedAt) return 0;
  const now = new Date();
  const minutesElapsed = (now.getTime() - participant.joinedAt.getTime()) / 60000;
  if (minutesElapsed <= 0) return 0;
  return (participant.gamesPlayed / minutesElapsed) * 60;
}

function formatElapsed(startedAt: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - startedAt.getTime();
  const minutes = Math.floor(diffMs / 60000);
  return `${minutes}분`;
}
