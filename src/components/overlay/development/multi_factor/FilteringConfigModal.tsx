import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { XMarkIcon,  TrashIcon, CheckIcon } from "@heroicons/react/24/outline";
import { type FilterRule, saveFilters, loadFilters } from "../../../../utils/overlay/headersStorage";

type Props = {
  workflowId: number | string;
  headers: string[];
  open: boolean;
  onClose: () => void;
  onApply?: (rules: FilterRule[]) => void; // returns SELECTED + DEFAULT(0) rules
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

const FilteringConfigModal: React.FC<Props> = ({ workflowId, headers, open, onClose, onApply }) => {
  const listId = useId();
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<FilterRule[]>([]);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  // row scrolling + highlight support
  const rowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlightRowId, setHighlightRowId] = useState<string | null>(null);

  // value-validation flags
  const [invalidValueIds, setInvalidValueIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) {
      const existing = loadFilters(workflowId); // only SELECTED rules are persisted
      setRows(existing.length ? existing : [{ id: uid(), column: "", value: "" }]);
      setInvalidValueIds(new Set());
      setTimeout(() => firstInputRef.current?.focus(), 50);
      console.log('setSearch: ', setSearch)
    }
  }, [open, workflowId]);

  const filteredHeaders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return headers;
    return headers.filter((h) => h.toLowerCase().includes(q));
  }, [headers, search]);

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
    setRows((prev) => [...prev, { id: uid(), column: prefill?.column ?? "", value: prefill?.value ?? "" }]);
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
    const selected = rows
      .map((r) => ({ ...r, column: r.column.trim(), value: String(r.value ?? "").trim() }))
      .filter((r) => r.column.length > 0);

    // 2) Validate values: selected must be numeric if provided (non-empty)
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

    // 3) Build defaults: every header not selected gets value 0
    const selectedKeys = new Set(selected.map((r) => r.column.toLowerCase()));
    const defaults: FilterRule[] = headers
      .filter((h) => !selectedKeys.has(h.toLowerCase()))
      .map((h) => ({ id: `__def_${h}`, column: h, value: "0" }));

    const finalRules: FilterRule[] = [...selected, ...defaults];

    // Persist ONLY the explicitly selected rules (so the UI stays clean next open)
    saveFilters(workflowId, selected);
    onApply?.(finalRules);
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
          w-[min(100vw-2rem,900px)]
          -translate-x-1/2 -translate-y-1/2
          rounded-2xl bg-white shadow-2xl ring-1 ring-black/5
          max-h-[85vh] flex flex-col overflow-hidden
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between  p-4">
          <div>
            <h3 className="text-lg font-semibold">Configure Filters</h3>
            <p className="text-xs text-neutral-600">
              Choose a column and enter a numeric value, then click <strong>Apply</strong>. These filters will be used
              when you run the analysis in Step 5.
            </p>
          </div>
          <button onClick={onClose} className="rounded-md p-2 hover:bg-neutral-100">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body (scrolls) */}
        <div className="flex-1 overflow-auto p-4">
          <div className="grid gap-4">
            {/* Optional search (kept hidden by default; wire up if you want) */}
            {/* <div className="flex items-center gap-2">
              <input
                placeholder="Search column headers"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
              />
              <button
                className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm hover:bg-neutral-50"
                onClick={() => addRow()}
                title="Add rule"
              >
                <PlusIcon className="h-4 w-4" /> Add rule
              </button>
            </div> */}

            {/* Quick-pick header chips (scrollable) */}
            <div className="max-h-36 overflow-auto rounded-md border p-2">
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
                          ? "border-yellow-300 bg-yellow-50 text-yellow-900 ring-1 ring-yellow-400"
                          : "border-neutral-300 hover:bg-neutral-50 text-neutral-800",
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
              {headers.map((h) => (
                <option key={h} value={h} />
              ))}
            </datalist>

            {/* COMPACT RULES GRID (2 columns) */}
            <div className="rounded-md border">
              {/* The grid scrolls; 2 cards per row on md+ */}
              <div className="p-2 max-h-[48vh] overflow-auto">
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
                          "relative rounded-lg border px-2 py-2",
                          isHighlighted ? "ring-2 ring-yellow-400" : "",
                        ].join(" ")}
                      >
                        {/* Remove button */}
                        <button
                          onClick={() => removeRow(r.id)}
                          className="absolute right-1.5 top-1.5 rounded-md p-1 text-neutral-500 hover:bg-neutral-100"
                          title="Remove"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>

                        {/* Inputs (tighter spacing, compact text) */}
                        <div className="space-y-1 text-xs">
                          <input
                            ref={idx === 0 ? firstInputRef : null}
                            list={listId}
                            placeholder="Type or pick a column"
                            value={r.column}
                            onChange={(e) => updateRow(r.id, { column: e.target.value })}
                            className="w-full min-w-0 rounded-md border border-neutral-300 px-2 py-1"
                          />
                          <input
                            type="number"
                            step="any"
                            inputMode="decimal"
                            placeholder="Value (e.g., 0.05, 1, -2.5)"
                            value={r.value}
                            onChange={(e) => updateRow(r.id, { value: e.target.value })}
                            className={[
                              "w-full min-w-0 rounded-md px-2 py-1",
                              isInvalid ? "border-red-400 ring-1 ring-red-400" : "border border-neutral-300",
                            ].join(" ")}
                          />
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
        <div className="flex items-center justify-between gap-2 border-t p-4">
          <div className="text-xs text-neutral-500">
            {rows.length} rule{rows.length === 1 ? "" : "s"} configured
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50"
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

