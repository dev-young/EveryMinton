import { useState, useEffect, useRef, useCallback } from "react";
import { Member, Gender, LevelGrade, LevelSubGrade } from "@/types";
import { memberRepository } from "@/repositories";
import { calculateScore } from "@/lib/level";
import { scoreToLevelInfo } from "@/lib/level";
import { useToast } from "@/components/Toast";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface Props {
  member: Member | null;
  defaultName?: string;
  defaultGender?: Gender;
  defaultGrade?: LevelGrade;
  defaultSubGrade?: LevelSubGrade;
  onClose: () => void;
  onSaved: () => void;
  onSavedContinue?: () => void;
  onSavedName?: (name: string) => void;
  manageHistory?: boolean;
  onLastValues?: (gender: Gender, grade: LevelGrade, subGrade: LevelSubGrade) => void;
}

export function MemberAddModal({ member, defaultName, defaultGender, defaultGrade, defaultSubGrade, onClose, onSaved, onSavedContinue, onSavedName, manageHistory = true, onLastValues }: Props) {
  const { showToast } = useToast();
  useLockBodyScroll();
  const existingLevel = member ? scoreToLevelInfo(member.level) : null;
  const closedRef = useRef(false);
  const confirmedDuplicateNameRef = useRef<string | null>(null);

  const [name, setName] = useState(member?.name ?? defaultName ?? "");
  const [gender, setGender] = useState<Gender>(member?.gender ?? defaultGender ?? "male");
  const [grade, setGrade] = useState<LevelGrade>(
    existingLevel?.grade ?? defaultGrade ?? "D"
  );
  const [subGrade, setSubGrade] = useState<LevelSubGrade>(
    existingLevel?.subGrade ?? defaultSubGrade ?? "중"
  );
  const [saving, setSaving] = useState(false);
  const [duplicateConfirm, setDuplicateConfirm] = useState<{
    continueAdding: boolean;
    name: string;
  } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef(0);
  const dragging = useRef(false);
  const dragCurrentY = useRef(0);

  const dismiss = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose();
  }, [onClose]);

  // 안드로이드 백버튼 대응
  useEffect(() => {
    if (!manageHistory) return;

    window.history.pushState({ modal: true }, "");

    function handlePopState() {
      dismiss();
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [dismiss, manageHistory]);

  function closeModal() {
    if (closedRef.current) return;
    closedRef.current = true;
    if (manageHistory) {
      window.history.back();
    }
    onClose();
  }

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

  const score = calculateScore(grade, subGrade);
  const isEdit = member !== null;

  async function handleSubmit(continueAdding = false) {
    const trimmedName = name.trim();

    if (!trimmedName) {
      showToast("이름을 입력하세요.");
      return;
    }

    if (!isEdit && confirmedDuplicateNameRef.current !== trimmedName) {
      setSaving(true);
      try {
        const duplicates = await memberRepository.searchByName(trimmedName);
        const hasSameName = duplicates.some(
          (duplicate) => duplicate.name.trim() === trimmedName
        );

        if (hasSameName) {
          setDuplicateConfirm({ continueAdding, name: trimmedName });
          return;
        }
      } catch (error) {
        console.error("Duplicate member name check failed:", error);
        showToast("이름 중복 확인에 실패했습니다.");
        return;
      } finally {
        setSaving(false);
      }
    }

    confirmedDuplicateNameRef.current = null;
    setSaving(true);
    try {
      onLastValues?.(gender, grade, subGrade);
      if (isEdit) {
        await memberRepository.update(member.id, {
          name: name.trim(),
          gender,
          level: score,
        });
        if (!closedRef.current) {
          closedRef.current = true;
          if (manageHistory) {
            window.history.back();
          }
          onSaved();
        }
      } else {
        await memberRepository.create({
          name: name.trim(),
          gender,
          level: score,
        });
        onSavedName?.(name.trim());
        if (continueAdding) {
          setName("");
          onSavedContinue?.();
        } else {
          if (!closedRef.current) {
            closedRef.current = true;
            if (manageHistory) {
              window.history.back();
            }
            onSaved();
          }
        }
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
      className="fixed inset-0 bg-black/50 flex items-end justify-center z-[60]"
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
            {isEdit ? "모임원 수정" : "모임원 등록"}
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
            이름
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력하세요"
            className="w-full px-3.5 py-3 border border-[var(--color-border)] rounded-lg text-sm focus:outline-none focus:border-[var(--color-primary)]"
            autoFocus
          />
        </div>

        {/* 성별 */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
            성별
          </label>
          <div className="flex gap-2.5">
            <button
              onClick={() => setGender("male")}
              className={`flex-1 py-3 rounded-lg text-sm font-semibold border-2 transition-colors ${
                gender === "male"
                  ? "bg-blue-50 text-[var(--color-primary)] border-[var(--color-primary)]"
                  : "text-[var(--color-text-secondary)] border-[var(--color-border)]"
              }`}
            >
              👨 남성
            </button>
            <button
              onClick={() => setGender("female")}
              className={`flex-1 py-3 rounded-lg text-sm font-semibold border-2 transition-colors ${
                gender === "female"
                  ? "bg-pink-50 text-pink-600 border-pink-400"
                  : "text-[var(--color-text-secondary)] border-[var(--color-border)]"
              }`}
            >
              👩 여성
            </button>
          </div>
        </div>

        {/* 급수 */}
        <div className="mb-5">
          <label className="block text-sm font-semibold text-[var(--color-text-secondary)] mb-2">
            급수
          </label>

          {/* 등급 선택 */}
          <div className="grid grid-cols-5 gap-2 mb-2.5">
            {(["A", "B", "C", "D", "E"] as LevelGrade[]).map((g) => (
              <button
                key={g}
                onClick={() => setGrade(g)}
                className={`py-2.5 rounded-lg text-sm font-bold border-2 transition-colors ${
                  grade === g
                    ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)] border-[var(--color-border)]"
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* 세분화 선택 */}
          <div className="flex gap-2">
            {(["상", "중", "하"] as LevelSubGrade[]).map((sg) => (
              <button
                key={sg}
                onClick={() => setSubGrade(sg)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  subGrade === sg
                    ? "bg-blue-50 text-[var(--color-primary)] border-[var(--color-primary)]"
                    : "text-[var(--color-text-secondary)] border-[var(--color-border)]"
                }`}
              >
                {sg}
              </button>
            ))}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-2 mt-2">
          <button
            onClick={() => handleSubmit(false)}
            disabled={saving}
            className="flex-1 py-4 bg-[var(--color-accent)] text-white rounded-xl text-sm font-bold active:bg-[var(--color-accent-dark)] disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {saving ? "저장중..." : isEdit ? "수정하기" : "등록하기"}
          </button>
          {!isEdit && (
            <button
              onClick={() => handleSubmit(true)}
              disabled={saving}
              className="flex-1 py-4 bg-[var(--color-primary)] text-white rounded-xl text-sm font-bold active:bg-[var(--color-primary-dark)] disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {saving ? "저장중..." : "계속 등록하기"}
            </button>
          )}
        </div>

      </div>
      {duplicateConfirm && (
        <ConfirmDialog
          title="같은 이름의 모임원이 있습니다"
          message={`'${duplicateConfirm.name}' 이름으로 등록된 모임원이 이미 있습니다. 그래도 등록하시겠습니까?`}
          confirmLabel="등록"
          cancelLabel="취소"
          onCancel={() => setDuplicateConfirm(null)}
          onConfirm={() => {
            const pending = duplicateConfirm;
            confirmedDuplicateNameRef.current = pending.name;
            setDuplicateConfirm(null);
            void handleSubmit(pending.continueAdding);
          }}
        />
      )}
    </div>
  );
}
