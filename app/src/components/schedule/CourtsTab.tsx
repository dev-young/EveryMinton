"use client";

import { useEffect, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Schedule, Game, Participant, Member } from "@/types";
import { gameRepository, participantRepository } from "@/repositories";
import { scoreToLevelInfo, scoreToViewLevelDisplay } from "@/lib/level";
import { calculateGamesPerHour, getScheduleStatReferenceAt } from "@/lib/participantStats";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AutoMatchIcon, DragHandleIcon, ManualMatchIcon } from "@/components/icons";

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

interface EndGameSnapshot {
  game: Game;
  participants: Participant[];
  endedAt: Date;
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
  const [endingGameIds, setEndingGameIds] = useState<Set<string>>(() => new Set());
  const [cancellingGameId, setCancellingGameId] = useState<string | null>(null);
  const [isReorderingWaitingGames, setIsReorderingWaitingGames] = useState(false);
  const [orderedWaitingGameIds, setOrderedWaitingGameIds] = useState<string[]>([]);
  const [draggingWaitingGameId, setDraggingWaitingGameId] = useState<string | null>(null);
  const [savingWaitingOrder, setSavingWaitingOrder] = useState(false);
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
  const statReferenceAt = getScheduleStatReferenceAt(schedule);
  const playingGameByMemberId = new Map<string, Game>();
  inProgressGames.forEach((game) => {
    [...game.team1, ...game.team2].forEach((memberId) => {
      playingGameByMemberId.set(memberId, game);
    });
  });
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
  const waitingGameById = new Map(waitingGames.map((game) => [game.id, game]));
  const displayedWaitingGames = isReorderingWaitingGames
    ? [
        ...orderedWaitingGameIds
          .map((gameId) => waitingGameById.get(gameId))
          .filter((game): game is Game => game !== undefined),
        ...waitingGames.filter((game) => !orderedWaitingGameIds.includes(game.id)),
      ]
    : waitingGames;

  const isCourtCountUnset = schedule.courtCount === null;
  const fixedCourtCount = schedule.courtCount ?? 0;
  const courts = isCourtCountUnset
    ? [...inProgressGames]
        .sort((a, b) => compareByStartedAt(a, b, gameIndexMap))
        .map((game) => ({
          courtNumber: game.courtNumber,
          game,
        }))
    : Array.from({ length: fixedCourtCount }, (_, index) => {
        const courtNumber = index + 1;
        return {
          courtNumber,
          game: inProgressGames.find((item) => item.courtNumber === courtNumber) ?? null,
        };
      });

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
    if (endingGameIds.has(gameId)) return;

    setEndingGameIds((prev) => {
      const next = new Set(prev);
      next.add(gameId);
      return next;
    });

    try {
      const game =
        (await gameRepository.getById(scheduleId, gameId)) ??
        games.find((item) => item.id === gameId);
      if (!game || game.status !== "in_progress") {
        showToast("진행중인 게임을 찾을 수 없습니다.");
        return;
      }

      const playerIds = [...game.team1, ...game.team2];
      const participantSnapshots = await Promise.all(
        playerIds.map(async (memberId) => {
          const participant = await participantRepository.get(scheduleId, memberId);
          return participant ?? participantMap.get(memberId) ?? null;
        })
      );

      const participantsBeforeEnd = participantSnapshots.filter(
        (participant): participant is Participant => participant !== null
      );

      if (participantsBeforeEnd.length !== playerIds.length) {
        showToast("참여자 정보를 불러오지 못했습니다.");
        return;
      }

      const now = new Date();
      const snapshot: EndGameSnapshot = {
        game: copyGame(game),
        participants: participantsBeforeEnd.map((participant) => copyParticipant(participant)),
        endedAt: now,
      };
      const participantSnapshotMap = new Map(
        snapshot.participants.map((participant) => [participant.memberId, participant])
      );

      await gameRepository.update(scheduleId, gameId, {
        status: "completed",
        endedAt: now,
      });

      await participantRepository.updateMany(
        scheduleId,
        [...game.team1, ...game.team2].map((memberId) => {
          const participant = participantSnapshotMap.get(memberId);
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

      onRefresh?.();
      showToast("게임이 종료되었습니다.", "success", {
        label: "실행 취소",
        onClick: () => undoEndGame(snapshot),
      });
    } catch (error) {
      console.error("게임 종료 실패:", error);
      showToast("게임 종료에 실패했습니다.");
    } finally {
      setEndingGameIds((prev) => {
        const next = new Set(prev);
        next.delete(gameId);
        return next;
      });
    }
  }

  async function undoEndGame(snapshot: EndGameSnapshot) {
    try {
      const currentGame = await gameRepository.getById(scheduleId, snapshot.game.id);
      if (!canRestoreEndedGame(currentGame, snapshot)) {
        showToast("실행 취소할 수 없는 상태입니다.");
        return;
      }

      await participantRepository.updateMany(
        scheduleId,
        snapshot.participants.map((participant) => ({
          memberId: participant.memberId,
          data: {
            status: participant.status,
            joinedAt: participant.joinedAt,
            leftAt: participant.leftAt,
            gamesPlayed: participant.gamesPlayed,
            lastGameEndedAt: participant.lastGameEndedAt,
          },
        }))
      );

      await gameRepository.update(scheduleId, snapshot.game.id, {
        status: snapshot.game.status,
        courtNumber: snapshot.game.courtNumber,
        team1: snapshot.game.team1,
        team2: snapshot.game.team2,
        startedAt: snapshot.game.startedAt,
        endedAt: snapshot.game.endedAt,
      });

      onRefresh?.();
      showToast("게임 종료를 취소했습니다.", "success");
    } catch (error) {
      console.error("게임 종료 실행 취소 실패:", error);
      showToast("실행 취소에 실패했습니다.");
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

  function startWaitingGameReorder() {
    setOrderedWaitingGameIds(waitingGames.map((game) => game.id));
    setIsReorderingWaitingGames(true);
  }

  function cancelWaitingGameReorder() {
    setOrderedWaitingGameIds(waitingGames.map((game) => game.id));
    setDraggingWaitingGameId(null);
    setIsReorderingWaitingGames(false);
  }

  function moveWaitingGame(draggingGameId: string, targetGameId: string) {
    if (draggingGameId === targetGameId) return;

    setOrderedWaitingGameIds((current) => {
      const waitingIds = waitingGames.map((game) => game.id);
      const next = current.filter((gameId) => waitingIds.includes(gameId));
      waitingIds.forEach((gameId) => {
        if (!next.includes(gameId)) next.push(gameId);
      });

      const fromIndex = next.indexOf(draggingGameId);
      const toIndex = next.indexOf(targetGameId);
      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return current;

      const [draggingId] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, draggingId);
      return next;
    });
  }

  function handleWaitingGameDragStart(event: PointerEvent<HTMLButtonElement>, gameId: string) {
    if (!isReorderingWaitingGames || savingWaitingOrder) return;

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDraggingWaitingGameId(gameId);
  }

  function handleWaitingGameDragMove(event: PointerEvent<HTMLButtonElement>) {
    if (!draggingWaitingGameId || savingWaitingOrder) return;

    event.preventDefault();
    event.stopPropagation();

    const targetElement = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-waiting-game-id]");
    const targetGameId = targetElement?.dataset.waitingGameId;
    if (!targetGameId) return;

    moveWaitingGame(draggingWaitingGameId, targetGameId);
  }

  function handleWaitingGameDragEnd(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setDraggingWaitingGameId(null);
  }

  async function saveWaitingGameOrder() {
    const orderedGames = displayedWaitingGames;
    if (orderedGames.length < 2 || savingWaitingOrder) return;

    const baseCreatedAts = waitingGames.map((game, index) => {
      return game.createdAt ? new Date(game.createdAt.getTime()) : new Date(Date.now() + index);
    });

    const updates = orderedGames
      .map((game, index) => {
        const nextCreatedAt = baseCreatedAts[index];
        const currentCreatedAt = game.createdAt;
        if (currentCreatedAt && currentCreatedAt.getTime() === nextCreatedAt.getTime()) return null;

        return {
          gameId: game.id,
          data: { createdAt: nextCreatedAt },
        };
      })
      .filter((update): update is { gameId: string; data: { createdAt: Date } } => update !== null);

    try {
      setSavingWaitingOrder(true);
      if (updates.length > 0) {
        await gameRepository.updateMany(scheduleId, updates);
      }
      setIsReorderingWaitingGames(false);
      setDraggingWaitingGameId(null);
      onRefresh?.();
      showToast("대기중인 게임 순서를 저장했습니다.", "success");
    } catch (error) {
      console.error("대기중인 게임 순서 저장 실패:", error);
      showToast("순서 저장에 실패했습니다.");
    } finally {
      setSavingWaitingOrder(false);
    }
  }

  const emptyCourts = isCourtCountUnset ? null : courts.filter(({ game }) => game === null).length;
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
                      onClick={() => void endGame(game.id)}
                      disabled={endingGameIds.has(game.id)}
                      className="shrink-0 rounded-md bg-[var(--color-danger)] px-2.5 py-1 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
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
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-sm font-bold">대기중인 게임</p>
            <div className="flex items-center gap-1.5">
              {isReorderingWaitingGames ? (
                <>
                  <button
                    type="button"
                    onClick={cancelWaitingGameReorder}
                    disabled={savingWaitingOrder}
                    className="rounded-md bg-gray-100 px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-text-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveWaitingGameOrder()}
                    disabled={savingWaitingOrder}
                    className="rounded-md bg-[var(--color-primary)] px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-gray-300"
                  >
                    {savingWaitingOrder ? "저장중" : "저장"}
                  </button>
                </>
              ) : (
                <>
                  {!readOnly && waitingGames.length >= 2 && (
                    <button
                      type="button"
                      onClick={startWaitingGameReorder}
                      className="rounded-md bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-600"
                    >
                      순서변경
                    </button>
                  )}
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                    {waitingGames.length}개
                  </span>
                </>
              )}
            </div>
          </div>

          {displayedWaitingGames.map((game) => {
            const playerIds = [...game.team1, ...game.team2];
            const hasPlayingMember = playerIds.some((id) => {
              const participant = participantMap.get(id);
              return participant?.status === "playing";
            });
            function getPlayingElapsed(memberId: string): string | null {
              const participant = participantMap.get(memberId);
              const playingGame = playingGameByMemberId.get(memberId);
              if (participant?.status !== "playing" || !playingGame?.startedAt) return null;

              return formatElapsed(playingGame.startedAt);
            }

            const canStart = (isCourtCountUnset || (emptyCourts ?? 0) > 0) && !hasPlayingMember;

            function handleEditGame() {
              onEditGame?.(playerIds, game.id);
            }

            const editHandlers = readOnly || isReorderingWaitingGames
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

            function renderWaitingPlayer(memberId: string) {
              const participant = participantMap.get(memberId);
              const elapsed = getPlayingElapsed(memberId);

              return (
                <div key={memberId} className="min-w-0">
                  <PlayerChipDetail
                    member={getMember(memberId)}
                    participant={participant}
                    statReferenceAt={statReferenceAt}
                    fill
                    readOnly={readOnly}
                  />
                  {elapsed && (
                    <p className="mt-1 truncate text-center text-[10px] font-medium text-[var(--color-text-muted)]">
                      게임중 {elapsed}
                    </p>
                  )}
                </div>
              );
            }

            return (
              <div
                key={game.id}
                data-waiting-game-id={game.id}
                className={`mb-3 rounded-xl border border-[var(--color-border)] border-l-4 border-l-amber-400 bg-white p-4 shadow-sm ${
                  readOnly || isReorderingWaitingGames ? "" : "cursor-pointer select-none active:bg-amber-50/40"
                } ${
                  draggingWaitingGameId === game.id ? "opacity-70 ring-2 ring-[var(--color-primary)]" : ""
                }`}
                {...editHandlers}
              >
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2">
                      <div className="grid min-w-0 grid-cols-2 gap-1">
                        {game.team1.map((id) => renderWaitingPlayer(id))}
                      </div>
                      <span className="self-center text-[9.5px] font-bold text-[var(--color-text-muted)]">VS</span>
                      <div className="grid min-w-0 grid-cols-2 gap-1">
                        {game.team2.map((id) => renderWaitingPlayer(id))}
                      </div>
                    </div>
                  </div>

                  {!readOnly && (
                    <div className="flex flex-col gap-1.5" onClick={(event) => event.stopPropagation()}>
                      {isReorderingWaitingGames ? (
                        <button
                          type="button"
                          onPointerDown={(event) => handleWaitingGameDragStart(event, game.id)}
                          onPointerMove={handleWaitingGameDragMove}
                          onPointerUp={handleWaitingGameDragEnd}
                          onPointerCancel={handleWaitingGameDragEnd}
                          disabled={savingWaitingOrder}
                          aria-label="대기중인 게임 순서 이동"
                          className="flex h-10 w-10 touch-none items-center justify-center rounded-lg bg-amber-50 text-amber-600 active:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <DragHandleIcon aria-hidden="true" className="h-5 w-5" />
                        </button>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!readOnly && !isReorderingWaitingGames && onManualMatch && onAutoMatch && (
        <div className="fixed bottom-5 left-1/2 z-30 flex w-[calc(100%-32px)] max-w-3xl -translate-x-1/2 gap-2">
          <button
            onClick={onAutoMatch}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--color-accent)] py-3.5 text-sm font-bold text-white shadow-lg active:bg-[var(--color-accent-dark)]"
          >
            <AutoMatchIcon aria-hidden="true" className="h-4 w-4" />
            자동 매칭
          </button>
          <button
            onClick={onManualMatch}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--color-primary)] py-3.5 text-sm font-bold text-white shadow-lg active:bg-[var(--color-primary-dark)]"
          >
            <ManualMatchIcon aria-hidden="true" className="h-4 w-4" />
            수동 매칭
          </button>
        </div>
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
  statReferenceAt,
  fill = false,
  readOnly = false,
}: {
  member: Member | undefined;
  participant: Participant | undefined;
  statReferenceAt: Date;
  fill?: boolean;
  readOnly?: boolean;
}) {
  if (!member) return null;

  const isMale = member.gender === "male";
  const levelInfo = scoreToLevelInfo(member.level);
  const levelDisplay = readOnly ? scoreToViewLevelDisplay(member.level) : levelInfo.display;
  const gph = participant ? calculateGamesPerHour(participant, statReferenceAt) : 0;
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

function copyGame(game: Game): Game {
  return {
    ...game,
    team1: [...game.team1] as [string, string],
    team2: [...game.team2] as [string, string],
    startedAt: copyDate(game.startedAt),
    endedAt: copyDate(game.endedAt),
    createdAt: game.createdAt ? new Date(game.createdAt.getTime()) : undefined,
  };
}

function copyParticipant(participant: Participant): Participant {
  return {
    ...participant,
    joinedAt: copyDate(participant.joinedAt),
    leftAt: copyDate(participant.leftAt),
    lastGameEndedAt: copyDate(participant.lastGameEndedAt),
  };
}

function copyDate(date: Date | null | undefined): Date | null {
  return date ? new Date(date.getTime()) : null;
}

function canRestoreEndedGame(game: Game | null, snapshot: EndGameSnapshot): boolean {
  if (!game || game.status !== "completed" || !game.endedAt) return false;
  if (game.endedAt.getTime() !== snapshot.endedAt.getTime()) return false;

  const currentPlayerIds = [...game.team1, ...game.team2].sort();
  const snapshotPlayerIds = [...snapshot.game.team1, ...snapshot.game.team2].sort();
  return currentPlayerIds.every((memberId, index) => memberId === snapshotPlayerIds[index]);
}

function formatElapsed(startedAt: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - startedAt.getTime();
  const minutes = Math.floor(diffMs / 60000);
  return `${minutes}분`;
}

function compareByStartedAt(a: Game, b: Game, gameIndexMap: Map<string, number>): number {
  const aStartedAt = a.startedAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const bStartedAt = b.startedAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const startedAtDiff = aStartedAt - bStartedAt;
  if (startedAtDiff !== 0) return startedAtDiff;

  const indexDiff = (gameIndexMap.get(a.id) ?? 0) - (gameIndexMap.get(b.id) ?? 0);
  if (indexDiff !== 0) return indexDiff;

  return a.id.localeCompare(b.id);
}
