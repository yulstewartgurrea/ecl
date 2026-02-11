// src/components/overlay/development/multi_factor/FilteringConfigModal.tsx
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { XMarkIcon, TrashIcon, CheckIcon, PlusIcon } from "@heroicons/react/24/outline";
import {
  type FilterRule,
  saveFilters,
  loadFilters,
} from "../../../../utils/overlay/headersStorage";

type Props = {
  workflowId: number | string;
  headers: string[];
  open: boolean;
  onClose: () => void;
  onApply?: (rules: FilterRule[], numVarsTaken?: number) => void;
  initialNumVarsTaken?: number;
  token?: string | null;
  apiBase?: string;
  onHeadersUpdate?: (headers: string[]) => void;
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const eq = (a?: string, b?: string) =>
  String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

const isNumeric = (v: string) => {
  const s = String(v ?? "").trim();
  if (!s) return false;
  return Number.isFinite(Number(s));
};

// Reorder headers: coeff x1, coeff x2, coeff x3... then stderr x1, stderr x2, stderr x3...
// Keep all other columns in their original order
function reorderHeaders(hdrs: string[]): string[] {
  if (!hdrs || hdrs.length === 0) return hdrs;

  const coeffRe = /^coeff\s*x?(\d+)$/i;
  const stderrRe = /^stderr\s*x?(\d+)$/i;

  const coeffCols: Array<{ name: string; idx: number }> = [];
  const stderrCols: Array<{ name: string; idx: number }> = [];
  const others: string[] = [];

  for (const k of hdrs) {
    let match: RegExpMatchArray | null = null;

    if ((match = k.match(coeffRe))) {
      coeffCols.push({ name: k, idx: Number(match[1]) });
    } else if ((match = k.match(stderrRe))) {
      stderrCols.push({ name: k, idx: Number(match[1]) });
    } else {
      others.push(k);
    }
  }

  // Sort coeff and stderr by their numeric index
  coeffCols.sort((a, b) => a.idx - b.idx);
  stderrCols.sort((a, b) => a.idx - b.idx);

  // Rebuild result: coeff x1, coeff x2... then stderr x1, stderr x2... then others in original order
  const result: string[] = [];
  result.push(...coeffCols.map((c) => c.name));
  result.push(...stderrCols.map((s) => s.name));
  result.push(...others);

  return result;
}

const FilteringConfigModal: React.FC<Props> = ({
  workflowId,
  headers,
  open,
  onClose,
  onApply,
  initialNumVarsTaken = 3,
  token,
  apiBase = "http://localhost:8000",
  onHeadersUpdate,
}) => {
  const listId = useId();

  const [rows, setRows] = useState<FilterRule[]>([]);
  const [search, setSearch] = useState("");
  const [localHeaders, setLocalHeaders] = useState<string[]>([]);
  const [loadingHeaders, setLoadingHeaders] = useState(false);
  const [invalidValueIds, setInvalidValueIds] = useState<Set<string>>(new Set());

  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // fetch-once-per-open guard (stronger than a simple boolean)
  const openSeqRef = useRef(0);
  const lastFetchedKeyRef = useRef<string>("");
  /* ---------------- Modal open lifecycle ---------------- */

  useEffect(() => {
    if (!open) return;

    openSeqRef.current += 1;

    const saved = loadFilters(workflowId);

    setRows(saved); // no default row
    setInvalidValueIds(new Set());
    setSearch("");

    // start with what parent already has (instant UI), then API can overwrite
    setLocalHeaders(Array.isArray(headers) ? headers : []);

    requestAnimationFrame(() => firstInputRef.current?.focus());
  }, [open, workflowId, headers]);

  /* ---------------- Fetch headers ONCE per modal open ---------------- */

  useEffect(() => {
    if (!open) return;

    const wid = Number(workflowId);
    if (!Number.isFinite(wid) || !token) {
      // still show whatever we already have from props
      if (Array.isArray(headers) && headers.length > 0) setLocalHeaders(headers);
      return;
    }

    // unique key for "this open"
    const openKey = `${wid}:${openSeqRef.current}`;
    if (lastFetchedKeyRef.current === openKey) return;
    lastFetchedKeyRef.current = openKey;

    const ac = new AbortController();

    async function fetchHeadersOnce() {
      setLoadingHeaders(true);
      console.log('json2: ')
      try {
        const url =
          `${apiBase}/api/overlay/development/filtering_models/mfa_file/headers` +
          `?workflow_id=${encodeURIComponent(wid)}`;
console.log('url: ', url)
        const res = await fetch(url, {
          method: "GET",
          signal: ac.signal,
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        console.log('res: ', res)
        if (!res.ok) {
          // fallback to props headers if API fails
          if (Array.isArray(headers) && headers.length > 0) setLocalHeaders(headers);
          return;
        }

        const json = await res.json();
        console.log('json: ', json)
        console.log('json.data: ', json?.data)
        console.log('json.data.headers: ', json?.data?.headers)
        const apiHeaders: string[] = json?.data?.headers ?? [];
        console.log('apiHeaders: ', apiHeaders)

        if (Array.isArray(apiHeaders) && apiHeaders.length > 0) {
          console.log('Setting localHeaders with', apiHeaders.length, 'headers')
          setLocalHeaders(apiHeaders);
          onHeadersUpdate?.(apiHeaders);
        } else {
          console.log('No headers from API, falling back to props headers')
          // fallback to props headers if API returns empty
          if (Array.isArray(headers) && headers.length > 0) setLocalHeaders(headers);
        }
      } catch {
        // ignore abort/errors; fallback to props
        if (Array.isArray(headers) && headers.length > 0) setLocalHeaders(headers);
      } finally {
        setLoadingHeaders(false);
      }
    }

    fetchHeadersOnce();

    return () => {
      ac.abort();
    };
  }, [open, workflowId, token, apiBase, onHeadersUpdate, headers]);

  /* ---------------- Derived ---------------- */

  const filteredHeaders = useMemo(() => {
    const q = search.trim().toLowerCase();
    const ordered = reorderHeaders(localHeaders);
    if (!q) return ordered;
    return ordered.filter((h) => h.toLowerCase().includes(q));
  }, [localHeaders, search]);

  const usageCount = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const col = String(r.column ?? "").trim();
      if (!col) return;
      const k = col.toLowerCase();
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return map;
  }, [rows]);

  /* ---------------- Actions ---------------- */

  function addRow(prefill?: Partial<FilterRule>) {
    setRows((prev) => [
      ...prev,
      {
        id: uid(),
        column: prefill?.column ?? "",
        operator: (prefill?.operator as any) ?? ">",
        value: String(prefill?.value ?? ""),
      },
    ]);
    requestAnimationFrame(() => firstInputRef.current?.focus());
  }

  function updateRow(id: string, patch: Partial<FilterRule>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

    if (Object.prototype.hasOwnProperty.call(patch, "value")) {
      const v = String((patch as any).value ?? "");
      setInvalidValueIds((prev) => {
        const next = new Set(prev);
        if (!v.trim() || isNumeric(v)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setInvalidValueIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  function handleChipClick(header: string) {
    const existing = rows.find((r) => eq(r.column, header));
    if (existing) {
      const node = rowRefs.current[existing.id];
      node?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    addRow({ column: header });
  }

  function handleApply() {
    console.log('handleApply - rows:', rows);
    // only keep truly valid selections
    const selected: FilterRule[] = rows
      .map((r) => ({
        ...r,
        column: String(r.column ?? "").trim(),
        operator: ((r.operator as any) ?? ">") as FilterRule["operator"],
        value: String(r.value ?? "").trim(),
      }))
      .filter((r) => r.column.length > 0);

    console.log('handleApply - selected after column filter:', selected);

    const validOperators = [">", "<", ">=", "<=", "==", "!="];
    const bad = new Set<string>();

    for (const r of selected) {
      if (!r.operator || !validOperators.includes(r.operator)) bad.add(r.id);
      if (!r.value || !isNumeric(r.value)) bad.add(r.id);
    }

    console.log('handleApply - bad rules:', Array.from(bad));
    console.log('handleApply - selected before validation:', selected);

    if (bad.size > 0) {
      setInvalidValueIds(bad);
      return;
    }

    console.log('handleApply - calling onApply with:', selected);
    saveFilters(workflowId, selected);
    onApply?.(selected, initialNumVarsTaken);
    onClose();
  }

  if (!open) return null;

  const hasHeaders = localHeaders.length > 0;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="absolute left-1/2 top-1/2 w-[min(100vw-2rem,940px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-neutral-900">Configure Filters</h3>
            <p className="mt-1 text-xs text-neutral-500">
              Pick a column, operator, and numeric value. Only valid rules are saved.
            </p>

            <div className="mt-2 flex items-center gap-2 text-[11px] text-neutral-500">
              <span className="rounded-full bg-neutral-100 px-2 py-0.5">
                {loadingHeaders ? "Fetching headers…" : hasHeaders ? `${localHeaders.length} headers loaded` : "No headers"}
              </span>
              {!token && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">Missing token</span>}
            </div>
          </div>

          <button onClick={onClose} className="rounded-xl p-2 hover:bg-neutral-100" aria-label="Close">
            <XMarkIcon className="h-5 w-5 text-neutral-700" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto px-5 pb-5">
          {/* Top controls */}
          <div className="sticky top-0 z-10 bg-white pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[240px]">
                <input
                  placeholder="Search headers"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-xl bg-neutral-100 px-3 py-2 text-sm text-neutral-900 outline-none placeholder:text-neutral-400 focus:bg-neutral-50"
                />
              </div>

              <button
                type="button"
                onClick={() => addRow()}
                className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
              >
                <PlusIcon className="h-4 w-4" />
                Add rule
              </button>
            </div>
          </div>

          {/* Header chips */}
          <div className="rounded-2xl bg-neutral-50 p-3">
            <div className="flex flex-wrap gap-2">
              {filteredHeaders.map((h) => {
                const count = usageCount.get(h.toLowerCase()) ?? 0;
                const active = count > 0;

                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleChipClick(h)}
                    className={[
                      "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs transition",
                      active ? "bg-yellow-100 text-yellow-900" : "bg-white text-neutral-800 hover:bg-neutral-100",
                    ].join(" ")}
                    title={active ? "Already used - click to jump" : "Add rule for this header"}
                    aria-pressed={active}
                  >
                    {active && <CheckIcon className="h-3.5 w-3.5" />}
                    <span className="max-w-[16rem] truncate">{h}</span>
                    {active && (
                      <span className="ml-1 rounded-full bg-yellow-200/60 px-1.5 text-[10px] leading-4">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}

              {!loadingHeaders && filteredHeaders.length === 0 && (
                <span className="px-2 py-1 text-xs text-neutral-500">
                  {hasHeaders ? "No headers match your search." : "No headers found. Check Step 4/Token/Workflow ID."}
                </span>
              )}
            </div>
          </div>

          {/* Datalist */}
          <datalist id={listId}>
            {localHeaders.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>

          {/* Rules */}
          <div className="mt-4">
            {rows.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 text-center text-sm text-neutral-500 shadow-sm">
                No rules yet. Pick a header above or click <strong>Add rule</strong>.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {rows.map((r, i) => {
                  const invalid = invalidValueIds.has(r.id);

                  return (
                    <div
                      key={r.id}
                      ref={(el) => {
                        rowRefs.current[r.id] = el; // ✅ return void
                      }}
                      className="relative rounded-2xl bg-white p-3 shadow-sm"
                    >
                      <button
                        type="button"
                        onClick={() => removeRow(r.id)}
                        className="absolute right-2 top-2 rounded-xl p-2 text-neutral-500 hover:bg-neutral-100"
                        title="Remove"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>

                      <div className="space-y-2">
                        <div>
                          <label className="block text-[11px] text-neutral-500">Column</label>
                          <input
                            ref={i === 0 ? firstInputRef : null}
                            list={listId}
                            placeholder="Type or pick a column"
                            value={r.column}
                            onChange={(e) => updateRow(r.id, { column: e.target.value })}
                            className="mt-1 w-full rounded-xl bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-neutral-50"
                          />
                        </div>

                        <div className="grid grid-cols-[110px_1fr] gap-2">
                          <div>
                            <label className="block text-[11px] text-neutral-500">Operator</label>
                            <select
                              value={r.operator ?? ">"}
                              onChange={(e) => updateRow(r.id, { operator: e.target.value as any })}
                              className="mt-1 w-full rounded-xl bg-neutral-100 px-3 py-2 text-sm outline-none focus:bg-neutral-50"
                            >
                              <option value="==">=</option>
                              <option value=">">&gt;</option>
                              <option value="<">&lt;</option>
                              <option value=">=">&gt;=</option>
                              <option value="<=">&lt;=</option>
                              <option value="!=">!=</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] text-neutral-500">Value</label>
                            <input
                              type="number"
                              step="any"
                              inputMode="decimal"
                              placeholder="e.g., 0.05"
                              value={r.value}
                              onChange={(e) => updateRow(r.id, { value: e.target.value })}
                              className={[
                                "mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none",
                                invalid ? "bg-red-50 text-red-900" : "bg-neutral-100 focus:bg-neutral-50",
                              ].join(" ")}
                            />
                            {invalid && (
                              <p className="mt-1 text-[11px] text-red-700">Value must be numeric and not empty.</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-neutral-100 px-5 py-4">
          <div className="text-xs text-neutral-500">
            {rows.length} rule{rows.length === 1 ? "" : "s"} configured
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-neutral-100 px-4 py-2 text-sm text-neutral-900 hover:bg-neutral-200"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleApply}
              className="rounded-xl bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FilteringConfigModal;
