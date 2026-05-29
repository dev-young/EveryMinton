"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Gender, LevelGrade, LevelSubGrade, Member } from "@/types";
import { memberRepository } from "@/repositories";
import { calculateScore, scoreToLevelInfo } from "@/lib/level";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";

export default function MemberEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { showToast } = useToast();
  const memberId = params.id;
  const [returnPath] = useState(() => {
    if (typeof window === "undefined") return "/members";
    const returnTo = new URLSearchParams(window.location.search).get("returnTo");
    return returnTo?.startsWith("/") ? returnTo : "/members";
  });

  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [name, setName] = useState("");
  const [gender, setGender] = useState<Gender>("male");
  const [grade, setGrade] = useState<LevelGrade>("D");
  const [subGrade, setSubGrade] = useState<LevelSubGrade>("중");

  useEffect(() => {
    async function loadMember() {
      try {
        setLoading(true);
        const data = await memberRepository.getById(memberId);
        if (!data) {
          showToast("모임원을 찾을 수 없습니다.");
          router.replace("/members");
          return;
        }

        const levelInfo = scoreToLevelInfo(data.level);
        setMember(data);
        setName(data.name);
        setGender(data.gender);
        setGrade(levelInfo.grade);
        setSubGrade(levelInfo.subGrade);
      } catch (error) {
        console.error("모임원 로드 실패:", error);
        showToast("모임원 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }

    loadMember();
  }, [memberId, router, showToast]);

  function navigateToReturnPath() {
    const separator = returnPath.includes("?") ? "&" : "?";
    router.push(`${returnPath}${separator}memberUpdated=${Date.now()}`);
  }

  async function handleSave() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast("이름을 입력하세요.");
      return;
    }

    try {
      setSaving(true);
      await memberRepository.update(memberId, {
        name: trimmedName,
        gender,
        level: calculateScore(grade, subGrade),
      });
      showToast("모임원 정보가 수정되었습니다.", "success");
      navigateToReturnPath();
    } catch (error) {
      console.error("모임원 수정 실패:", error);
      showToast("수정에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    try {
      setDeleting(true);
      await memberRepository.delete(memberId);
      showToast("모임원이 삭제되었습니다.", "success");
      navigateToReturnPath();
    } catch (error) {
      console.error("모임원 삭제 실패:", error);
      showToast("삭제에 실패했습니다.");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="py-10 text-center text-sm text-[var(--color-text-muted)]">로딩중...</div>
      </div>
    );
  }

  if (!member) return null;

  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col bg-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] px-4 py-3.5">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-8 w-8 items-center justify-center text-xl text-[var(--color-text-muted)]"
          aria-label="뒤로가기"
        >
          ‹
        </button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold">모임원 수정</h1>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-[var(--color-danger)]"
        >
          삭제
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mb-5">
          <label className="mb-2 block text-sm font-semibold text-[var(--color-text-secondary)]">이름</label>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="이름을 입력하세요"
            className="w-full rounded-lg border border-[var(--color-border)] px-3.5 py-3 text-sm focus:border-[var(--color-primary)] focus:outline-none"
            autoFocus
          />
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-sm font-semibold text-[var(--color-text-secondary)]">성별</label>
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => setGender("male")}
              className={`flex-1 rounded-lg border-2 py-3 text-sm font-semibold transition-colors ${
                gender === "male"
                  ? "border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
              }`}
            >
              남성
            </button>
            <button
              type="button"
              onClick={() => setGender("female")}
              className={`flex-1 rounded-lg border-2 py-3 text-sm font-semibold transition-colors ${
                gender === "female"
                  ? "border-pink-400 bg-pink-50 text-pink-600"
                  : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
              }`}
            >
              여성
            </button>
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-2 block text-sm font-semibold text-[var(--color-text-secondary)]">급수</label>
          <div className="mb-2.5 grid grid-cols-5 gap-2">
            {(["A", "B", "C", "D", "E"] as LevelGrade[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setGrade(item)}
                className={`rounded-lg border-2 py-2.5 text-sm font-bold transition-colors ${
                  grade === item
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(["상", "중", "하"] as LevelSubGrade[]).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSubGrade(item)}
                className={`flex-1 rounded-lg border-2 py-2.5 text-sm font-semibold transition-colors ${
                  subGrade === item
                    ? "border-[var(--color-primary)] bg-blue-50 text-[var(--color-primary)]"
                    : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </main>

      <div className="shrink-0 border-t border-[var(--color-border)] bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="w-full rounded-xl bg-[var(--color-accent)] py-4 text-sm font-bold text-white active:bg-[var(--color-accent-dark)] disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {saving ? "저장중..." : "수정하기"}
        </button>
      </div>

      {showDeleteConfirm && (
        <ConfirmDialog
          title="모임원 삭제"
          message={`${member.name}님을 삭제하시겠습니까?`}
          confirmLabel={deleting ? "삭제중..." : "삭제"}
          danger
          onCancel={() => setShowDeleteConfirm(false)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
