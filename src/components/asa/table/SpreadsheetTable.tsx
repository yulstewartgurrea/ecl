// components/asa/table/SpreadsheetTable.tsx
import React from "react";

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
}: SpreadsheetTableProps<T>) {
  const cellPad = dense ? "px-2 py-1.5" : "px-3 py-2.5";
  const headPad = dense ? "px-2 py-2" : "px-3 py-3";
  const rowClass = zebra ? "odd:bg-white even:bg-gray-50" : "bg-white";

  const resolvedHeaderBg = headerBg ?? headerColor ?? "#F8F8F8";
  const resolvedHeaderText = headerText ?? headerTextColor ?? "#111827";

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
          <table className="min-w-full table-fixed text-sm">
            <thead
              className="sticky top-0 z-10 border-b"
              style={{ background: resolvedHeaderBg, color: resolvedHeaderText }}
            >
              <tr>
                {columns.map((c, i) => (
                  <th
                    key={String(c.key) + i}
                    className={`${headPad} font-semibold border-r last:border-r-0 ${
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
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-gray-600 text-center bg-white" colSpan={columns.length}>
                    {emptyText}
                  </td>
                </tr>
              )}

              {rows.map((row, rIdx) => {
                const key = rowKey ? rowKey(row, rIdx) : rIdx;
                return (
                  <tr key={key} className={rowClass}>
                    {columns.map((c, i) => {
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
