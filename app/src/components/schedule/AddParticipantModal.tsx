"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Member, Participant } from "@/types";
import { participantRepository } from "@/repositories";
import { scoreToLevelInfo } from "@/lib/level";
import { useToast } from "@/components/Toast";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

interface Props {
  scheduleId: string;
  members: Member[];
  existingParticipants: Participant[];
  onClose: () => void;
  onSaved: () => void;
  onAddMember: (name: string) => void;
}

export function AddParticipantModal({ scheduleId, members, existingParticipants, onClose, onSaved, onAddMember }: Props) {
  const { showToast } = useToast();
  useLockBodyScroll();
  const [searchQuery, setSearchQuery] = useState("");
  const closedRef = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragging = useRef(false);
  const dragCurrentY = useRef(0);

  const [addedIds, setAddedIds] = useState<Set<string>>(
    new Set(existingParticipants.filter((p) => p.status !== "left").map((p) => p.memberId))
  );

  const dismiss = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onSaved();
  }, [onSaved]);

  useEffect(() => {
    window.history.pushState({ modal: true }, "");

    function handlePopState() {
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
    onSaved();
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
      if (el) {
        el.style.transition = "transform 0.2s ease-out";
        el.style.transform = "translateY(0)";
      }
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

  async function addParticipant(member: Member) {
    try {
      const participant: Participant = {
        memberId: member.id,
        status: "registered",
        joinedAt: null,
        leftAt: null,
        gamesPlayed: 0,
        lastGameEndedAt: null,
      };
      await participantRepository.add(scheduleId, participant);
      setAddedIds((prev) => new Set([...prev, member.id]));
      showToast(`${member.name}님을 추가했습니다.`, "success");
    } catch (error) {
      console.error("참여자 추가 실패:", error);
      showToast("추가에 실패했습니다.");
    }
  }

  // 검색 필터링 (최근 가입순 정렬)
  const filteredMembers = members
    .filter((m) => {
      if (searchQuery && !m.name.includes(searchQuery)) return false;
      return true;
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        ref={sheetRef}
        className="bg-white rounded-t-2xl p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 핸들 */}
        <div className="w-9 h-1 bg-[var(--color-border)] rounded-full mx-auto mb-5" />

        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold">참여자 추가</h2>
          <button
            onClick={closeModal}
            className="text-xl text-[var(--color-text-muted)] px-1"
          >
            ✕
          </button>
        </div>

        {/* 검색 */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="이름으로 검색"
          className="w-full px-3.5 py-2.5 border border-[var(--color-border)] rounded-lg text-sm mb-4 focus:outline-none focus:border-[var(--color-primary)]"
          autoFocus
        />

        {/* 모임원 목록 */}
        {filteredMembers.length > 0 ? (
          <div className="bg-white rounded-xl border border-[var(--color-border)]">
            {filteredMembers.map((member) => {
              const levelInfo = scoreToLevelInfo(member.level);
              const isMale = member.gender === "male";
              const isAdded = addedIds.has(member.id);
              return (
                <div
                  key={member.id}
                  className="flex items-center px-3.5 py-3 border-b border-[#f4f7f9] last:border-b-0"
                >
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
                    </p>
                  </div>
                  {isAdded ? (
                    <span className="px-3 py-1.5 text-[11px] font-semibold text-[var(--color-text-muted)]">
                      추가됨
                    </span>
                  ) : (
                    <button
                      onClick={() => addParticipant(member)}
                      className="px-3 py-1.5 bg-[var(--color-primary)] text-white rounded-md text-[11px] font-semibold"
                    >
                      추가
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <p className="text-sm">
              {searchQuery ? "검색 결과가 없습니다" : "등록된 모임원이 없습니다"}
            </p>
            {searchQuery && (
              <button
                onClick={() => {
                  closeModal();
                  onAddMember(searchQuery);
                }}
                className="mt-3 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg text-xs font-semibold"
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
