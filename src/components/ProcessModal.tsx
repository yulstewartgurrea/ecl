import React, { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  heading: string;
  steps: React.ReactNode[];
  continueLabel?: string;
};

export function ProcessModal({
  open,
  onClose,
  heading,
  steps,
  continueLabel = "Continue",
}: ModalProps) {
  const labelId = useId();
  const descId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  // Close on ESC + prevent page scroll while open
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.documentElement.style.overflow;
    document.addEventListener("keydown", onKey);
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Focus trap
  useEffect(() => {
    if (!open) return;
    const root = panelRef.current;
    if (!root) return;

    const focusable = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"]),input,select,textarea',
        ),
      ).filter(
        (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden"),
      );

    // focus first interactive element
    setTimeout(() => {
      (closeBtnRef.current ?? focusable()[0])?.focus();
    }, 0);

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = focusable();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (active === first || !root.contains(active)) {
          last.focus();
          e.preventDefault();
        }
      } else {
        if (active === last) {
          first.focus();
          e.preventDefault();
        }
      }
    };

    root.addEventListener("keydown", handleTab as any);
    return () => root.removeEventListener("keydown", handleTab as any);
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      aria-describedby={descId}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed inset-0 flex items-end sm:items-center justify-center p-4 sm:p-6">
        <div
          ref={panelRef}
          className="relative w-full max-w-3xl transform overflow-hidden rounded-2xl bg-white/95 backdrop-blur ring-1 ring-black/5 shadow-2xl"
        >
          {/* Top bar */}
          <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-400 to-amber-300 px-5 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-gray-900 shadow">
              {/* spark icon */}
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 2l1.8 5.3L19 9l-5.2 1.7L12 16l-1.8-5.3L5 9l5.2-1.7L12 2z" />
              </svg>
            </div>
            <h1
              id={labelId}
              className="text-lg sm:text-xl font-bold tracking-tight text-gray-900"
            >
              {heading}
            </h1>

            <button
              ref={closeBtnRef}
              onClick={onClose}
              className="cursor-pointer ml-auto inline-flex items-center justify-center rounded-lg p-2 text-gray-800/80 hover:bg-gray-200/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
              aria-label="Close"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6.4 4.9l12.7 12.7-1.5 1.5L4.9 6.4 6.4 4.9zm12.7 0l1.5 1.5L7.9 21.1l-1.5-1.5L19.1 4.9z" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="px-5 sm:px-6 py-5">
            <p id={descId} className="text-sm text-gray-700">
              Under <span className="font-semibold">{heading}</span>, the
              following steps must be accomplished:
            </p>

            <ol className="mt-4 space-y-3">
              {steps.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-xl border border-gray-200/70 bg-gray-50 px-3 py-3 sm:px-4"
                >
                  <span className="mt-0.5 inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-yellow-200 font-semibold text-gray-900">
                    {i + 1}
                  </span>
                  <div className="text-[15px] leading-relaxed text-gray-900">
                    {s}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t bg-white/90 px-5 py-3 backdrop-blur sm:px-6">
            <button
              onClick={onClose}
              className="cursor-pointer inline-flex items-center gap-2 rounded-xl bg-yellow-200 px-4 py-2.5 text-sm font-semibold text-gray-900 shadow hover:bg-yellow-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
            >
              {continueLabel}
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M13 5l7 7-7 7v-4H4v-6h9V5z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
