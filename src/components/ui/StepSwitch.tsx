import { useEffect, useRef, useState } from "react";
import { ChevronDownIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

export type StepItem = { label: string; completed?: boolean };

type StepSwitchProps = {
  steps: StepItem[];
  activeIndex: number;
  onChange: (index: number) => void;
  className?: string;
};

export default function StepSwitch({
  steps,
  activeIndex,
  onChange,
  className,
}: StepSwitchProps) {
  const [open, setOpen] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);

  // close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!open) return;
      if (popRef.current && !popRef.current.contains(e.target as Node))
        setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  const active = steps[activeIndex];

  return (
    <div className={clsx("flex items-center gap-3", className)}>
      {/* Segmented tabs (desktop) */}
      <div
        role="tablist"
        aria-label="Overlay steps"
        className="hidden md:inline-flex rounded-2xl bg-gray-100 p-1 shadow-inner"
      >
        {steps.map((s, i) => {
          const selected = i === activeIndex;
          return (
            <button
              key={s.label}
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(i)}
              className={clsx(
                "px-4 py-2 text-sm font-medium rounded-xl transition focus:outline-none focus-visible:ring-2 focus-visible:ring-black/10",
                selected
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50",
              )}
            >
              <span className="inline-flex items-center gap-2">
                {s.label}
                {s.completed ? (
                  <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                ) : null}
              </span>
            </button>
          );
        })}
      </div>

      {/* Dropdown (mobile) */}
      <div ref={popRef} className="relative md:hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-yellow-200 px-3 py-2 text-sm font-semibold text-gray-900 shadow hover:bg-yellow-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          {active.label}
          <ChevronDownIcon
            className={clsx(
              "h-4 w-4 transition-transform",
              open ? "rotate-180" : "",
            )}
          />
        </button>

        {open && (
          <div
            role="menu"
            className="absolute left-0 mt-2 w-56 overflow-hidden rounded-2xl border border-yellow-200 bg-white/90 backdrop-blur shadow-2xl"
          >
            {steps.map((s, i) => {
              const selected = i === activeIndex;
              return (
                <button
                  key={s.label}
                  role="menuitem"
                  onClick={() => {
                    onChange(i);
                    setOpen(false);
                  }}
                  className={clsx(
                    "w-full px-4 py-3 text-left text-sm  last: transition",
                    selected
                      ? "bg-yellow-100/80 font-semibold text-gray-900"
                      : "text-gray-800 hover:bg-yellow-50",
                  )}
                >
                  <span className="inline-flex items-center gap-2">
                    {s.label}
                    {s.completed ? (
                      <CheckCircleIcon className="h-4 w-4 text-emerald-600" />
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
