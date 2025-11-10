// src/components/modals/WorkflowPickerModal.tsx
import { useEffect, useMemo, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
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
        // keep only status === "done" (case-insensitive)
        // const done = (res.data || []).filter(
        //   (w) => String(w.status ?? "").toLowerCase() === "done"
        // );
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
        w.reporting_period ?? w.reportingPeriod,
        w.workflow_name ?? w.name,
        w.directory_path ?? w.workflow_path ?? w.path,
        w.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return parts.includes(s);
    });
  }, [q, items]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h3 className="text-base font-semibold text-gray-900">Pick a Completed Workflow</h3>
          <button className="p-1 rounded hover:bg-gray-100" onClick={onClose} title="Close">
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-5 py-3 border-b">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by entity, period, name, path…"
            className="w-full rounded-xl border px-3 py-2 text-sm"
          />
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-auto p-5">
          {loading && <p className="text-sm text-gray-600">Loading…</p>}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {!loading && !error && filtered.length === 0 && (
            <p className="text-sm text-gray-600">No completed workflows found.</p>
          )}

          <ul className="space-y-2">
            {filtered.map((w) => {
              const label =
                `/${w.entity ?? ""}/${w.reporting_period ?? w.reportingPeriod ?? ""}/${w.workflow_name ?? w.name ?? ""}`
                  .replace(/\/+/g, "/")
                  .replace(/\/$/, "");
              const path = (w.directory_path ?? w.workflow_path ?? w.path) || label;

              return (
                <li key={w.id}>
                  <button
                    onClick={() => onSelect(w)}
                    className="w-full text-left rounded-xl border px-4 py-3 hover:bg-gray-50 focus:outline-none  cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{label}</p>
                        <p className="truncate text-xs text-gray-500">{path}</p>
                      </div>
                      <span className="ml-4 shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {String(w.status || "").toUpperCase()}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}