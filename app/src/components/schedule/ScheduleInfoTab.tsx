"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Schedule } from "@/types";
import { scheduleRepository } from "@/repositories";
import { ScheduleAddModal } from "@/components/ScheduleAddModal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

interface Props {
  schedule: Schedule;
  participantCount: number;
  gameCount: number;
  readOnly?: boolean;
  onRefresh?: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()} (${days[date.getDay()]})`;
}

const STATUS_LABEL: Record<Schedule["status"], string> = {
  upcoming: "예정",
  in_progress: "진행중",
  completed: "완료",
};

export function ScheduleInfoTab({ schedule, participantCount, gameCount, readOnly = false, onRefresh }: Props) {
  const { showToast } = useToast();
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleStatusChange(newStatus: Schedule["status"]) {
    try {
      await scheduleRepository.update(schedule.id, { status: newStatus });
      onRefresh?.();
      showToast(
        newStatus === "in_progress" ? "일정이 시작되었습니다." : "일정이 종료되었습니다.",
        "success"
      );
    } catch (error) {
      console.error("상태 변경 실패:", error);
      showToast("상태 변경에 실패했습니다.");
    }
  }

  return (
    <div>
      <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
        <InfoRow label="날짜" value={formatDate(schedule.date)} />
        <InfoRow label="시간" value={`${schedule.startTime} ~ ${schedule.endTime}`} />
        <InfoRow label="장소" value={schedule.location || "미정"} />
        <InfoRow label="코트 수" value={`${schedule.courtCount}면`} />
        <InfoRow label="상태" value={STATUS_LABEL[schedule.status]} highlight />

        {!readOnly && (
          <button
            onClick={() => setShowEditModal(true)}
            className="mt-3 w-full rounded-lg bg-[#f1f5f8] py-2.5 text-xs font-semibold text-[var(--color-text-secondary)]"
          >
            일정 수정
          </button>
        )}
      </div>

      <div className="mb-4 rounded-xl border border-[var(--color-border)] bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-bold">통계</p>
        <InfoRow label="참여 인원" value={`${participantCount}명`} />
        <InfoRow label="총 진행 게임" value={`${gameCount}회`} />
      </div>

      {!readOnly && (
        <div className="space-y-2">
          {schedule.status === "upcoming" && (
            <button
              onClick={() => handleStatusChange("in_progress")}
              className="w-full rounded-xl bg-[var(--color-accent)] py-3.5 text-sm font-bold text-white active:bg-[var(--color-accent-dark)]"
            >
              일정 시작하기
            </button>
          )}

          {schedule.status === "in_progress" && (
            <button
              onClick={() => handleStatusChange("completed")}
              className="w-full rounded-xl bg-[var(--color-danger)] py-3.5 text-sm font-bold text-white active:opacity-80"
            >
              일정 종료하기
            </button>
          )}

          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-3.5 text-sm font-semibold text-[var(--color-danger)]"
          >
            일정 삭제
          </button>
        </div>
      )}

      {showDeleteConfirm && (
        <ConfirmDialog
          title="일정 삭제"
          message="이 일정을 삭제하시겠습니까? 참여자 및 게임 기록도 모두 삭제됩니다."
          confirmLabel="삭제"
          danger
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={async () => {
            try {
              await scheduleRepository.delete(schedule.id);
              showToast("일정이 삭제되었습니다.", "success");
              router.push("/");
            } catch (error) {
              console.error("삭제 실패:", error);
              showToast("삭제에 실패했습니다.");
              setShowDeleteConfirm(false);
            }
          }}
        />
      )}

      {showEditModal && (
        <ScheduleAddModal
          schedule={schedule}
          lastSchedule={null}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            onRefresh?.();
          }}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-[#f4f7f9] py-2.5 last:border-b-0">
      <span className="text-[13px] text-[var(--color-text-muted)]">{label}</span>
      <span className={`text-[13px] font-semibold ${highlight ? "text-[var(--color-accent)]" : ""}`}>
        {value}
      </span>
    </div>
  );
}
