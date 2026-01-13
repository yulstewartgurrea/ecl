// components/asa/table/SpreadsheetTable.tsx
import React, { useMemo } from "react";

export type Column<T> = {
  key: keyof T | string;
  header: string;
  width?: number | string;
  align?: "left" | "center" | "right";
  sticky?: boolean;
  formatter?: (value: any, row: T, rowIndex: number) => React.ReactNode;
};

export type SpreadsheetTableProps<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey?: (row: T, index: number) => string | number;
  height?: number | string;
  dense?: boolean;
  zebra?: boolean;
  emptyText?: string;
  className?: string;

  headerBg?: string; // CSS color
  headerText?: string; // CSS color

  /** @deprecated use headerBg */
  headerColor?: string;
  /** @deprecated use headerText */
  headerTextColor?: string;

  toolbar?: React.ReactNode;

  /**
   * ✅ NEW
   * Auto-sort headers like:
   * date, 0 day, par 1, par 30, par 60, par 90, par 120, ..., total loan balance with c/p
   */
  autoSortParHeaders?: boolean;
};

function NAIndicator() {
  return (
    <span
      aria-hidden
      className="absolute left-0 top-0"
      style={{
        width: 0,
        height: 0,
        borderLeft: "10px solid #22c55e",
        borderTop: "10px solid transparent",
      }}
    />
  );
}

/** ---------------------------
 *  Header sorting helpers
 * --------------------------- */
function norm(s: string) {
  return (s ?? "").toLowerCase().trim().replace(/\s+/g, " ");
}

function parseParNumber(header: string): number | null {
  const m = norm(header).match(/^par\s*(\d+)$/);
  return m ? Number(m[1]) : null;
}

function isZeroDay(header: string) {
  return /^0\s*day$/.test(norm(header));
}

function isDateHeader(col: { header: string; key: any }) {
  // be flexible: header "date" OR key "date"
  return norm(col.header) === "date" || String(col.key).toLowerCase() === "date";
}

function isTotalLoanBalance(header: string) {
  // match your exact label but allow case/spaces
  return norm(header) === "total loan balance with c/p";
}

function sortColumnsForParDisplay<T>(columns: Column<T>[]) {
  // stable sort: keep original index as fallback
  const withMeta = columns.map((c, idx) => {
    const h = c.header ?? "";

    // ranking groups:
    // 0: date
    // 1: 0 day
    // 2: par N (ascending by N)
    // 8: everything else (keep original order)
    // 9: total loan balance (force last)
    let group = 8;
    let num = 0;

    if (isDateHeader({ header: h, key: c.key })) {
      group = 0;
    } else if (isZeroDay(h)) {
      group = 1;
      num = 0;
    } else {
      const par = parseParNumber(h);
      if (par != null) {
        group = 2;
        num = par;
      } else if (isTotalLoanBalance(h)) {
        group = 9;
      }
    }

    return { c, idx, group, num };
  });

  withMeta.sort((a, b) => {
    if (a.group !== b.group) return a.group - b.group;

    // within PAR group sort by number
    if (a.group === 2 && a.num !== b.num) return a.num - b.num;

    // otherwise preserve original order
    return a.idx - b.idx;
  });

  return withMeta.map((x) => x.c);
}

export function SpreadsheetTable<T>({
  columns,
  rows,
  rowKey,
  height = 520,
  dense = false,
  zebra = true,
  emptyText = "No records",
  className = "",
  headerBg,
  headerText,
  headerColor,
  headerTextColor,
  toolbar,
  autoSortParHeaders = false,
}: SpreadsheetTableProps<T>) {
  const cellPad = dense ? "px-2 py-1.5" : "px-3 py-2.5";
  const headPad = dense ? "px-2 py-2" : "px-3 py-3";
  const rowClass = zebra ? "odd:bg-white even:bg-gray-50" : "bg-white";

  const resolvedHeaderBg = headerBg ?? headerColor ?? "#F8F8F8";
  const resolvedHeaderText = headerText ?? headerTextColor ?? "#111827";

  const displayColumns = useMemo(() => {
    return autoSortParHeaders ? sortColumnsForParDisplay(columns) : columns;
  }, [columns, autoSortParHeaders]);

  return (
    <div className={`rounded-2xl border border-gray-200 shadow-sm bg-white ${className}`}>
      {toolbar && (
        <div className="px-3 py-2 border-b bg-white rounded-t-2xl flex items-center justify-between">
          <div>{toolbar}</div>
        </div>
      )}

      <div className="overflow-x-auto">
        <div
          className="overflow-y-auto"
          style={{ maxHeight: typeof height === "number" ? `${height}px` : height }}
        >
          {/* ✅ border-separate helps sticky header borders */}
          <table className="min-w-full table-fixed text-sm border-separate border-spacing-0">
            <thead
              className="sticky top-0 z-10 border-b"
              style={{ background: resolvedHeaderBg, color: resolvedHeaderText }}
            >
              <tr>
                {displayColumns.map((c, i) => (
                  <th
                    key={String(c.key) + i}
                    className={`${headPad} align-middle font-semibold border-r last:border-r-0 whitespace-nowrap ${
                      c.align === "right"
                        ? "text-right"
                        : c.align === "center"
                        ? "text-center"
                        : "text-left"
                    } ${c.sticky ? "sticky left-0 shadow-[2px_0_0_rgba(0,0,0,0.05)] z-20" : ""}`}
                    style={{
                      width: c.width ?? 160,
                      minWidth: c.width ?? 160,
                      maxWidth: c.width ?? 600,
                      background: resolvedHeaderBg,
                      color: resolvedHeaderText,
                    }}
                  >
                    {/* ✅ header alignment wrapper (works with sort icons too) */}
                    <div
                      className={`flex w-full items-center gap-2 ${
                        c.align === "right"
                          ? "justify-end"
                          : c.align === "center"
                          ? "justify-center"
                          : "justify-start"
                      }`}
                    >
                      <span className="min-w-0 truncate">{c.header}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-gray-600 text-center bg-white" colSpan={displayColumns.length}>
                    {emptyText}
                  </td>
                </tr>
              )}

              {rows.map((row, rIdx) => {
                const key = rowKey ? rowKey(row, rIdx) : rIdx;
                return (
                  <tr key={key} className={rowClass}>
                    {displayColumns.map((c, i) => {
                      const raw =
                        typeof c.key === "string"
                          ? (row as any)[c.key]
                          : (row as any)[c.key as any];

                      const content = c.formatter ? c.formatter(raw, row, rIdx) : (raw ?? "");
                      const showNA = typeof raw === "string" && raw.trim().toUpperCase() === "#N/A";

                      return (
                        <td
                          key={String(c.key) + i}
                          className={`relative ${cellPad} border-r last:border-r-0 border-b ${
                            c.align === "right"
                              ? "text-right"
                              : c.align === "center"
                              ? "text-center"
                              : "text-left"
                          } ${c.sticky ? "sticky left-0 bg-white shadow-[2px_0_0_rgba(0,0,0,0.04)] z-10" : ""}`}
                          style={{
                            width: c.width ?? 160,
                            minWidth: c.width ?? 160,
                            maxWidth: c.width ?? 600,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={typeof raw === "string" ? raw : undefined}
                        >
                          {showNA && <NAIndicator />}
                          {content}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
