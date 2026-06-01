"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { Schedule, Game, Participant, Member } from "@/types";
import { gameRepository, participantRepository } from "@/repositories";
import { scoreToLevelInfo, scoreToViewLevelDisplay } from "@/lib/level";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Props {
  scheduleId: string;
  schedule: Schedule;
  games: Game[];
  participants: Participant[];
  getMember: (id: string) => Member | undefined;
  readOnly?: boolean;
  onManualMatch?: () => void;
  onAutoMatch?: () => void;
  onEditGame?: (playerIds: string[], gameId: string) => void;
  onRefresh?: () => void;
}

export function CourtsTab({
  scheduleId,
  schedule,
  games,
  participants,
  getMember,
  readOnly = false,
  onManualMatch,
  onAutoMatch,
  onEditGame,
  onRefresh,
}: Props) {
  const { showToast } = useToast();
  const [endingGameId, setEndingGameId] = useState<string | null>(null);
  const [cancellingGameId, setCancellingGameId] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick((value) => value + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const participantMap = useMemo(
    () => new Map(participants.map((participant) => [participant.memberId, participant])),
    [participants]
  );
  const gameIndexMap = useMemo(
    () => new Map(games.map((game, index) => [game.id, index])),
    [games]
  );

  const inProgressGames = games.filter((game) => game.status === "in_progress");
  const waitingGames = games
    .filter((game) => game.status === "waiting")
    .sort((a, b) => {
      const aCreatedAt = a.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const bCreatedAt = b.createdAt?.getTime() ?? Number.POSITIVE_INFINITY;
      const createdAtDiff = aCreatedAt - bCreatedAt;
      if (createdAtDiff !== 0) return createdAtDiff;

      const indexDiff = (gameIndexMap.get(a.id) ?? 0) - (gameIndexMap.get(b.id) ?? 0);
      if (indexDiff !== 0) return indexDiff;

      return a.id.localeCompare(b.id);
    });

  const isCourtCountUnset = schedule.courtCount === null;
  const fixedCourtCount = schedule.courtCount ?? 0;
  const courtNumbers = isCourtCountUnset
    ? [...new Set(inProgressGames.map((game) => game.courtNumber).filter((courtNumber) => courtNumber > 0))].sort(
        (a, b) => a - b
      )
    : Array.from({ length: fixedCourtCount }, (_, index) => index + 1);
  const courts = courtNumbers.map((courtNumber) => ({
    courtNumber,
    game: inProgressGames.find((item) => item.courtNumber === courtNumber) ?? null,
  }));

  function getAvailableCourt(): number | null {
    const usedCourts = new Set(inProgressGames.map((game) => game.courtNumber));
    if (isCourtCountUnset) {
      let courtNumber = 1;
      while (usedCourts.has(courtNumber)) {
        courtNumber += 1;
      }
      return courtNumber;
    }

    for (let courtNumber = 1; courtNumber <= fixedCourtCount; courtNumber += 1) {
      if (!usedCourts.has(courtNumber)) return courtNumber;
    }
    return null;
  }

  async function startGame(gameId: string) {
    try {
      const game = games.find((item) => item.id === gameId);
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

      await participantRepository.updateMany(
        scheduleId,
        [...game.team1, ...game.team2].map((memberId) => ({
          memberId,
          data: { status: "playing" },
        }))
      );

      onRefresh?.();
    } catch (error) {
      console.error("게임 시작 실패:", error);
      showToast("게임 시작에 실패했습니다.");
    }
  }

  async function endGame(gameId: string) {
    try {
      const game = games.find((item) => item.id === gameId);
      if (!game) return;

      const now = new Date();
      await gameRepository.update(scheduleId, gameId, {
        status: "completed",
        endedAt: now,
      });

      await participantRepository.updateMany(
        scheduleId,
        [...game.team1, ...game.team2].map((memberId) => {
          const participant = participantMap.get(memberId);
          return {
            memberId,
            data: {
              status: "waiting",
              gamesPlayed: (participant?.gamesPlayed ?? 0) + 1,
              lastGameEndedAt: now,
            },
          };
        })
      );

      setEndingGameId(null);
      onRefresh?.();
      showToast("게임이 종료되었습니다.", "success");
    } catch (error) {
      console.error("게임 종료 실패:", error);
      showToast("게임 종료에 실패했습니다.");
    }
  }

  async function cancelInProgressGame(gameId: string) {
    try {
      const game = games.find((item) => item.id === gameId);
      if (!game) return;

      await gameRepository.update(scheduleId, gameId, {
        status: "waiting",
        courtNumber: 0,
        startedAt: null,
      });

      await participantRepository.updateMany(
        scheduleId,
        [...game.team1, ...game.team2].map((memberId) => ({
          memberId,
          data: { status: "waiting" },
        }))
      );

      setCancellingGameId(null);
      onRefresh?.();
      showToast("게임이 취소되었습니다.", "info");
    } catch (error) {
      console.error("게임 취소 실패:", error);
      showToast("게임 취소에 실패했습니다.");
    }
  }

  async function cancelGame(gameId: string) {
    try {
      await gameRepository.delete(scheduleId, gameId);
      onRefresh?.();
      showToast("게임이 취소되었습니다.", "info");
    } catch (error) {
      console.error("게임 취소 실패:", error);
      showToast("게임 취소에 실패했습니다.");
    }
  }

  const emptyCourts = isCourtCountUnset ? null : courts.filter(({ game }) => game === null).length;
  const endingGame = endingGameId ? games.find((game) => game.id === endingGameId) : null;

  return (
    <div className="pb-20">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-bold">코트 현황</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          사용 {inProgressGames.length} / 전체 {isCourtCountUnset ? "미정" : schedule.courtCount}
        </p>
      </div>

      {courts.length === 0 && isCourtCountUnset && (
        <div className="mb-3 rounded-xl border border-dashed border-[var(--color-border)] bg-white px-4 py-6 text-center text-xs text-[var(--color-text-muted)]">
          진행중인 게임이 없습니다.
        </div>
      )}

      {courts.map(({ courtNumber, game }) => {
        let longPressTimer: ReturnType<typeof setTimeout> | null = null;

        function clearLongPress() {
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        }

        const longPressHandlers =
          game && !readOnly
            ? {
                onPointerDown: () => {
                  longPressTimer = setTimeout(() => {
                    setCancellingGameId(game.id);
                  }, 600);
                },
                onPointerUp: clearLongPress,
                onPointerLeave: clearLongPress,
                onPointerCancel: clearLongPress,
                onPointerMove: clearLongPress,
              }
            : {};

        return (
          <div
            key={courtNumber}
            className={`mb-3 rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm ${
              game && !readOnly ? "select-none" : ""
            }`}
            {...longPressHandlers}
          >
            {game ? (
              <div>
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="text-sm font-bold">코트 {courtNumber}</span>
                    <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-accent)]">
                      진행중 : {game.startedAt && formatElapsed(game.startedAt)}
                    </span>
                  </div>
                  {!readOnly && (
                    <button
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => setEndingGameId(game.id)}
                      className="shrink-0 rounded-md bg-[var(--color-danger)] px-2.5 py-1 text-[10px] font-semibold text-white"
                    >
                      종료
                    </button>
                  )}
                </div>
                <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
                  <div className="grid min-w-0 grid-cols-2 gap-1">
                    {game.team1.map((id) => (
                      <PlayerChip key={id} member={getMember(id)} fill readOnly={readOnly} />
                    ))}
                  </div>
                  <span className="self-center text-[9.5px] font-bold text-[var(--color-text-muted)]">VS</span>
                  <div className="grid min-w-0 grid-cols-2 gap-1">
                    {game.team2.map((id) => (
                      <PlayerChip key={id} member={getMember(id)} fill readOnly={readOnly} />
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-sm font-bold">코트 {courtNumber}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]">
                    비어있음
                  </span>
                </div>
                <div className="py-2 text-center text-xs text-[var(--color-text-muted)]">배정된 게임 없음</div>
              </div>
            )}
          </div>
        );
      })}

      {waitingGames.length > 0 && (
        <div className="mt-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">대기중인 게임</p>
              <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">등록된 순서대로 표시</p>
            </div>
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
              {waitingGames.length}개
            </span>
          </div>

          {waitingGames.map((game) => {
            const playerIds = [...game.team1, ...game.team2];
            const hasPlayingMember = playerIds.some((id) => {
              const participant = participantMap.get(id);
              return participant?.status === "playing";
            });
            const canStart = (isCourtCountUnset || (emptyCourts ?? 0) > 0) && !hasPlayingMember;

            function handleEditGame() {
              onEditGame?.(playerIds, game.id);
            }

            const editHandlers = readOnly
              ? {}
              : {
                  role: "button" as const,
                  tabIndex: 0,
                  onClick: handleEditGame,
                  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleEditGame();
                    }
                  },
                  "aria-label": "대기중인 게임 수정",
                };

            return (
              <div
                key={game.id}
                className={`mb-3 rounded-xl border border-[var(--color-border)] border-l-4 border-l-amber-400 bg-white p-4 shadow-sm ${
                  readOnly ? "" : "cursor-pointer select-none active:bg-amber-50/40"
                }`}
                {...editHandlers}
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
                      <div className="grid min-w-0 grid-cols-2 gap-1">
                        {game.team1.map((id) => (
                          <PlayerChipDetail
                            key={id}
                            member={getMember(id)}
                            participant={participantMap.get(id)}
                            fill
                            readOnly={readOnly}
                          />
                        ))}
                      </div>
                      <span className="self-center text-[9.5px] font-bold text-[var(--color-text-muted)]">VS</span>
                      <div className="grid min-w-0 grid-cols-2 gap-1">
                        {game.team2.map((id) => (
                          <PlayerChipDetail
                            key={id}
                            member={getMember(id)}
                            participant={participantMap.get(id)}
                            fill
                            readOnly={readOnly}
                          />
                        ))}
                      </div>
                    </div>
                    {hasPlayingMember && <p className="mt-2 text-[11px] text-gray-500">⚠ 게임중인 인원 포함</p>}
                  </div>

                  {!readOnly && (
                    <div className="flex flex-col gap-1.5" onClick={(event) => event.stopPropagation()}>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          startGame(game.id);
                        }}
                        disabled={!canStart}
                        className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        시작
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          cancelGame(game.id);
                        }}
                        className="rounded-md bg-[#f1f5f8] px-3 py-1.5 text-[10px] font-semibold text-[var(--color-text-secondary)]"
                      >
                        취소
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && onManualMatch && onAutoMatch && (
        <div className="fixed bottom-5 left-1/2 z-30 flex w-[calc(100%-32px)] max-w-3xl -translate-x-1/2 gap-2">
          <button
            onClick={onAutoMatch}
            className="flex-1 rounded-xl bg-[var(--color-accent)] py-3.5 text-sm font-bold text-white shadow-lg active:bg-[var(--color-accent-dark)]"
          >
            ⚡ 자동 매칭
          </button>
          <button
            onClick={onManualMatch}
            className="flex-1 rounded-xl bg-[var(--color-primary)] py-3.5 text-sm font-bold text-white shadow-lg active:bg-[var(--color-primary-dark)]"
          >
            ✋ 수동 매칭
          </button>
        </div>
      )}

      {endingGameId && (
        <ConfirmDialog
          title="게임 종료"
          message={`코트${endingGame?.courtNumber ?? ""} 경기를 종료하시겠습니까?`}
          confirmLabel="종료"
          danger
          onCancel={() => setEndingGameId(null)}
          onConfirm={() => endGame(endingGameId)}
        />
      )}

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

function PlayerChip({
  member,
  fill = false,
  readOnly = false,
}: {
  member: Member | undefined;
  fill?: boolean;
  readOnly?: boolean;
}) {
  if (!member) return null;

  const isMale = member.gender === "male";
  const levelInfo = scoreToLevelInfo(member.level);
  const levelDisplay = readOnly ? scoreToViewLevelDisplay(member.level) : `${levelInfo.grade}조`;

  return (
    <span
      className={`flex min-w-0 flex-col items-center rounded-md px-1.5 py-1 ${fill ? "w-full" : ""} ${
        isMale ? "bg-blue-50 text-[var(--color-primary)]" : "bg-pink-50 text-pink-600"
      }`}
    >
      <span className="max-w-full truncate text-sm font-bold">{member.name}</span>
      <span className="text-[9.5px] opacity-60">{levelDisplay}</span>
    </span>
  );
}

function PlayerChipDetail({
  member,
  participant,
  fill = false,
  readOnly = false,
}: {
  member: Member | undefined;
  participant: Participant | undefined;
  fill?: boolean;
  readOnly?: boolean;
}) {
  if (!member) return null;

  const isMale = member.gender === "male";
  const levelInfo = scoreToLevelInfo(member.level);
  const levelDisplay = readOnly ? scoreToViewLevelDisplay(member.level) : levelInfo.display;
  const gph = participant ? calculateGPH(participant) : 0;
  const isPlaying = participant?.status === "playing";
  const bgColor = isPlaying
    ? `bg-gray-100 ${isMale ? "text-[var(--color-primary)]" : "text-pink-600"}`
    : isMale
      ? "bg-blue-50 text-[var(--color-primary)]"
      : "bg-pink-50 text-pink-600";

  return (
    <span className={`flex min-w-0 flex-col items-center rounded-md px-1.5 py-1 ${fill ? "w-full" : ""} ${bgColor}`}>
      <span className="max-w-full truncate text-sm font-bold">{member.name}</span>
      <span className="max-w-full truncate text-[9.5px] opacity-60">
        {levelDisplay} · {gph.toFixed(1)}/h
      </span>
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
