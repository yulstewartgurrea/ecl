// src/components/modals/WorkflowPickerModal.tsx
import { useEffect, useMemo, useState } from "react";
import { XMarkIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { listWorkflows, type Workflow } from "../../services/workflow";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export default function WorkflowPickerModal({
  open,
  token,
  onClose,
  onSelect,
}: {
  open: boolean;
  token?: string | null;
  onClose: () => void;
  onSelect: (w: Workflow) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Workflow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const res = await listWorkflows(API_BASE, token); // ApiEnvelope<Workflow[]>
        // keep everything, caller can decide which to use
        setItems(res.data);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load workflows");
      } finally {
        setLoading(false);
      }
    })();
  }, [open, token]);

  const filtered = useMemo(() => {
    if (!q) return items;
    const s = q.toLowerCase();
    return items.filter((w) => {
      const parts = [
        w.entity,
        w.reporting_period ?? (w as any).reportingPeriod,
        w.workflow_name ?? (w as any).name,
        w.directory_path ?? w.workflow_path ?? (w as any).path,
        w.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
         console.log('parts: ', parts)
      return parts.includes(s);
    });
  }, [q, items]);

  if (!open) return null;
 
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl rounded-3xl bg-white/95 shadow-2xl ring-1 ring-slate-200 flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Pick a Completed Workflow
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              Select an existing workflow to reuse its configuration and file structure.
            </p>
          </div>
          <button
            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 transition"
            onClick={onClose}
            title="Close"
          >
            <XMarkIcon className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        {/* Search + meta */}
        <div className="border-b border-slate-200 px-6 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by entity, reporting period, workflow name, or path…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300"
            />
          </div>
          <div className="flex items-center justify-between gap-2 sm:justify-end text-xs text-slate-600">
            <span className="rounded-full bg-slate-50 px-3 py-1 border border-slate-200">
              Total:{" "}
              <span className="font-semibold text-slate-900">
                {items.length}
              </span>
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 border border-emerald-200">
              Matching:{" "}
              <span className="font-semibold text-emerald-800">
                {filtered.length}
              </span>
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="space-y-3">
              <div className="h-4 w-40 rounded bg-slate-100 animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 flex flex-col gap-2 animate-pulse"
                  >
                    <div className="h-3 w-3/5 rounded bg-slate-200" />
                    <div className="h-3 w-2/5 rounded bg-slate-200" />
                    <div className="flex gap-2 mt-1">
                      <div className="h-3 w-16 rounded-full bg-slate-200" />
                      <div className="h-3 w-20 rounded-full bg-slate-200" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {error && !loading && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-slate-500">
              <p className="font-medium text-slate-700">
                No completed workflows found.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try adjusting your search keywords, or create a new workflow from the
                main screen.
              </p>
            </div>
          )}

          {!loading && !error && filtered.length > 0 && (
            <ul className="space-y-2">
              {filtered.map((w) => {
                const entity = w.entity ?? "";
                const period = w.reporting_period ?? (w as any).reportingPeriod ?? "";
                const wfName = w.workflow_name ?? (w as any).name ?? "";
                const label =
                  `/${entity}/${period}/${wfName}`
                    .replace(/\/+/g, "/")
                    .replace(/\/$/, "");
                const path =
                  (w.directory_path ?? w.workflow_path ?? (w as any).path) ||
                  label;
                const status = String(w.status || "").toUpperCase();
                console.log('filtered: ', filtered)
                return (
                  <li key={w.id}>
                    <button
                      onClick={() => onSelect(w)}
                      className="group w-full text-left rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:border-amber-300 hover:bg-amber-50/60 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-amber-300 cursor-pointer transition"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          {/* Top line: Workflow name / label */}
                          <p className="truncate font-medium text-slate-900">
                            {wfName || "(Unnamed workflow)"}
                          </p>
                          {/* Path */}
                          <p className="truncate text-xs text-slate-500">
                            {path}
                          </p>

                          {/* Meta tags: entity + period */}
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {entity && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
                                Entity:&nbsp;{entity}
                              </span>
                            )}
                            {period && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
                                Period:&nbsp;{period}
                              </span>
                            )}
                            {w.baseline_year && (
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 border border-slate-200">
                                Baseline:&nbsp;{w.baseline_year}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status pill */}
                        {/* <span
                          className={`mt-0.5 inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold
                            ${
                              status === "DONE" || status === "COMPLETED"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : status === "RUNNING"
                                ? "bg-amber-50 text-amber-700 border border-amber-200"
                                : "bg-slate-50 text-slate-700 border border-slate-200"
                            }
                          `}
                        >
                          {status || "UNKNOWN"}
                        </span> */}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 cursor-pointer transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
