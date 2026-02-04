import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { XMarkIcon, TrashIcon, CheckIcon, PlusIcon } from "@heroicons/react/24/outline";
import { type FilterRule, type FilterLogic, saveFilters, loadFilters, saveFilterLogic, loadFilterLogic } from "../../../../utils/overlay/headersStorage";

type Props = {
  workflowId: number | string;
  headers: string[];
  open: boolean;
  onClose: () => void;
  onApply?: (rules: FilterRule[], num_vars_taken?: number, logic: FilterLogic) => void; // returns SELECTED + DEFAULT(0) rules and num_vars_taken
  initialNumVarsTaken?: number; // Initial value for num_vars_taken
  token?: string | null; // Auth token for API calls
  apiBase?: string; // API base URL
  onHeadersUpdate?: (headers: string[]) => void; // Callback to update headers in parent
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const eq = (a?: string, b?: string) =>
  String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

const isNumeric = (v: string) => {
  if (v == null) return false;
  const s = String(v).trim();
  if (s === "") return false;
  const n = Number(s);
  return Number.isFinite(n);
};

const FilteringConfigModal: React.FC<Props> = ({ workflowId, headers, open, onClose, onApply, initialNumVarsTaken = 2, token, apiBase = "http://localhost:8000", onHeadersUpdate }) => {
  const listId = useId();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<FilterRule[]>([]);
  const [num_vars_taken, setNum_vars_taken] = useState<number>(initialNumVarsTaken);
  const [loadingHeaders, setLoadingHeaders] = useState(false);
  const [localHeaders, setLocalHeaders] = useState<string[]>(headers);
  const [logic, setLogic] = useState<FilterLogic>("AND");
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // row scrolling + highlight support
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightRowId, setHighlightRowId] = useState<string | null>(null);

  // value-validation flags
  const [invalidValueIds, setInvalidValueIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      const existing = loadFilters(workflowId); // only SELECTED rules are persisted
      const savedLogic = loadFilterLogic(workflowId);
      setRows(
        existing.length
          ? existing
          : [{ id: uid(), column: "", operator: ">", value: "" }]
      );
      setNum_vars_taken(initialNumVarsTaken);
      setLocalHeaders(headers);
      setLogic(savedLogic);
      setInvalidValueIds(new Set());
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [open, workflowId, initialNumVarsTaken, headers]);

  // Sync localHeaders when headers prop changes
  useEffect(() => {
    setLocalHeaders(headers);
  }, [headers]);

  const filteredHeaders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return localHeaders;
    return localHeaders.filter((h) => h.toLowerCase().includes(q));
  }, [localHeaders, search]);

  // Fetch headers from API
  const fetchHeaders = async () => {
    if (!Number.isFinite(Number(workflowId)) || !token) {
      return;
    }

    setLoadingHeaders(true);
    try {
      const url = `${apiBase}/api/overlay/development/filtering_models/mfa_file/headers/?workflow_id=${encodeURIComponent(Number(workflowId))}&num_of_vars=${encodeURIComponent(num_vars_taken)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.warn("Failed to fetch MFA headers");
        return;
      }

      const data = await res.json();
      const apiHeaders = data?.data?.headers || [];
      setLocalHeaders(apiHeaders);
      onHeadersUpdate?.(apiHeaders);
    } catch (e: any) {
      console.warn("Error fetching MFA headers:", e);
    } finally {
      setLoadingHeaders(false);
    }
  };

  // usage map to mark active chips
  const usageCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const key = String(r.column ?? "").trim().toLowerCase();
      if (!key) continue;
      m.set(key, (m.get(key) ?? 0) + 1);
    }
    return m;
  }, [rows]);

  function updateRow(id: string, patch: Partial<FilterRule>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    // live-validate the value if patch includes value
    if (Object.prototype.hasOwnProperty.call(patch, "value")) {
      const val = String((patch as any).value ?? "");
      setInvalidValueIds((prev) => {
        const next = new Set(prev);
        if (val.trim() === "" || isNumeric(val)) next.delete(id);
        else next.add(id);
        return next;
      });
    }
  }

  function addRow(prefill?: Partial<FilterRule>) {
    setRows((prev) => [
      ...prev,
      {
        id: uid(),
        column: prefill?.column ?? "",
        operator: prefill?.operator ?? ">",
        value: prefill?.value ?? "",
      },
    ]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
    setInvalidValueIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  // When a chip is clicked: if already used  jump to it; else add a prefilled rule
  function handleChipClick(header: string) {
    const lower = header.toLowerCase();
    const existing = rows.find((r) => eq(r.column, lower) || eq(r.column, header));
    if (existing) {
      const node = rowRefs.current[existing.id];
      if (node) {
        node.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightRowId(existing.id);
        window.setTimeout(() => setHighlightRowId(null), 900);
      }
    } else {
      addRow({ column: header });
    }
  }

  function handleApply() {
    // 1) Clean user-selected rules (only rows with a column)
    const selected: FilterRule[] = rows
      .map((r) => ({
        ...r,
        column: r.column.trim(),
        operator: (r.operator?.trim() || ">") as FilterRule["operator"],
        value: String(r.value ?? "").trim(),
      }))
      .filter((r) => r.column.length > 0);

    // 2) Validate: operator must be present and valid
    const validOperators = [">", "<", ">=", "<=", "==", "!="];
    const invalidOperatorIds = new Set<string>();
    for (const r of selected) {
      if (!r.operator || !validOperators.includes(r.operator)) {
        invalidOperatorIds.add(r.id);
      }
    }
    if (invalidOperatorIds.size > 0) {
      setInvalidValueIds(invalidOperatorIds);
      const firstBad = selected.find((r) => invalidOperatorIds.has(r.id));
      if (firstBad) {
        const node = rowRefs.current[firstBad.id];
        node?.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightRowId(firstBad.id);
        window.setTimeout(() => setHighlightRowId(null), 900);
      }
      return; // block Apply until fixed
    }

    // 3) Validate values: selected must be numeric if provided (non-empty)
    const badIds = new Set<string>();
    for (const r of selected) {
      if (r.value === "" || !isNumeric(r.value)) badIds.add(r.id);
    }
    if (badIds.size > 0) {
      setInvalidValueIds(badIds);
      const firstBad = selected.find((r) => badIds.has(r.id));
      if (firstBad) {
        const node = rowRefs.current[firstBad.id];
        node?.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightRowId(firstBad.id);
        window.setTimeout(() => setHighlightRowId(null), 900);
      }
      return; // block Apply until fixed
    }

    // 3) Only send selected rules - no defaults
    // Persist ONLY the explicitly selected rules (so the UI stays clean next open)
    saveFilters(workflowId, selected);
    onApply?.(selected, num_vars_taken, logic);
    saveFilterLogic(workflowId, logic);
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog (fixed height with scrolling body) */}
      <div
        className="
          absolute left-1/2 top-1/2
          w-[min(100vw-2rem,940px)]
          -translate-x-1/2 -translate-y-1/2
          rounded-2xl bg-white shadow-2xl ring-1 ring-neutral-100
          max-h-[85vh] flex flex-col overflow-hidden
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-neutral-100">
          <div>
            <h3 className="text-lg font-semibold text-neutral-900">Configure Filters</h3>
            <p className="text-xs text-neutral-500">
              Choose a column, select an operator, and enter a numeric value. Click <strong>Apply</strong> to save.
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-neutral-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body (scrolls) */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-4">
            {/* Number of variables per combination */}
            <div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label htmlFor="num_vars_taken" className="block text-sm font-medium text-gray-700 mb-2">
                    Number of variables per combination
                  </label>
                  <input
                    id="num_vars_taken"
                    type="number"
                    min="1"
                    step="1"
                    value={num_vars_taken}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow positive integers
                      if (value === "" || (Number.isInteger(Number(value)) && Number(value) > 0)) {
                        setNum_vars_taken(value === "" ? 2 : Number(value));
                      }
                    }}
                    onKeyDown={(e) => {
                      // Prevent decimal point, negative sign, and 'e' key
                      if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') {
                        e.preventDefault();
                      }
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="Enter number of variables per combination"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Must be a positive integer (default: 2)
                  </p>
                </div>
                <button
                  onClick={fetchHeaders}
                  disabled={loadingHeaders || !Number.isFinite(Number(workflowId)) || !token}
                  className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
                  title="Fetch headers from API"
                >
                  {loadingHeaders ? "Loading..." : "Set Headers"}
                </button>
              </div>
            </div>

            {/* Search + add */}
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="relative flex-1">
                <input
                  placeholder="Search columns (optional)"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-800 placeholder:text-neutral-400"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-neutral-600">Logic</label>
                <select
                  value={logic}
                  onChange={(e) => setLogic(e.target.value as FilterLogic)}
                  className="rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm text-neutral-800"
                >
                  <option value="AND">AND</option>
                  <option value="OR">OR</option>
                </select>
              </div>
              <button
                className="inline-flex items-center justify-center gap-2 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-800 hover:bg-neutral-50"
                onClick={() => addRow()}
                title="Add rule"
              >
                <PlusIcon className="h-4 w-4" /> Add rule
              </button>
            </div>

            {/* Quick-pick header chips (scrollable) */}
            <div className="max-h-36 overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-2">
              <div className="flex flex-wrap gap-2">
                {filteredHeaders.map((h) => {
                  const count = usageCount.get(h.toLowerCase()) ?? 0;
                  const active = count > 0;
                  return (
                    <button
                      key={h}
                      onClick={() => handleChipClick(h)}
                      className={[
                        "group inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs",
                        active
                          ? "border-yellow-200 bg-yellow-50 text-yellow-900 ring-1 ring-yellow-200"
                          : "border-neutral-200 hover:bg-white text-neutral-800",
                      ].join(" ")}
                      title={active ? "Already added  click to jump to rule" : "Add rule with this column"}
                      aria-pressed={active}
                    >
                      {active && <CheckIcon className="h-3.5 w-3.5" />}
                      <span className="truncate max-w-[12rem]">{h}</span>
                      {active && (
                        <span className="ml-1 rounded-full bg-yellow-100 px-1.5 text-[10px] leading-4">{count}</span>
                      )}
                    </button>
                  );
                })}
                {filteredHeaders.length === 0 && (
                  <span className="text-xs text-neutral-500">No headers match your search.</span>
                )}
              </div>
            </div>

            {/* Datalist provider for column input autocomplete */}
            <datalist id={listId}>
              {localHeaders.map((h) => (
                <option key={h} value={h} />
              ))}
            </datalist>

            {/* COMPACT RULES GRID (2 columns) */}
            <div className="rounded-md border border-neutral-200">
              {/* The grid scrolls; 2 cards per row on md+ */}
              <div className="p-2 max-h-[48vh] overflow-auto bg-white">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {rows.map((r, idx) => {
                    const isHighlighted = highlightRowId === r.id;
                    const isInvalid = invalidValueIds.has(r.id);

                    return (
                      <div
                        key={r.id}
                        ref={(el) => {
                          rowRefs.current[r.id] = el;
                        }}
                        className={[
                          "relative rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-2",
                          isHighlighted ? "ring-2 ring-yellow-200" : "",
                        ].join(" ")}
                      >
                        {/* Remove button */}
                        <button
                          onClick={() => removeRow(r.id)}
                          className="absolute right-1.5 top-1.5 rounded-md p-1 text-neutral-500 hover:bg-white"
                          title="Remove"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>

                        {/* Inputs (tighter spacing, compact text) */}
                        <div className="space-y-1 text-xs">
                          <label className="block text-[11px] text-neutral-500">Column</label>
                          <input
                            ref={idx === 0 ? firstInputRef : null}
                            list={listId}
                            placeholder="Type or pick a column"
                            value={r.column}
                            onChange={(e) => updateRow(r.id, { column: e.target.value })}
                            className="w-full min-w-0 rounded-md border border-neutral-200 bg-white px-2 py-1"
                          />
                          <div className="grid grid-cols-[90px_1fr] gap-2">
                            <div>
                              <label className="block text-[11px] text-neutral-500">Operator</label>
                              <select
                                value={r.operator ?? ">"}
                                onChange={(e) => updateRow(r.id, { operator: e.target.value as any })}
                                className="w-full rounded-md border border-neutral-200 bg-white px-2 py-1 text-sm"
                              >
                                <option value="==">=</option>
                                <option value=">">&gt;</option>
                                <option value="<">&lt;</option>
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
                                  "w-full min-w-0 rounded-md px-2 py-1 bg-white",
                                  isInvalid ? "border-red-300 ring-1 ring-red-200" : "border border-neutral-200",
                                ].join(" ")}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {rows.length === 0 && (
                    <div className="col-span-full px-3 py-6 text-center text-sm text-neutral-500">
                      No rules yet. Click <strong>Add</strong> above or use the quick-pick chips.
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* END rules grid */}
          </div>
        </div>

        {/* Footer (sticks to bottom) */}
        <div className="flex items-center justify-between gap-2 border-t border-neutral-100 p-4">
          <div className="text-xs text-neutral-500">
            {rows.length} rule{rows.length === 1 ? "" : "s"} configured
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm text-neutral-800 hover:bg-neutral-50"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600"
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

