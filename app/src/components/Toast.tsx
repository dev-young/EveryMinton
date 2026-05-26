"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

interface ToastMessage {
  id: number;
  text: string;
  type: "error" | "success" | "info";
  fading: boolean;
}

interface ToastContextType {
  showToast: (text: string, type?: ToastMessage["type"]) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (text: string, type: ToastMessage["type"] = "error") => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, text, type, fading: false }]);
      setTimeout(() => {
        setToasts((prev) =>
          prev.map((t) => (t.id === id ? { ...t, fading: true } : t))
        );
      }, 2000);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 2500);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast Container */}
      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[999] flex flex-col gap-2 w-[calc(100%-32px)] max-w-3xl pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-xl text-sm font-medium shadow-lg pointer-events-auto transition-opacity duration-500 ${
              toast.fading ? "opacity-0" : "animate-slide-down opacity-100"
            } ${
              toast.type === "error"
                ? "bg-[var(--color-danger)]/80 text-white"
                : toast.type === "success"
                ? "bg-[var(--color-accent)]/80 text-white"
                : "bg-[var(--color-primary)]/80 text-white"
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
