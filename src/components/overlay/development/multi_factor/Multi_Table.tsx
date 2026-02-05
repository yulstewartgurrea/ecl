// src/components/overlay/development/multi_factor/Multi_Table.tsx
// Reusable, headless-ish React + Tailwind table with per-column Excel-style filters
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FunnelIcon } from "@heroicons/react/24/outline";

// ========= Types =========
export type Row = Record<string, unknown>;

export type ColumnDef = {
  key: string;
  header?: string;
  widthClass?: string;
  align?: "left" | "center" | "right";
  render?: (value: unknown, row: Row) => React.ReactNode;
};

export type ColumnValuesMap = Record<string, string[]>;
export type AppliedSelectionsMap = Record<string, string[]>;
export type FilterItem = { column: string; values: string[] };

export type ExcelLikeTableProps = {
  data: Row[];
  columns?: ColumnDef[];
  className?: string;
  emptyMessage?: string;
  onFilteredChange?: (rows: Row[]) => void;

  // When serverMode=true, page/pageSize are only for UI display controlled by parent
  page?: number;
  pageSize?: number;

  /** NEW: server-side mode */
  serverMode?: boolean;

  /** NEW: server-driven column values (for header filters) */
  columnValuesMap?: ColumnValuesMap;
  columnValuesLoading?: boolean;
  appliedSelections?: AppliedSelectionsMap;
  onAppliedSelectionsChange?: (next: AppliedSelectionsMap) => void;
  onApplyFilters?: (filters: FilterItem[]) => void;

  /** selection features */
  selectable?: boolean;
  getRowId?: (row: Row, index: number) => string | number;
  initialSelectedIds?: Array<string | number>;
  onSelectionChange?: (rows: Row[], ids: Array<string | number>) => void;
};

// ========= Utilities =========
function isNumberLike(val: unknown) {
  if (val == null) return false;
  if (typeof val === "number") return Number.isFinite(val);
  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return false;
    const normalized = s.replace(/,/g, "").replace(/%/g, "");
    return /^-?\d+(?:\.\d+)?$/.test(normalized);
  }
  return false;
}

function parseNumeric(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return null;
    const normalized = s.replace(/,/g, "").replace(/%/g, "");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function roundForCompare(n: number, digits = 6) {
  const p = Math.pow(10, digits);
  return Math.round(n * p) / p;
}

function uniqueValues(rows: Row[], key: string): string[] {
  const set = new Set<string>();
  for (const r of rows) {
    const v = r[key];
    if (v === null || v === undefined) continue;
    set.add(String(v));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function formatCell(v: unknown) {
  if (v == null) return "";
  if (typeof v === "number") return Number.isFinite(v) ? v.toLocaleString() : String(v);
  return String(v);
}
function headerize(k: string) {
  return k
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase())
    .replace(/\s+\w+/g, (m) => m);
}

function setEqualsArray(set: Set<string>, arr?: string[]) {
  if (!arr || set.size !== arr.length) return false;
  for (const v of arr) {
    if (!set.has(v)) return false;
  }
  return true;
}

// ========= Filter State =========
export type ColumnFilter = {
  checkedValues: Set<string>;
  search: string;
  min?: string;
  max?: string;
  isNumeric: boolean;
  open: boolean;
};

// ========= Main Component =========
export function Multi_Table({
  data,
  columns,
  className,
  emptyMessage = "No data",
  onFilteredChange,
  page,
  pageSize,
  serverMode = false,
  columnValuesMap,
  columnValuesLoading = false,
  appliedSelections,
  onAppliedSelectionsChange,
  onApplyFilters,

  selectable = false,
  getRowId,
  initialSelectedIds,
  onSelectionChange,
}: ExcelLikeTableProps) {
  const derivedColumns: ColumnDef[] = useMemo(() => {
    if (columns && columns.length) return columns;
    if (!data?.length) return [];
    return Object.keys(data[0]).map((k) => ({ key: k, header: headerize(k) }));
  }, [columns, data]);

  // ---- selection id helper
  const rowIdOf = useCallback(
    (row: Row, idx: number): string | number => {
      if (getRowId) return getRowId(row, idx);
      const cands = ["id", "ID", "index", "_id", "uuid", "key"];
      for (const c of cands) {
        const v = (row as any)?.[c];
        if (typeof v === "string" || typeof v === "number") return v;
      }
      return idx;
    },
    [getRowId]
  );

  const normalizeIds = useCallback((ids?: Array<string | number>) => {
    return new Set(ids ?? []);
  }, []);

  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(() =>
    normalizeIds(initialSelectedIds)
  );

  // Initialize filters per column (only meaningful for client mode / page-local filtering)
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>(() => {
    const init: Record<string, ColumnFilter> = {};
    for (const col of derivedColumns) {
      const sample = data?.find((r) => r[col.key] != null)?.[col.key];
      init[col.key] = {
        checkedValues: new Set<string>(),
        search: "",
        min: undefined,
        max: undefined,
        isNumeric: isNumberLike(sample),
        open: false,
      };
    }
    return init;
  });

  // Sync filters when columns/data change (guarded)
  useEffect(() => {
    setFilters((prev) => {
      const next: Record<string, ColumnFilter> = {};
      let changed = false;

      for (const col of derivedColumns) {
        const sample = data?.find((r) => r[col.key] != null)?.[col.key];
        const prevF = prev[col.key];

        const base: ColumnFilter =
          prevF ?? {
            checkedValues: new Set<string>(),
            search: "",
            min: undefined,
            max: undefined,
            isNumeric: isNumberLike(sample),
            open: false,
          };

        const isNumericNow = isNumberLike(sample);
        const merged: ColumnFilter = { ...base, isNumeric: isNumericNow };

        if (!prevF) changed = true;
        else if (prevF.isNumeric !== isNumericNow) changed = true;

        next[col.key] = merged;
      }

      if (Object.keys(prev).length !== Object.keys(next).length) changed = true;
      return changed ? next : prev;
    });
  }, [derivedColumns, data]);

  useEffect(() => {
    if (!appliedSelections) return;
    setFilters((prev) => {
      let changed = false;
      const next: Record<string, ColumnFilter> = { ...prev };

      for (const col of derivedColumns) {
        const applied = appliedSelections[col.key];
        const existing = prev[col.key];
        if (!existing) continue;

        if (applied && !setEqualsArray(existing.checkedValues, applied)) {
          next[col.key] = {
            ...existing,
            checkedValues: new Set(applied),
          };
          changed = true;
        }

        if (!applied && existing.checkedValues.size > 0) {
          next[col.key] = { ...existing, checkedValues: new Set() };
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [appliedSelections, derivedColumns]);

  // Filtering logic:
  // - In serverMode: backend result is the "filtered set".
  const filtered = useMemo(() => {
    if (!data?.length) return [];
    if (!derivedColumns.length) return data;
    if (serverMode) return data;

    return data.filter((row) => {
      for (const col of derivedColumns) {
        const f = filters[col.key];
        if (!f) continue;

        const raw = row[col.key];
        const strVal = raw == null ? "" : String(raw);

        if (f.search?.trim()) {
          const needle = f.search.trim().toLowerCase();
          if (!strVal.toLowerCase().includes(needle)) return false;
        }

        if (f.checkedValues && f.checkedValues.size > 0) {
          if (!f.checkedValues.has(strVal)) return false;
        }

        if (f.isNumeric && (f.min?.trim() || f.max?.trim())) {
          const nRaw = parseNumeric(raw);
          if (nRaw == null) return false;
          const n = roundForCompare(nRaw);

          if (f.min?.trim()) {
            const minVal = parseNumeric(f.min);
            if (minVal == null) return false;
            if (n < roundForCompare(minVal)) return false;
          }
          if (f.max?.trim()) {
            const maxVal = parseNumeric(f.max);
            if (maxVal == null) return false;
            if (n > roundForCompare(maxVal)) return false;
          }
        }
      }
      return true;
    });
  }, [data, derivedColumns, filters, serverMode]);

  // Visible rows:
  const safePage = Math.max(1, page ?? 1);
  const safePageSize = Math.max(1, pageSize ?? (filtered.length || 1));

  const pageStart = (safePage - 1) * safePageSize;
  const pageEnd = pageStart + safePageSize;

  const visibleRows = useMemo(() => {
    if (serverMode) return filtered;
    return filtered.slice(pageStart, pageEnd);
  }, [filtered, pageStart, pageEnd, serverMode]);

  // Report filtered rows to parent
  const onFilteredChangeRef = useRef(onFilteredChange);
  useEffect(() => {
    onFilteredChangeRef.current = onFilteredChange;
  }, [onFilteredChange]);

  useEffect(() => {
    onFilteredChangeRef.current?.(filtered);
  }, [filtered]);

  // ---- id -> row map (for current data only)
  const rowIdMap = useMemo(() => {
    const map = new Map<string | number, Row>();
    data.forEach((r, i) => {
      map.set(rowIdOf(r, i), r);
    });
    return map;
  }, [data, rowIdOf]);

  // ---- selected rows (only those available in this page map)
  const selectedRows = useMemo(() => {
    const out: Row[] = [];
    selectedIds.forEach((id) => {
      const row = rowIdMap.get(id);
      if (row) out.push(row);
    });
    return out;
  }, [selectedIds, rowIdMap]);

  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  const isSyncingRef = useRef(false);
  const prevInitialSelectedIdsRef = useRef<typeof initialSelectedIds>(undefined);

  useEffect(() => {
    if (isSyncingRef.current) return;
    onSelectionChangeRef.current?.(selectedRows, Array.from(selectedIds));
  }, [selectedIds, selectedRows]);

  // Sync selection if initialSelectedIds changes
  useEffect(() => {
    if (!initialSelectedIds) {
      prevInitialSelectedIdsRef.current = initialSelectedIds;
      return;
    }

    const currentIds = normalizeIds(initialSelectedIds);
    const prevIds = prevInitialSelectedIdsRef.current
      ? normalizeIds(prevInitialSelectedIdsRef.current)
      : new Set();

    let idsChanged = currentIds.size !== prevIds.size;
    if (!idsChanged) {
      for (const id of currentIds) {
        if (!prevIds.has(id)) {
          idsChanged = true;
          break;
        }
      }
    }

    prevInitialSelectedIdsRef.current = initialSelectedIds;
    if (!idsChanged) return;

    let same = currentIds.size === selectedIds.size;
    if (same) {
      for (const id of currentIds) {
        if (!selectedIds.has(id)) {
          same = false;
          break;
        }
      }
    }

    if (!same) {
      isSyncingRef.current = true;
      setSelectedIds(currentIds);
      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    }
  }, [initialSelectedIds, normalizeIds, selectedIds]);

  // Select all on current visible rows
  const allVisibleSelected =
    selectable &&
    visibleRows.length > 0 &&
    visibleRows.every((row, i) =>
      selectedIds.has(rowIdOf(row, serverMode ? i : pageStart + i))
    );

  function toggleSelectAllVisible() {
    if (!selectable) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        visibleRows.forEach((row, i) =>
          next.delete(rowIdOf(row, serverMode ? i : pageStart + i))
        );
      } else {
        visibleRows.forEach((row, i) =>
          next.add(rowIdOf(row, serverMode ? i : pageStart + i))
        );
      }
      return next;
    });
  }

  function toggleRow(row: Row, idxInVisible: number) {
    if (!selectable) return;
    const globalIndex = serverMode ? idxInVisible : pageStart + idxInVisible;
    const id = rowIdOf(row, globalIndex);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // Close popovers when clicking outside table
  const tableRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!tableRef.current) return;
      if (!tableRef.current.contains(e.target as Node)) {
        setFilters((prev) => {
          const next = { ...prev } as Record<string, ColumnFilter>;
          for (const k of Object.keys(next)) next[k] = { ...next[k], open: false };
          return next;
        });
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  return (
    <div
      ref={tableRef}
      className={
        "overflow-visible rounded-2xl border border-neutral-200 bg-white " +
        (className ?? "")
      }
    >
      {selectable && (
        <div className="flex items-center gap-3 border-neutral-200 px-3 py-2 text-xs text-neutral-700">
          <span>
            <strong>{selectedIds.size}</strong> selected
          </span>
          {selectedIds.size > 0 && (
            <button
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 hover:bg-neutral-100"
              onClick={clearSelection}
              type="button"
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="max-h-[100vh] min-h-[38rem] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-gray-700 text-white backdrop-blur">
            <tr className="border-neutral-200/20">
              {selectable && (
                <th className="w-10 px-3 py-2">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={!!allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      aria-label="Select visible rows"
                    />
                  </label>
                </th>
              )}

              {derivedColumns.map((col) => (
                <th
                  key={col.key}
                  className={
                    "whitespace-nowrap px-3 py-2 font-medium " +
                    (col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left")
                  }
                >
                  <div className="relative flex items-center gap-2">
                    <span>{col.header ?? headerize(col.key)}</span>

                    <button
                      type="button"
                      className={
                        "ml-auto inline-flex items-center justify-center rounded-md border border-white/20 px-1.5 py-1 text-xs text-white " +
                        "hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      }
                      onClick={() =>
                        setFilters((prev) => ({
                          ...prev,
                          [col.key]: {
                            ...prev[col.key],
                            open: !prev[col.key].open,
                          },
                        }))
                      }
                      aria-haspopup="dialog"
                      aria-expanded={filters[col.key]?.open || false}
                      aria-label={`Filter ${col.header ?? headerize(col.key)}`}
                      title={serverMode ? "Filters apply to this page only" : "Filter"}
                    >
                      <FunnelIcon
                        className={
                          "h-4 w-4 " +
                          (filters[col.key]?.open ? "opacity-100" : "opacity-90")
                        }
                        aria-hidden="true"
                      />
                    </button>

                    {filters[col.key]?.open && (
                      <FilterPopover
                        columnKey={col.key}
                        rows={data}
                        filter={filters[col.key]}
                        values={
                          columnValuesMap
                            ? columnValuesMap[col.key] ?? []
                            : undefined
                        }
                        valuesLoading={columnValuesLoading}
                        appliedSelections={appliedSelections}
                        onAppliedSelectionsChange={onAppliedSelectionsChange}
                        onApplyFilters={onApplyFilters}
                        onClose={() =>
                          setFilters((prev) => ({
                            ...prev,
                            [col.key]: { ...prev[col.key], open: false },
                          }))
                        }
                        onChange={(upd) =>
                          setFilters((prev) => ({
                            ...prev,
                            [col.key]: { ...prev[col.key], ...upd },
                          }))
                        }
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={derivedColumns.length + (selectable ? 1 : 0)}
                  className="px-3 py-6 text-center text-neutral-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row, i) => {
                const id = rowIdOf(row, serverMode ? i : pageStart + i);
                const isSel = selectable && selectedIds.has(id);

                return (
                  <tr
                    key={String(id)}
                    className={
                      "border-neutral-100 hover:bg-neutral-50 " +
                      (isSel ? "bg-yellow-50/40" : "")
                    }
                  >
                    {selectable && (
                      <td className="px-3 py-2 align-top">
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleRow(row, i)}
                          aria-label={`Select row ${i + 1}`}
                        />
                      </td>
                    )}

                    {derivedColumns.map((col) => (
                      <td
                        key={col.key}
                        className={
                          "px-3 py-2 align-top text-neutral-800 " +
                          (col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left")
                        }
                      >
                        {col.render ? col.render(row[col.key], row) : formatCell(row[col.key])}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ========= Popover =========
function FilterPopover({
  columnKey,
  rows,
  filter,
  values,
  valuesLoading,
  appliedSelections,
  onAppliedSelectionsChange,
  onApplyFilters,
  onChange,
  onClose,
}: {
  columnKey: string;
  rows: Row[];
  filter: ColumnFilter;
  values?: string[];
  valuesLoading?: boolean;
  appliedSelections?: AppliedSelectionsMap;
  onAppliedSelectionsChange?: (next: AppliedSelectionsMap) => void;
  onApplyFilters?: (filters: FilterItem[]) => void;
  onChange: (update: Partial<ColumnFilter>) => void;
  onClose: () => void;
}) {
  const allValues = useMemo(() => {
    if (values) return values;
    if (valuesLoading) return [];
    return uniqueValues(rows, columnKey);
  }, [values, valuesLoading, rows, columnKey]);

  const [tempChecked, setTempChecked] = useState<Set<string>>(
    () => new Set(filter.checkedValues)
  );
  const [tempSearch, setTempSearch] = useState(filter.search);
  
  useEffect(() => {
    setTempChecked(new Set(filter.checkedValues));
    setTempSearch(filter.search);
  }, [filter.checkedValues, filter.search]);

  const filteredList = useMemo(() => {
    const q = tempSearch.trim().toLowerCase();
    return allValues.filter((v) => (q ? v.toLowerCase().includes(q) : true));
  }, [allValues, tempSearch]);

  const allVisibleChecked =
    filteredList.length > 0 && filteredList.every((v) => tempChecked.has(v));

  function toggleValue(v: string) {
    setTempChecked((s) => {
      const next = new Set(s);
      next.has(v) ? next.delete(v) : next.add(v);
      return next;
    });
  }

  function toggleAllVisible() {
    setTempChecked((s) => {
      const next = new Set(s);
      if (allVisibleChecked) filteredList.forEach((v) => next.delete(v));
      else filteredList.forEach((v) => next.add(v));
      return next;
    });
  }

  function clearAll() {
    setTempChecked(new Set());
    setTempSearch("");
  }

  function apply() {
    const nextApplied: AppliedSelectionsMap = {
      ...(appliedSelections ?? {}),
      [columnKey]: Array.from(tempChecked),
    };
    if (nextApplied[columnKey].length === 0) {
      delete nextApplied[columnKey];
    }

    if (onApplyFilters) {
      const list: FilterItem[] = Object.entries(nextApplied)
        .filter(([, vals]) => Array.isArray(vals) && vals.length > 0)
        .map(([column, vals]) => ({ column, values: vals }));
      onApplyFilters(list);
    }

    onAppliedSelectionsChange?.(nextApplied);
    onChange({
      checkedValues: tempChecked,
      search: tempSearch,
    });
    onClose();
  }

  return (
    <div
      role="dialog"
      aria-label={`Filter ${columnKey}`}
      className="absolute left-0 top-full z-50 mt-1 w-72 max-w-[min(18rem,calc(100vw-2rem))] rounded-xl border border-neutral-200 bg-white p-3 shadow-xl text-neutral-900"
    >
      <div className="space-y-3">
        <input
          value={tempSearch}
          onChange={(e) => setTempSearch(e.target.value)}
          placeholder="Search values"
          className="w-full rounded-lg border border-neutral-200 px-2.5 py-1.5 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-300 focus:ring-2 focus:ring-neutral-300"
        />

        <div className="max-h-48 overflow-auto rounded-lg border border-neutral-200">
          <div className="sticky top-0 flex items-center gap-2 border-neutral-200 bg-white px-2 py-1.5 text-xs">
            <label className="inline-flex items-center gap-2 select-none">
              <input
                type="checkbox"
                checked={allVisibleChecked}
                onChange={toggleAllVisible}
              />
              <span className="text-neutral-700">Select shown</span>
            </label>
            <span className="ml-auto text-neutral-500">{filteredList.length} values</span>
          </div>

          <ul className="divide-y divide-neutral-100">
            {valuesLoading && (
              <li className="px-2 py-2 text-sm text-neutral-500">Loading…</li>
            )}
            {!valuesLoading && filteredList.map((v) => (
              <li key={v} className="flex items-center gap-2 px-2 py-1.5 text-sm">
                <input
                  id={`${columnKey}-${v}`}
                  type="checkbox"
                  checked={tempChecked.has(v)}
                  onChange={() => toggleValue(v)}
                />
                <label
                  htmlFor={`${columnKey}-${v}`}
                  className="line-clamp-1 select-none text-neutral-900"
                  title={v}
                >
                  {v}
                </label>
              </li>
            ))}

            {!valuesLoading && filteredList.length === 0 && (
              <li className="px-2 py-2 text-sm text-neutral-500">No values</li>
            )}
          </ul>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
            onClick={clearAll}
          >
            Clear
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800"
            onClick={apply}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
