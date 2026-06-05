import { useCallback, useEffect, useId, useRef } from "react";

interface UseModalHistoryOptions {
  enabled?: boolean;
  onClose: () => void;
  shouldIgnoreBack?: () => boolean;
}

export function useModalHistory({
  enabled = true,
  onClose,
  shouldIgnoreBack,
}: UseModalHistoryOptions) {
  const modalId = useId();
  const closedRef = useRef(false);
  const enabledRef = useRef(enabled);
  const onCloseRef = useRef(onClose);
  const shouldIgnoreBackRef = useRef(shouldIgnoreBack);

  useEffect(() => {
    enabledRef.current = enabled;
    onCloseRef.current = onClose;
    shouldIgnoreBackRef.current = shouldIgnoreBack;
  });

  useEffect(() => {
    if (!enabled) return;

    const currentState =
      typeof window.history.state === "object" && window.history.state !== null
        ? window.history.state
        : {};

    window.history.pushState(
      { ...currentState, modal: true, modalId },
      "",
      window.location.href
    );

    function handlePopState() {
      if (shouldIgnoreBackRef.current?.()) return;
      if (closedRef.current) return;

      closedRef.current = true;
      onCloseRef.current();
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [enabled, modalId]);

  const closeWithHistory = useCallback((afterClose?: () => void) => {
    if (closedRef.current) return false;

    closedRef.current = true;
    if (enabledRef.current) {
      window.history.back();
    }
    (afterClose ?? onCloseRef.current)();
    return true;
  }, []);

  return {
    closeWithHistory,
    closedRef,
  };
}
