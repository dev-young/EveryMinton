"use client";

import { useEffect } from "react";

/**
 * 바텀시트/모달이 열릴 때 body 스크롤을 잠그는 훅
 */
export function useLockBodyScroll() {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);
}
