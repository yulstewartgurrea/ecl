// ==========================
// components/asa/table/ui/TableFilterPopover.tsx (UPDATED)
// ==========================
import { useEffect, useMemo, useRef, useState } from "react";
import { FunnelIcon, ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";

type Props = {
  value: string | null;
  options: string[];
  onApply: (val: string | null) => void;
  onClear?: () => void;
  label?: string;
  title?: string;
  align?: "left" | "right";
  className?: string;
};

export default function TableFilterPopover({
  value,
  options,
  onApply,
  onClear,
  label = "Filter",
  title = "Filter by product",
  align = "right",
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const [temp, setTemp] = useState<string | null>(value ?? null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) setTemp(value ?? null); }, [open, value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const hasFilter = useMemo(() => value !== null, [value]);

  return (
    <div ref={rootRef} className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-300 bg-yellow-400 border-yellow-400 text-gray-900 hover:brightness-95 ${hasFilter ? "" : ""}`}
        title="Filter"
      >
        <FunnelIcon className="h-4 w-4" />
        {label}
        <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className={`absolute z-50 mt-2 w-80 rounded-xl border border-gray-200 bg-white shadow-xl`}
          style={align === "right" ? { right: 0 } : { left: 0 }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b rounded-t-xl bg-yellow-50">
            <div className="text-sm font-semibold text-gray-800">{title}</div>
            <button
              type="button"
              className="p-1 text-gray-600 hover:bg-yellow-400/30 rounded-md"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-gray-600">Product</label>
              <select
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
                value={temp ?? ""}
                onChange={(e) => setTemp(e.target.value ? e.target.value : null)}
              >
                <option value="">All products</option>
                {options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setTemp(null);
                  onClear?.();
                  onApply(null);
                  setOpen(false);
                }}
                className="rounded-lg border border-yellow-400 bg-yellow-400 px-3 py-1.5 text-sm text-gray-900 hover:brightness-95"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={() => {
                  onApply(temp ?? null);
                  setOpen(false);
                }}
                className="rounded-lg bg-yellow-400 border border-yellow-400 px-3 py-1.5 text-sm font-medium text-gray-900 hover:brightness-95"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}