"use client";

import Link from "next/link";
import { Schedule } from "@/types";

interface Props {
  schedule: Schedule;
}

const STATUS_CONFIG = {
  upcoming: { label: "예정", color: "bg-blue-50 text-[var(--color-primary)]", border: "border-l-[var(--color-primary)]" },
  in_progress: { label: "진행중", color: "bg-green-50 text-[var(--color-accent)]", border: "border-l-[var(--color-accent)]" },
  completed: { label: "완료", color: "bg-gray-100 text-[var(--color-text-muted)]", border: "border-l-gray-300" },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  return `${year}. ${month}. ${day} (${dayOfWeek})`;
}

export function ScheduleCard({ schedule }: Props) {
  const status = STATUS_CONFIG[schedule.status];

  const content = (
    <div
      className={`bg-white rounded-xl p-4 border border-[var(--color-border)] border-l-4 ${status.border} shadow-sm active:scale-[0.98] transition-transform`}
    >
      <div className="flex justify-between items-start gap-3 mb-2.5">
        <div className="min-w-0">
          <p className="text-[15px] font-bold">{formatDate(schedule.date)}</p>
          {schedule.name && (
            <p className="mt-1 truncate text-[13px] font-semibold text-[var(--color-text-secondary)]">
              {schedule.name}
            </p>
          )}
        </div>
        <span className={`text-[11px] px-2.5 py-1 rounded-full font-semibold ${status.color}`}>
          {schedule.status === "in_progress" && "● "}{status.label}
        </span>
      </div>
      <div className="text-[13px] text-[var(--color-text-secondary)] space-y-1">
        <div className="flex items-center gap-1.5">
          <span>📍</span> {schedule.location || "미정"}
        </div>
        <div className="flex items-center gap-1.5">
          <span>🕐</span> {schedule.startTime} ~ {schedule.endTime}
        </div>
      </div>
    </div>
  );

  if (schedule.status === "completed") {
    return <div className="mb-3 opacity-60">{content}</div>;
  }

  return (
    <Link href={`/schedule/${schedule.id}`} className="block mb-3 no-underline text-inherit">
      {content}
    </Link>
  );
}
