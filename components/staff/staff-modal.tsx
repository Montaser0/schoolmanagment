"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type StaffModalSize = "sm" | "md" | "lg";

export function StaffModal({
  open,
  onClose,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  size?: StaffModalSize;
  children: ReactNode;
}) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const maxW = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-lg" : "max-w-md";

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex h-[100dvh] w-full items-center justify-center bg-black/40 p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`pointer-events-auto relative z-[1] w-full rounded-2xl border border-border bg-background p-5 shadow-lg ${maxW}`}
        dir="rtl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
