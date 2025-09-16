import React from "react";

export type ColumnNode = {
  key?: string;                       // present for leaf cells (maps to row[key])
  header: React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  className?: string;
  children?: ColumnNode[];            // nested column levels
};

type MacroTableProps<T extends Record<string, any>> = {
  caption?: string;
  columns: ColumnNode[];
  rows: T[];
  getRowId?: (row: T, index: number) => string | number;
  stickyHeader?: boolean;
  zebra?: boolean;
  numberFormat?: (v: any, key: string) => React.ReactNode;
  className?: string;
};

function getDepth(node: ColumnNode): number {
  if (!node.children || node.children.length === 0) return 1;
  return 1 + Math.max(...node.children.map(getDepth));
}
function countLeaves(node: ColumnNode): number {
  if (!node.children || node.children.length === 0) return 1;
  return node.children.map(countLeaves).reduce((a, b) => a + b, 0);
}
function collectRows(
  nodes: ColumnNode[],
  level = 0,
  rows: ColumnNode[][] = []
): ColumnNode[][] {
  rows[level] = rows[level] || [];
  for (const n of nodes) {
    rows[level].push(n);
    if (n.children && n.children.length > 0) collectRows(n.children, level + 1, rows);
  }
  return rows;
}

export function MacroTable<T extends Record<string, any>>({
  caption,
  columns,
  rows,
  getRowId,
  stickyHeader = true,
  zebra = true,
  numberFormat,
  className,
}: MacroTableProps<T>) {
  const maxDepth = Math.max(...columns.map(getDepth));
  const headerRows = collectRows(columns);

  const headerLevelClass = (level: number) =>
    level === 0
      ? "bg-yellow-400 text-gray-900 font-semibold"
      : level === 1
      ? "bg-gray-700 text-white"
      : "bg-gray-600 text-white";

  const headerBase =
    "whitespace-pre-wrap text-xs leading-tight px-2 py-2 border border-gray-300 text-left align-bottom";

  const leafs: ColumnNode[] = [];
  const collectLeafs = (nodes: ColumnNode[]) => {
    nodes.forEach((n) => {
      if (n.children && n.children.length > 0) collectLeafs(n.children);
      else leafs.push(n);
    });
  };
  collectLeafs(columns);

  return (
    <div
      className={
        "w-full overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm " +
        (className ?? "")
      }
    >
      {caption ? (
        <div className="px-4 py-2 text-[11px] font-semibold text-red-600 uppercase tracking-wide">
          {caption}
        </div>
      ) : null}

      <table className="min-w-max w-full border-collapse">
        <thead className={stickyHeader ? "sticky top-0 z-10" : undefined}>
          {headerRows.map((row, level) => (
            <tr key={level}>
              {row.map((col, idx) => {
                const colSpan = countLeaves(col);
                const rowSpan =
                  col.children && col.children.length > 0 ? 1 : maxDepth - level;
                return (
                  <th
                    key={idx}
                    colSpan={colSpan}
                    rowSpan={rowSpan}
                    style={{ width: col.width }}
                    className={[
                      headerBase,
                      headerLevelClass(level),
                      level === 0 && idx === 0 ? "rounded-tl-2xl" : "",
                      level === 0 && idx === row.length - 1 ? "rounded-tr-2xl" : "",
                      col.className || "",
                    ].join(" ")}
                  >
                    <span className="block text-[11px] md:text-[12px]">
                      {col.header}
                    </span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>

        <tbody>
          {rows.map((r, i) => (
            <tr
              key={(getRowId ? getRowId(r, i) : i) as React.Key}
              className={zebra && i % 2 === 1 ? "bg-gray-50" : undefined}
            >
              {leafs.map((leaf, j) => {
                const raw = leaf.key ? r[leaf.key] : undefined;
                const cell = numberFormat
                  ? numberFormat(raw, leaf.key || "")
                  : defaultFormat(raw);
                const alignClass =
                  leaf.align === "right"
                    ? "text-right"
                    : leaf.align === "center"
                    ? "text-center"
                    : "text-left";
                return (
                  <td
                    key={j}
                    className={`px-2 py-1.5 border border-gray-200 text-[12px] ${alignClass} tabular-nums`}
                    style={{ width: leaf.width }}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function defaultFormat(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number")
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return String(v);
}

export default MacroTable;
