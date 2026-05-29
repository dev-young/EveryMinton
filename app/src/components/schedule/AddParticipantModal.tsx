"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Member, Participant } from "@/types";
import { participantRepository } from "@/repositories";
import { scoreToLevelInfo } from "@/lib/level";
import { useToast } from "@/components/Toast";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

interface Props {
  scheduleId: string;
  members: Member[];
  existingParticipants: Participant[];
  searchQuery: string;
  suspendHistoryClose?: boolean;
  onSaved: () => void;
  onAddMember: (name: string) => void;
  onSearchQueryChange: (query: string) => void;
}

const SEARCH_SPLIT_REGEX = /[\s,，.。、;；/\\|]+/;

function createParticipant(memberId: string): Participant {
  return {
    memberId,
    status: "registered",
    joinedAt: null,
    leftAt: null,
    gamesPlayed: 0,
    lastGameEndedAt: null,
  };
}

function getSearchTerms(query: string): string[] {
  return query
    .split(SEARCH_SPLIT_REGEX)
    .map((term) => term.trim())
    .filter(Boolean);
}

function resolveSearchTerm(term: string, members: Member[]): string {
  const hasDirectMatch = members.some((member) => member.name.includes(term));
  return term.length === 3 && !hasDirectMatch ? term.slice(-2) : term;
}

function resolveSearchTerms(query: string, members: Member[]): string[] {
  return getSearchTerms(query).map((term) => resolveSearchTerm(term, members));
}

export function AddParticipantModal({ scheduleId, members, existingParticipants, searchQuery, suspendHistoryClose = false, onSaved, onAddMember, onSearchQueryChange }: Props) {
  const { showToast } = useToast();
  useLockBodyScroll();
  const closedRef = useRef(false);
  const onSavedRef = useRef(onSaved);
  const suspendHistoryCloseRef = useRef(suspendHistoryClose);
  const ignoreHistoryCloseUntilRef = useRef(0);

  const [addedIds, setAddedIds] = useState<Set<string>>(
    new Set(existingParticipants.filter((p) => p.status !== "left").map((p) => p.memberId))
  );
  const [addingAll, setAddingAll] = useState(false);

  useEffect(() => {
    onSavedRef.current = onSaved;
    suspendHistoryCloseRef.current = suspendHistoryClose;
    if (suspendHistoryClose) {
      ignoreHistoryCloseUntilRef.current = Date.now() + 800;
    }
  });

  const dismiss = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onSavedRef.current();
  }, []);

  useEffect(() => {
    window.history.pushState({ modal: true }, "");

    function handlePopState() {
      if (
        suspendHistoryCloseRef.current ||
        Date.now() < ignoreHistoryCloseUntilRef.current
      ) {
        return;
      }
      dismiss();
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [dismiss]);

  function closeModal() {
    if (closedRef.current) return;
    closedRef.current = true;
    window.history.back();
    onSavedRef.current();
  }

  async function addParticipant(member: Member) {
    try {
      await participantRepository.add(scheduleId, createParticipant(member.id));
      setAddedIds((prev) => new Set([...prev, member.id]));
      showToast(`${member.name}님을 추가했습니다.`, "success");
    } catch (error) {
      console.error("참여자 추가 실패:", error);
      showToast("추가에 실패했습니다.");
    }
  }

  async function addAllParticipants(membersToAdd: Member[]) {
    if (membersToAdd.length === 0 || addingAll) return;

    try {
      setAddingAll(true);
      await participantRepository.addMany(
        scheduleId,
        membersToAdd.map((member) => createParticipant(member.id))
      );
      setAddedIds((prev) => new Set([...prev, ...membersToAdd.map((member) => member.id)]));
      showToast(`${membersToAdd.length}명을 추가했습니다.`, "success");
    } catch (error) {
      console.error("참여자 일괄 추가 실패:", error);
      showToast("일괄 추가에 실패했습니다.");
    } finally {
      setAddingAll(false);
    }
  }

  const rawSearchTerms = useMemo(() => getSearchTerms(searchQuery), [searchQuery]);
  const searchTerms = useMemo(() => resolveSearchTerms(searchQuery, members), [members, searchQuery]);
  const hasSearchQuery = rawSearchTerms.length > 0;

  const filteredMembers = useMemo(() => {
    return [...members]
      .filter((member) => {
        if (!hasSearchQuery) return true;
        return searchTerms.some((term) => member.name.includes(term));
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }, [hasSearchQuery, members, searchTerms]);

  const missingSearchNames = useMemo(() => {
    const seenNames = new Set<string>();

    return rawSearchTerms.filter((term) => {
      if (seenNames.has(term)) return false;
      seenNames.add(term);

      const resolvedTerm = resolveSearchTerm(term, members);
      return !members.some((member) => member.name.includes(resolvedTerm));
    });
  }, [members, rawSearchTerms]);

  const membersToAdd = filteredMembers.filter((member) => !addedIds.has(member.id));
  const showAddAllButton = hasSearchQuery && filteredMembers.length >= 2 && membersToAdd.length >= 2;
  const hasSearchResults = filteredMembers.length > 0 || missingSearchNames.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] px-4 py-3.5">
        <button
          type="button"
          onClick={closeModal}
          className="flex h-8 w-8 items-center justify-center text-xl text-[var(--color-text-muted)]"
          aria-label="닫기"
        >
          ✕
        </button>
        <h2 className="text-lg font-bold">참여자 추가</h2>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {/* 검색 */}
        <textarea
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="이름으로 검색"
          rows={2}
          className="mb-4 w-full resize-none rounded-lg border border-[var(--color-border)] px-3.5 py-2.5 text-sm focus:border-[var(--color-primary)] focus:outline-none"
          autoFocus
        />

        {/* 모임원 목록 */}
        {hasSearchResults ? (
          <>
            <div className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-white">
              {filteredMembers.map((member) => {
                const levelInfo = scoreToLevelInfo(member.level);
                const isMale = member.gender === "male";
                const isAdded = addedIds.has(member.id);
                return (
                  <div
                    key={member.id}
                    className="flex items-center border-b border-[#f4f7f9] px-3.5 py-3 last:border-b-0"
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
                      </p>
                    </div>
                    {isAdded ? (
                      <span className="px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text-muted)]">
                        추가됨
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => addParticipant(member)}
                        className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-[11px] font-semibold text-white"
                      >
                        추가
                      </button>
                    )}
                  </div>
                );
              })}
              {missingSearchNames.map((name) => (
                <div
                  key={`missing-${name}`}
                  className="flex items-center border-b border-[#f4f7f9] px-3.5 py-3 last:border-b-0"
                >
                  <div className="mr-3 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-[var(--color-text-muted)]">
                    ?
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{name}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      존재하지 않은 모임원 입니다
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onAddMember(name);
                    }}
                    className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-[11px] font-semibold text-white"
                  >
                    모임원 추가
                  </button>
                </div>
              ))}
            </div>

            {showAddAllButton && (
              <button
                type="button"
                onClick={() => addAllParticipants(membersToAdd)}
                disabled={addingAll}
                className="mt-3 w-full rounded-xl bg-[var(--color-accent)] py-3.5 text-sm font-bold text-white shadow-sm active:bg-[var(--color-accent-dark)] disabled:cursor-not-allowed disabled:bg-gray-300"
              >
                {addingAll ? "추가중..." : `${membersToAdd.length}명 모두 추가하기`}
              </button>
            )}
          </>
        ) : (
          <div className="py-8 text-center text-[var(--color-text-muted)]">
            <p className="text-sm">
              {hasSearchQuery ? "검색 결과가 없습니다" : "등록된 모임원이 없습니다"}
            </p>
            {hasSearchQuery && (
              <button
                type="button"
                onClick={() => {
                  onAddMember(searchQuery);
                }}
                className="mt-3 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white"
              >
                모임원 추가
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
