"use client";

import { Member } from "@/types";
import { scoreToLevelInfo } from "@/lib/level";

interface Props {
  member: Member;
  onClick: (member: Member) => void;
}

const LEVEL_COLORS: Record<string, string> = {
  A: "bg-orange-50 text-orange-600",
  B: "bg-blue-50 text-[var(--color-primary)]",
  C: "bg-green-50 text-[var(--color-accent)]",
  D: "bg-purple-50 text-purple-600",
  E: "bg-gray-100 text-gray-500",
};

export function MemberListItem({ member, onClick }: Props) {
  const levelInfo = scoreToLevelInfo(member.level);
  const isMale = member.gender === "male";

  return (
    <button
      type="button"
      onClick={() => onClick(member)}
      className="relative flex w-full items-center border-b border-[#f4f7f9] px-4 py-3.5 text-left last:border-b-0 active:bg-gray-50"
    >
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
    </button>
  );
}
