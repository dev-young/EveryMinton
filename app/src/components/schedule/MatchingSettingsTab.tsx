"use client";

import { useState } from "react";
import { MatchingPriority } from "@/types";

interface Props {
  priorities: MatchingPriority[];
  onPrioritiesChange: (priorities: MatchingPriority[]) => void;
}

const PRIORITY_LABELS: Record<MatchingPriority, string> = {
  games_per_hour: "시간당 게임 횟수 균등화",
  avoid_repeat: "같은 조합 반복 방지",
  gender_balance: "성별 밸런스",
  level_balance: "급수(실력) 밸런스",
};

export function MatchingSettingsTab({ priorities, onPrioritiesChange }: Props) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  function moveUp(index: number) {
    if (index === 0) return;
    const newPriorities = [...priorities];
    [newPriorities[index - 1], newPriorities[index]] = [newPriorities[index], newPriorities[index - 1]];
    onPrioritiesChange(newPriorities);
  }

  function moveDown(index: number) {
    if (index === priorities.length - 1) return;
    const newPriorities = [...priorities];
    [newPriorities[index], newPriorities[index + 1]] = [newPriorities[index + 1], newPriorities[index]];
    onPrioritiesChange(newPriorities);
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <p className="text-sm font-bold">매칭 우선순위</p>
        <p className="text-[11px] text-[var(--color-text-muted)]">위/아래 버튼으로 순서 변경</p>
      </div>

      <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm overflow-hidden">
        {priorities.map((priority, index) => (
          <div
            key={priority}
            className="flex items-center px-4 py-3.5 border-b border-[#f4f7f9] last:border-b-0"
          >
            {/* 순위 번호 */}
            <span className="w-6 h-6 rounded-full bg-[var(--color-primary)] text-white text-[11px] font-bold flex items-center justify-center mr-3">
              {index + 1}
            </span>

            {/* 라벨 */}
            <span className="flex-1 text-sm font-medium">
              {PRIORITY_LABELS[priority]}
            </span>

            {/* 위/아래 버튼 */}
            <div className="flex gap-1">
              <button
                onClick={() => moveUp(index)}
                disabled={index === 0}
                className="w-7 h-7 rounded-md bg-[var(--color-bg)] text-[var(--color-text-muted)] text-xs font-bold disabled:opacity-30"
              >
                ▲
              </button>
              <button
                onClick={() => moveDown(index)}
                disabled={index === priorities.length - 1}
                className="w-7 h-7 rounded-md bg-[var(--color-bg)] text-[var(--color-text-muted)] text-xs font-bold disabled:opacity-30"
              >
                ▼
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 설명 */}
      <div className="mt-4 p-3 bg-blue-50 rounded-xl">
        <p className="text-[11px] text-[var(--color-primary)] leading-relaxed">
          💡 우선순위가 높을수록 매칭 시 더 중요하게 고려됩니다. 변경된 순서는 이 일정 내에서 유지됩니다.
        </p>
      </div>
    </div>
  );
}
