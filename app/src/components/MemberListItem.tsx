"use client";

import { useState, useRef, useEffect } from "react";
import { Member } from "@/types";
import { scoreToLevelInfo } from "@/lib/level";

interface Props {
  member: Member;
  onEdit: (member: Member) => void;
  onDelete: (id: string) => void;
}

const LEVEL_COLORS: Record<string, string> = {
  A: "bg-orange-50 text-orange-600",
  B: "bg-blue-50 text-[var(--color-primary)]",
  C: "bg-green-50 text-[var(--color-accent)]",
  D: "bg-purple-50 text-purple-600",
  E: "bg-gray-100 text-gray-500",
};

export function MemberListItem({ member, onEdit, onDelete }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const [openAbove, setOpenAbove] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const levelInfo = scoreToLevelInfo(member.level);
  const isMale = member.gender === "male";

  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      setOpenAbove(spaceBelow < 120);
    }
  }, [showMenu]);

  return (
    <div className="flex items-center px-4 py-3.5 border-b border-[#f4f7f9] last:border-b-0 relative">
      {/* 아바타 */}
      <div
        className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold mr-3 ${
          isMale ? "bg-blue-50 text-[var(--color-primary)]" : "bg-pink-50 text-pink-600"
        }`}
      >
        {member.name.charAt(0)}
      </div>

      {/* 정보 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--color-text)] truncate">
          {member.name}
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
          {isMale ? "남" : "여"}
        </p>
      </div>

      {/* 급수 */}
      <span
        className={`text-xs px-2.5 py-1 rounded-md font-bold ${
          LEVEL_COLORS[levelInfo.grade] || LEVEL_COLORS.E
        }`}
      >
        {levelInfo.display}
      </span>

      {/* 더보기 */}
      <button
        ref={buttonRef}
        onClick={() => setShowMenu(!showMenu)}
        className="ml-2 text-xl text-[var(--color-text-muted)] px-1"
      >
        ⋮
      </button>

      {/* 드롭다운 메뉴 */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div
            className={`absolute right-4 bg-white rounded-lg shadow-lg border border-[var(--color-border)] z-20 overflow-hidden ${
              openAbove ? "bottom-12" : "top-12"
            }`}
          >
            <button
              onClick={() => {
                setShowMenu(false);
                onEdit(member);
              }}
              className="block w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50"
            >
              수정
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                onDelete(member.id);
              }}
              className="block w-full text-left px-4 py-2.5 text-sm text-[var(--color-danger)] hover:bg-red-50"
            >
              삭제
            </button>
          </div>
        </>
      )}
    </div>
  );
}
