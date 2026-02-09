import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FunnelIcon } from "@heroicons/react/24/outline";

export type Row = Record<string, unknown>;

export type ColumnDef = {
  key: string;
  header?: string;
  widthClass?: string;
  align?: "left" | "center" | "right";
};

export type ColumnValuesMap = Record<string, string[]>;
export type AppliedSelectionsMap = Record<string, string[]>;
export type FilterItem = { column: string; values: string[] };

export type ExcelLikeTableProps = {
  data: Row[];
  columns?: ColumnDef[];
  emptyMessage?: string;

  serverMode?: boolean;
  columnValuesMap?: ColumnValuesMap;
  columnValuesLoading?: boolean;

  onFilteredChange?: (rows: Row[]) => void;

  appliedSelections?: AppliedSelectionsMap;
  onAppliedSelectionsChange?: (next: AppliedSelectionsMap) => void;
  onApplyFilters?: (filters: FilterItem[]) => void;

  selectable?: boolean;
  getRowId?: (row: Row, index: number) => string | number;
  initialSelectedIds?: Array<string | number>;
  onSelectionChange?: (rows: Row[], ids: Array<string | number>) => void;
};

type ColumnFilter = {
  checked: Set<string>;
  open: boolean;
};

export function Multi_Table({
  data,
  columns,
  emptyMessage = "No data",
  serverMode = false,
  columnValuesMap = {},
  columnValuesLoading = false,
  appliedSelections,
  onAppliedSelectionsChange,
  onApplyFilters,
  selectable = false,
  getRowId,
  initialSelectedIds,
  onSelectionChange,
}: ExcelLikeTableProps) {
  /* ---------------- DERIVED COLUMNS ---------------- */
  const derivedColumns: ColumnDef[] = useMemo(() => {
    if (columns?.length) return columns;
    if (!data.length) return [];
    return Object.keys(data[0]).map((k) => ({
      key: k,
      header: k.replace(/_/g, " ").toUpperCase(),
    }));
  }, [columns, data]);

  /* ---------------- FILTER STATE ---------------- */
  const [filters, setFilters] = useState<Record<string, ColumnFilter>>({});

  // Ensure every column always has filter state
  useEffect(() => {
    setFilters((prev) => {
      const next = { ...prev };
      derivedColumns.forEach((col) => {
        if (!next[col.key]) {
          next[col.key] = { checked: new Set<string>(), open: false };
        }
      });
      return next;
    });
  }, [derivedColumns]);

  // Restore persisted selections from parent (CRITICAL FIX)
  useEffect(() => {
    if (!appliedSelections) return;

    setFilters((prev) => {
      const next = { ...prev };
      derivedColumns.forEach((col) => {
        next[col.key] = {
          checked: new Set(appliedSelections[col.key] ?? []),
          open: false,
        };
      });
      return next;
    });
  }, [appliedSelections, derivedColumns]);

  const applyFilters = useCallback(() => {
    if (!onApplyFilters) return;

    const payload: FilterItem[] = [];
    Object.entries(filters).forEach(([col, f]) => {
      if (f.checked.size > 0) {
        payload.push({
          column: col,
          values: Array.from(f.checked),
        });
      }
    });

    onApplyFilters(payload);
    onAppliedSelectionsChange?.(
      Object.fromEntries(payload.map((p) => [p.column, p.values]))
    );
  }, [filters, onApplyFilters, onAppliedSelectionsChange]);

  /* ---------------- ROW SELECTION ---------------- */
  const rowIdOf = useCallback(
    (row: Row, idx: number) => (getRowId ? getRowId(row, idx) : idx),
    [getRowId]
  );

  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(
    new Set(initialSelectedIds ?? [])
  );

  // Sync external initial selection changes
  useEffect(() => {
    setSelectedIds(new Set(initialSelectedIds ?? []));
  }, [initialSelectedIds]);

  useEffect(() => {
    if (!onSelectionChange) return;
    const rows = data.filter((r, i) => selectedIds.has(rowIdOf(r, i)));
    onSelectionChange(rows, Array.from(selectedIds));
  }, [selectedIds, data, rowIdOf, onSelectionChange]);

  /* ---------------- RENDER ---------------- */
  return (
    <div className="rounded-xl border bg-white overflow-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-gray-700 text-white">
          <tr>
            {selectable && <th className="w-8" />}
            {derivedColumns.map((col) => {
              const values = columnValuesMap[col.key] ?? [];
              const f = filters[col.key] ?? { checked: new Set<string>(), open: false };

              return (
                <th key={col.key} className="px-3 py-2">
                  <div className="relative flex items-center gap-2">
                    <span>{col.header}</span>

                    {values.length > 0 && (
                      <button
                        onClick={() =>
                          setFilters((prev) => ({
                            ...prev,
                            [col.key]: {
                              checked: prev[col.key]?.checked ?? new Set<string>(),
                              open: !(prev[col.key]?.open ?? false),
                            },
                          }))
                        }
                      >
                        <FunnelIcon className="h-4 w-4 text-white" />
                      </button>
                    )}

                    {f.open && (
                      <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-md border bg-white p-2 shadow">
                        {columnValuesLoading ? (
                          <div className="text-xs">Loading…</div>
                        ) : (
                          values.map((v) => (
                            <label key={v} className="flex items-center gap-2 text-xs">
                              <input
                                type="checkbox"
                                checked={f.checked.has(v)}
                                onChange={(e) => {
                                  setFilters((prev) => {
                                    const next = new Set(prev[col.key]?.checked ?? []);
                                    e.target.checked ? next.add(v) : next.delete(v);
                                    return {
                                      ...prev,
                                      [col.key]: {
                                        ...prev[col.key],
                                        checked: next,
                                      },
                                    };
                                  });
                                }}
                              />
                              {v}
                            </label>
                          ))
                        )}

                        <button
                          onClick={applyFilters}
                          className="mt-2 w-full rounded bg-yellow-500 px-2 py-1 text-xs text-white"
                        >
                          Apply
                        </button>
                      </div>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={derivedColumns.length + (selectable ? 1 : 0)}
                className="p-4 text-center text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => {
              const id = rowIdOf(row, i);
              return (
                <tr key={String(id)} className="border-t">
                  {selectable && (
                    <td className="px-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(id)}
                        onChange={() =>
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            next.has(id) ? next.delete(id) : next.add(id);
                            return next;
                          })
                        }
                      />
                    </td>
                  )}

                  {derivedColumns.map((col) => (
                    <td key={col.key} className="px-3 py-2">
                      {String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
