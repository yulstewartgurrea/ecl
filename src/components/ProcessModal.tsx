import React, { useEffect, useRef } from "react";
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
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          ref={panelRef}
          className="relative w-full max-w-5xl rounded-2xl bg-white shadow-2xl border border-gray-200"
        >
          <div className="px-6 pt-6 pb-3">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              {heading}
            </h1>
          </div>

          <div className="px-6 pb-6">
            <div className="rounded-2xl border border-yellow-100 bg-yellow-50 px-6 py-6 md:px-8 md:py-8">
              <p className="text-gray-800 text-base md:text-lg leading-relaxed">
                Under <span className="font-semibold">{heading}</span>, the following steps must be accomplished:
              </p>
              <ol className="mt-4 list-decimal pl-6 space-y-3 text-gray-900">
                {steps.map((s, i) => (
                  <li key={i} className="leading-relaxed">
                    {s}
                  </li>
                ))}
              </ol>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={onClose}
                className="group inline-flex items-center gap-2 rounded-full bg-yellow-400 px-5 py-3 font-semibold text-gray-900 shadow hover:bg-yellow-500 focus:outline-none focus-visible:ring ring-yellow-300"
              >
                {continueLabel} <span aria-hidden>&gt;</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
