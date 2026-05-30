"use client";

import { useState } from "react";
import type { FeedbackMode } from "@/types";
import { feedbackRepository } from "@/repositories";
import { useToast } from "@/components/Toast";
import { useLockBodyScroll } from "@/hooks/useLockBodyScroll";

interface Props {
  scheduleId: string;
  mode: FeedbackMode;
  onClose: () => void;
}

export function FeedbackModal({ scheduleId, mode, onClose }: Props) {
  const { showToast } = useToast();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  useLockBodyScroll();

  async function submitFeedback() {
    const trimmedMessage = message.trim();
    if (!trimmedMessage || saving) return;

    try {
      setSaving(true);
      await feedbackRepository.create({
        scheduleId,
        message: trimmedMessage,
        mode,
        pageUrl: window.location.href,
      });
      showToast("피드백을 보냈습니다.", "success");
      onClose();
    } catch (error) {
      console.error("피드백 저장 실패:", error);
      showToast("피드백 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-t-2xl bg-white p-6 shadow-xl">
        <div className="mx-auto mb-5 h-1 w-9 rounded-full bg-[var(--color-border)]" />

        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold">피드백</h2>
          <button
            type="button"
            onClick={onClose}
            className="px-1 text-xl text-[var(--color-text-muted)]"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        <label className="mb-2 block text-sm font-semibold text-[var(--color-text-secondary)]">
          내용
        </label>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="불편한 점이나 제안을 자유롭게 남겨주세요"
          maxLength={1000}
          rows={6}
          className="w-full resize-none rounded-lg border border-[var(--color-border)] px-3.5 py-3 text-sm leading-5 focus:border-[var(--color-primary)] focus:outline-none"
          autoFocus
        />

        <button
          type="button"
          onClick={submitFeedback}
          disabled={!message.trim() || saving}
          className="mt-4 w-full rounded-xl bg-[var(--color-primary)] py-3.5 text-sm font-bold text-white shadow-sm active:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {saving ? "보내는중..." : "보내기"}
        </button>
      </div>
    </div>
  );
}
