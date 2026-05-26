"use client";

import { useState, useEffect } from "react";
import { Schedule } from "@/types";
import { scheduleRepository } from "@/repositories";
import { ScheduleCard } from "@/components/ScheduleCard";
import { ScheduleAddModal } from "@/components/ScheduleAddModal";

export default function HomePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadSchedules();
  }, []);

  async function loadSchedules() {
    try {
      setLoading(true);
      const data = await scheduleRepository.getAll();
      setSchedules(data);
    } catch (error) {
      console.error("일정 목록 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleModalClose() {
    setShowAddModal(false);
  }

  async function handleSaved() {
    setShowAddModal(false);
    await loadSchedules();
  }

  // 상태별 분류
  const inProgress = schedules.filter((s) => s.status === "in_progress");
  const upcoming = schedules.filter((s) => s.status === "upcoming");
  const completed = schedules.filter((s) => s.status === "completed");

  return (
    <div className="p-4 pb-20">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-base font-bold">일정 목록</h2>
      </div>

      {/* 플로팅 일정 생성 버튼 */}
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30 max-w-3xl w-[calc(100%-32px)]">
        <button
          onClick={() => setShowAddModal(true)}
          className="w-full py-3.5 bg-[var(--color-accent)] text-white rounded-xl text-sm font-bold active:bg-[var(--color-accent-dark)] shadow-lg"
        >
          + 일정 생성
        </button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-[var(--color-text-muted)] text-sm">
          로딩중...
        </div>
      ) : schedules.length === 0 ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          <p className="text-4xl mb-3">📅</p>
          <p className="text-sm">등록된 일정이 없습니다</p>
          <p className="text-xs mt-1">일정을 생성하여 시작하세요</p>
        </div>
      ) : (
        <>
          {/* 진행중 */}
          {inProgress.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-[var(--color-accent)] mb-2">진행중</p>
              {inProgress.map((s) => (
                <ScheduleCard key={s.id} schedule={s} />
              ))}
            </div>
          )}

          {/* 예정 */}
          {upcoming.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-[var(--color-primary)] mb-2">예정</p>
              {upcoming.map((s) => (
                <ScheduleCard key={s.id} schedule={s} />
              ))}
            </div>
          )}

          {/* 완료 */}
          {completed.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">완료</p>
              {completed.map((s) => (
                <ScheduleCard key={s.id} schedule={s} />
              ))}
            </div>
          )}
        </>
      )}

      {/* 일정 생성 모달 */}
      {showAddModal && (
        <ScheduleAddModal
          schedule={null}
          lastSchedule={schedules.length > 0 ? schedules[0] : null}
          onClose={handleModalClose}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
