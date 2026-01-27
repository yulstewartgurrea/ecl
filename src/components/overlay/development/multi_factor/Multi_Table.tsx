// Reusable, headless-ish React + Tailwind table with per-column Excel-style filters
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ========= Types =========
export type Row = Record<string, unknown>;

export type ColumnDef = {
  key: string;
  header?: string;
  widthClass?: string;
  align?: "left" | "center" | "right";
  render?: (value: unknown, row: Row) => React.ReactNode;
};

export type ExcelLikeTableProps = {
  data: Row[];
  columns?: ColumnDef[];
  className?: string;
  emptyMessage?: string;
  onFilteredChange?: (rows: Row[]) => void;

  /** NEW: selection features */
  selectable?: boolean; // default: false
  getRowId?: (row: Row, index: number) => string | number; // strongly recommended
  initialSelectedIds?: Array<string | number>;
  onSelectionChange?: (rows: Row[], ids: Array<string | number>) => void;
};

// ========= Utilities =========
function isNumberLike(val: unknown) {
  if (val == null) return false;
  if (typeof val === "number") return true;
  if (typeof val === "string") return /^-?\d+(?:\.\d+)?$/.test(val.trim());
  return false;
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

  // NEW props (all optional)
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
  const rowIdOf = (row: Row, idx: number): string | number => {
    if (getRowId) return getRowId(row, idx);
    const cands = ["id", "ID", "index", "_id", "uuid", "key"];
    for (const c of cands) {
      const v = (row as any)?.[c];
      if (typeof v === "string" || typeof v === "number") return v;
    }
    // fallback: index (only stable if your data order is stable)
    return idx;
  };

  const normalizeIds = useCallback((ids?: Array<string | number>) => {
    return new Set(ids ?? []);
  }, []);

  // ---- selection set (seed from props if provided)
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(() =>
    normalizeIds(initialSelectedIds)
  );

  // Initialize filters per column
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

  // Sync filters when columns/data change (guarded to avoid update loops)
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

      return changed ? next : prev; // return prev when nothing changed
    });
  }, [derivedColumns, data]);

  // Filtering logic
  const filtered = useMemo(() => {
    if (!data?.length) return [];
    return data.filter((row) => {
      for (const col of derivedColumns) {
        const f = filters[col.key];
        if (!f) continue;
        const raw = row[col.key];
        const strVal = raw == null ? "" : String(raw);

        if (f.checkedValues && f.checkedValues.size > 0) {
          if (!f.checkedValues.has(strVal)) return false;
        }
        if (f.isNumeric && (f.min?.trim() || f.max?.trim())) {
          const n = Number(strVal);
          if (!Number.isFinite(n)) return false;
          if (f.min?.trim() && n < Number(f.min)) return false;
          if (f.max?.trim() && n > Number(f.max)) return false;
        }
      }
      return true;
    });
  }, [data, derivedColumns, filters]);

  const onFilteredChangeRef = useRef(onFilteredChange);
  useEffect(() => {
    onFilteredChangeRef.current = onFilteredChange;
  }, [onFilteredChange]);

  useEffect(() => {
    onFilteredChangeRef.current?.(filtered);
  }, [filtered]);

  // ---- notify on selection change
  const selectedRows = useMemo(() => {
    // compute from full data to ensure we keep rows not currently filtered-in (keeps true selection)
    return data
      .map((r, i) => ({ r, id: rowIdOf(r, i) }))
      .filter(({ id }) => selectedIds.has(id))
      .map(({ r }) => r);
  }, [data, selectedIds, getRowId]);

  const onSelectionChangeRef = useRef(onSelectionChange);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
  }, [onSelectionChange]);

  // Track if we're syncing from initialSelectedIds to prevent callback loops
  const isSyncingRef = useRef(false);
  const prevInitialSelectedIdsRef = useRef<typeof initialSelectedIds>(undefined);

  useEffect(() => {
    // Skip callback if we're in the middle of syncing from initialSelectedIds
    if (isSyncingRef.current) return;
    
    // Compute selectedRows inside the effect to get the latest data
    const computedSelectedRows = data
      .map((r, i) => {
        const id = getRowId ? getRowId(r, i) : rowIdOf(r, i);
        return { r, id };
      })
      .filter(({ id }) => selectedIds.has(id))
      .map(({ r }) => r);
    
    onSelectionChangeRef.current?.(computedSelectedRows, Array.from(selectedIds));
  }, [selectedIds, data, getRowId]);

  // ---- sync selection if initialSelectedIds changes (e.g., workflow change)
  useEffect(() => {
    if (!initialSelectedIds) {
      prevInitialSelectedIdsRef.current = initialSelectedIds;
      return;
    }
    
    // Compare by value to avoid unnecessary updates
    const currentIds = normalizeIds(initialSelectedIds);
    const prevIds = prevInitialSelectedIdsRef.current ? normalizeIds(prevInitialSelectedIdsRef.current) : new Set();
    
    // Check if initialSelectedIds actually changed
    let idsChanged = currentIds.size !== prevIds.size;
    if (!idsChanged) {
      for (const id of currentIds) {
        if (!prevIds.has(id)) {
          idsChanged = true;
          break;
        }
      }
    }
    
    // Update ref before checking if we need to sync
    prevInitialSelectedIdsRef.current = initialSelectedIds;
    
    // Only sync if initialSelectedIds changed AND it's different from current selection
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
      // Reset the flag in the next tick after state update completes
      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    }
  }, [initialSelectedIds, normalizeIds, selectedIds]);

  // ---- select all on current filtered page
  const allVisibleSelected =
    selectable &&
    filtered.length > 0 &&
    filtered.every((row, i) => selectedIds.has(rowIdOf(row, i)));

  function toggleSelectAllVisible() {
    if (!selectable) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filtered.forEach((row, i) => next.delete(rowIdOf(row, i)));
      } else {
        filtered.forEach((row, i) => next.add(rowIdOf(row, i)));
      }
      return next;
    });
  }

  function toggleRow(row: Row, idxInFiltered: number) {
    if (!selectable) return;
    const id = rowIdOf(row, idxInFiltered);
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
      {/* Selection summary (only when selectable) */}
      {selectable && (
        <div className="flex items-center gap-3  border-neutral-200 px-3 py-2 text-xs text-neutral-700">
          <span>
            <strong>{selectedIds.size}</strong> selected
          </span>
          {selectedIds.size > 0 && (
            <button
              className="rounded-md border border-neutral-300 bg-white px-2 py-1 hover:bg-neutral-100"
              onClick={clearSelection}
            >
              Clear
            </button>
          )}
        </div>
      )}

      <div className="max-h-[100vh] min-h-[38rem] overflow-auto">
        <table className="w-full text-left text-sm">
          {/* UPDATED header bg */}
          <thead className="sticky top-0 z-10 bg-gray-700 text-white backdrop-blur">
            <tr className=" border-neutral-200/20">
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
                  {/* relative so the popover anchors to THIS header */}
                  <div className="relative flex items-center gap-2">
                    <span>{col.header ?? headerize(col.key)}</span>
                    <button
                      className="ml-auto rounded-md border border-white/20 px-1.5 py-1 text-xs text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
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
                      title="Filter"
                    >
                      
                    </button>

                    {filters[col.key]?.open && (
                      <FilterPopover
                        columnKey={col.key}
                        rows={data}
                        filter={filters[col.key]}
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
              filtered.map((row, i) => {
                const id = rowIdOf(row, i);
                const isSel = selectable && selectedIds.has(id);
                return (
                  <tr
                    key={i}
                    className={
                      " border-neutral-100 hover:bg-neutral-50 " +
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

// ========= Popover (anchored under header) =========
function FilterPopover({
  columnKey,
  rows,
  filter,
  onChange,
  onClose,
}: {
  columnKey: string;
  rows: Row[];
  filter: ColumnFilter;
  onChange: (update: Partial<ColumnFilter>) => void;
  onClose: () => void;
}) {
  const allValues = useMemo(() => uniqueValues(rows, columnKey), [rows, columnKey]);
  const [tempChecked, setTempChecked] = useState<Set<string>>(
    new Set(filter.checkedValues)
  );
  const [tempSearch, setTempSearch] = useState(filter.search);
  const [tempMin, setTempMin] = useState(filter.min ?? "");
  const [tempMax, setTempMax] = useState(filter.max ?? "");

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
    setTempMin("");
    setTempMax("");
  }
  function apply() {
    onChange({
      checkedValues: tempChecked,
      search: tempSearch,
      min: tempMin,
      max: tempMax,
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
          <div className="sticky top-0 flex items-center gap-2  border-neutral-200 bg-white px-2 py-1.5 text-xs">
            <label className="inline-flex items-center gap-2 select-none">
              <input type="checkbox" checked={allVisibleChecked} onChange={toggleAllVisible} />
              <span className="text-neutral-700">Select shown</span>
            </label>
            <span className="ml-auto text-neutral-500">{filteredList.length} values</span>
          </div>
          <ul className="divide-y divide-neutral-100">
            {filteredList.map((v) => (
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
            {filteredList.length === 0 && (
              <li className="px-2 py-2 text-sm text-neutral-500">No values</li>
            )}
          </ul>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button className="rounded-lg px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100" onClick={clearAll}>
            Clear
          </button>
          <button className="rounded-lg px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100" onClick={onClose}>
            Cancel
          </button>
          <button className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800" onClick={apply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
