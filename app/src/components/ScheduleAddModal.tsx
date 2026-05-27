import { useState, useEffect, useRef, useCallback } from "react";
import { Schedule } from "@/types";
import { scheduleRepository } from "@/repositories";
import { useToast } from "@/components/Toast";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

interface Props {
  schedule: Schedule | null;
  lastSchedule: Schedule | null;
  onClose: () => void;
  onSaved: () => void;
}

export function ScheduleAddModal({ schedule, lastSchedule, onClose, onSaved }: Props) {
  const { showToast } = useToast();
  useLockBodyScroll();
  const isEdit = schedule !== null;
  const closedRef = useRef(false);

  function getDefaults() {
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];

    if (lastSchedule) {
      return {
        dateStr,
        startStr: lastSchedule.startTime,
        endStr: lastSchedule.endTime,
        court: lastSchedule.courtCount,
        loc: lastSchedule.location,
      };
    }

    const startStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const end = new Date(now.getTime() + 4 * 60 * 60 * 1000);
    const endStr = `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
    return { dateStr, startStr, endStr, court: 4, loc: "" };
  }

  const defaults = getDefaults();

  const [name, setName] = useState(schedule?.name ?? "");
  const [date, setDate] = useState(schedule?.date ?? defaults.dateStr);
  const [startTime, setStartTime] = useState(schedule?.startTime ?? defaults.startStr);
  const [endTime, setEndTime] = useState(schedule?.endTime ?? defaults.endStr);
  const [courtCount, setCourtCount] = useState(schedule?.courtCount ?? defaults.court);
  const [location, setLocation] = useState(schedule?.location ?? defaults.loc);
  const [saving, setSaving] = useState(false);

  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragging = useRef(false);
  const dragCurrentY = useRef(0);

  // 닫기 함수 (중복 호출 방지)
  const dismiss = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  }, [onClose]);

  // 안드로이드 백버튼 대응
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

  // X 버튼, 배경 탭, 드래그 닫기 시 호출
  function closeModal() {
    if (closedRef.current) return;
    closedRef.current = true;
    // pushState로 추가한 히스토리 제거
    window.history.back();
    // popstate에서 onClose가 호출되지만 closedRef로 중복 방지됨
    // 직접 onClose 호출
    onClose();
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

  async function handleSubmit() {
    if (!date) {
      showToast("날짜를 선택하세요.");
      return;
    }
    if (!startTime || !endTime) {
      showToast("시작/종료 시간을 입력하세요.");
      return;
    }
    if (courtCount < 1) {
      showToast("코트 수는 1 이상이어야 합니다.");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await scheduleRepository.update(schedule.id, {
          name: name.trim(),
          date,
          startTime,
          endTime,
          courtCount,
          location: location.trim(),
        });
      } else {
        await scheduleRepository.create({
          name: name.trim(),
          date,
          startTime,
          endTime,
          courtCount,
          location: location.trim(),
          status: "upcoming",
        });
      }
      // 저장 성공: 히스토리 정리 후 onSaved 호출
      if (!closedRef.current) {
        closedRef.current = true;
        window.history.back();
        onSaved();
      }
    } catch (error) {
      console.error("저장 실패:", error);
      showToast("저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

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

        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold">
            {isEdit ? "일정 수정" : "일정 생성"}
          </h2>
          <button
            onClick={closeModal}
            className="text-xl text-[var(--color-text-muted)] px-1"
          >
            ✕
          </button>
        </div>

        {/* 이름 */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
            일정 이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="일정 이름을 입력하세요"
            className="w-full px-3.5 py-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        {/* 날짜 */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
            날짜
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3.5 py-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        {/* 시간 */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
              시작 시간
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3.5 py-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
              종료 시간
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3.5 py-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
        </div>

        {/* 장소 */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
            장소
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="장소를 입력하세요"
            className="w-full px-3.5 py-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
          />
        </div>

        {/* 코트 수 */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
            코트 수
          </label>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setCourtCount(Math.max(1, courtCount - 1))}
              className="w-10 h-10 rounded-lg border border-[var(--color-border)] text-lg font-bold text-[var(--color-text-secondary)] active:bg-gray-100"
            >
              −
            </button>
            <span className="text-xl font-bold w-8 text-center">{courtCount}</span>
            <button
              onClick={() => setCourtCount(courtCount + 1)}
              className="w-10 h-10 rounded-lg border border-[var(--color-border)] text-lg font-bold text-[var(--color-text-secondary)] active:bg-gray-100"
            >
              +
            </button>
            <span className="text-sm text-[var(--color-text-muted)]">면</span>
          </div>
        </div>

        {/* 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-4 bg-[var(--color-accent)] text-white rounded-xl text-sm font-bold mt-2 active:bg-[var(--color-accent-dark)] disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {saving ? "저장중..." : isEdit ? "수정하기" : "생성하기"}
        </button>
      </div>
    </div>
  );
}
