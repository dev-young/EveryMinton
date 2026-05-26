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
  onRefresh: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  return `${year}. ${month}. ${day} (${dayOfWeek})`;
}

const STATUS_LABEL: Record<string, string> = {
  upcoming: "예정",
  in_progress: "진행중",
  completed: "완료",
};

export function ScheduleInfoTab({ schedule, participantCount, gameCount, onRefresh }: Props) {
  const { showToast } = useToast();
  const router = useRouter();
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleStatusChange(newStatus: Schedule["status"]) {
    try {
      await scheduleRepository.update(schedule.id, { status: newStatus });
      onRefresh();
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
      {/* 일정 정보 */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm p-4 mb-4">
        <InfoRow label="날짜" value={formatDate(schedule.date)} />
        <InfoRow label="시간" value={`${schedule.startTime} ~ ${schedule.endTime}`} />
        <InfoRow label="장소" value={schedule.location || "미정"} />
        <InfoRow label="코트 수" value={`${schedule.courtCount}면`} />
        <InfoRow label="상태" value={STATUS_LABEL[schedule.status]} highlight />

        <button
          onClick={() => setShowEditModal(true)}
          className="w-full mt-3 py-2.5 bg-[#f1f5f8] text-[var(--color-text-secondary)] rounded-lg text-xs font-semibold"
        >
          일정 수정
        </button>
      </div>

      {/* 일정 통계 */}
      <div className="bg-white rounded-xl border border-[var(--color-border)] shadow-sm p-4 mb-4">
        <p className="text-sm font-bold mb-3">통계</p>
        <InfoRow label="참여 인원" value={`${participantCount}명`} />
        <InfoRow label="총 진행 게임" value={`${gameCount}회`} />
      </div>

      {/* 상태 변경 버튼 */}
      <div className="space-y-2">
        {schedule.status === "upcoming" && (
          <button
            onClick={() => handleStatusChange("in_progress")}
            className="w-full py-3.5 bg-[var(--color-accent)] text-white rounded-xl text-sm font-bold active:bg-[var(--color-accent-dark)]"
          >
            일정 시작하기
          </button>
        )}
        {schedule.status === "in_progress" && (
          <button
            onClick={() => handleStatusChange("completed")}
            className="w-full py-3.5 bg-[var(--color-danger)] text-white rounded-xl text-sm font-bold active:opacity-80"
          >
            일정 종료하기
          </button>
        )}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="w-full py-3.5 text-[var(--color-danger)] text-sm font-semibold"
        >
          일정 삭제
        </button>
      </div>

      {/* 삭제 확인 다이얼로그 */}
      {showDeleteConfirm && (
        <ConfirmDialog
          title="일정 삭제"
          message="이 일정을 삭제하시겠습니까? 참여자 및 게임 기록이 모두 삭제됩니다."
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

      {/* 수정 모달 */}
      {showEditModal && (
        <ScheduleAddModal
          schedule={schedule}
          lastSchedule={null}
          onClose={() => setShowEditModal(false)}
          onSaved={() => {
            setShowEditModal(false);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b border-[#f4f7f9] last:border-b-0">
      <span className="text-[13px] text-[var(--color-text-muted)]">{label}</span>
      <span className={`text-[13px] font-semibold ${highlight ? "text-[var(--color-accent)]" : ""}`}>
        {value}
      </span>
    </div>
  );
}
