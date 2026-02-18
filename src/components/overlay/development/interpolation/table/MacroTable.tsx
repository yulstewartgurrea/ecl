import React from "react";

export type ColumnNode = {
  /** leaf cells should set `key` to map to row[key] */
  key?: string;
  header: React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  className?: string;
  /** nested column levels */
  children?: ColumnNode[];
};

type MacroTableProps<T extends Record<string, any>> = {
  caption?: string;
  columns: ColumnNode[];
  rows: T[];
  getRowId?: (row: T, index: number) => string | number;
  stickyHeader?: boolean;
  zebra?: boolean;
  /** Custom numeric/text formatter. Not used for Year/Quarter cells. */
  numberFormat?: (v: any, key: string) => React.ReactNode;
  className?: string;
};

/* ---------- header helpers ---------- */
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
  rows: ColumnNode[][] = [],
): ColumnNode[][] {
  rows[level] = rows[level] || [];
  for (const n of nodes) {
    rows[level].push(n);
    if (n.children && n.children.length > 0)
      collectRows(n.children, level + 1, rows);
  }
  return rows;
}
function flattenLeaves(
  nodes: ColumnNode[],
  out: ColumnNode[] = [],
): ColumnNode[] {
  for (const n of nodes) {
    if (n.children && n.children.length > 0) flattenLeaves(n.children, out);
    else out.push(n);
  }
  return out;
}

// Normalize headers: if "x" exists, change to "index"; if "index" already exists, rename it to "index-x"
function normalizeColumnHeaders(cols: ColumnNode[]): ColumnNode[] {
  // First pass: collect all header names to check for conflicts
  const headerNames = new Set<string>();
  const collectHeaders = (nodes: ColumnNode[]) => {
    for (const node of nodes) {
      if (typeof node.header === "string") {
        headerNames.add(node.header.toLowerCase().trim());
      }
      if (node.children) collectHeaders(node.children);
    }
  };
  collectHeaders(cols);

  const hasX = headerNames.has("x");
  const hasIndex = headerNames.has("index");

  // Second pass: rename headers
  const renameHeaders = (nodes: ColumnNode[]): ColumnNode[] => {
    return nodes.map((node) => {
      let newHeader = node.header;
      if (typeof node.header === "string") {
        const headerLower = node.header.toLowerCase().trim();
        if (headerLower === "x" && hasX) {
          newHeader = "index";
        } else if (headerLower === "index" && hasX && hasIndex) {
          newHeader = "index-x";
        }
      }

      return {
        ...node,
        header: newHeader,
        children: node.children ? renameHeaders(node.children) : undefined,
      };
    });
  };

  return renameHeaders(cols);
}

/* ---------- robust key + formatting helpers ---------- */
function leafKey(leaf: ColumnNode): string {
  const k = (
    leaf.key ?? (typeof leaf.header === "string" ? leaf.header : "")
  ).toString();
  return k.trim().toLowerCase().replace(/\s+/g, "_");
}
function stripCommas(v: any): string {
  if (v == null) return "";
  return String(v).replace(/,/g, "");
}
function defaultFormat(v: any, _key = ""): React.ReactNode {
  if (v == null) return "";
  if (typeof v === "number") {
    return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(v);
}

/* ---------- component ---------- */
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
  // Normalize headers before processing
  const normalizedColumns = normalizeColumnHeaders(columns);
  const maxDepth = Math.max(...normalizedColumns.map(getDepth));
  const headerRows = collectRows(normalizedColumns);
  const leafs = flattenLeaves(normalizedColumns);

  const headerLevelClass = (level: number) =>
    level === 0
      ? "bg-yellow-200 text-gray-900 font-semibold"
      : level === 1
        ? "bg-gray-700 text-white"
        : "bg-gray-600 text-white";

  const headerBase =
    "whitespace-pre-wrap text-xs leading-tight px-2 py-2 border border-gray-300 text-left align-bottom";

  return (
    <div
      className={
        "w-full overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm h-[800px]" +
        (className ?? "")
      }
    >
      {caption && (
        <div className="px-3 py-2 text-sm text-gray-600 ">{caption}</div>
      )}

      <table className="min-w-max w-full border-collapse">
        <thead className={stickyHeader ? "sticky top-0 z-10" : undefined}>
          {headerRows.map((row, level) => (
            <tr key={level}>
              {row.map((col, idx) => {
                const colSpan = countLeaves(col);
                const rowSpan =
                  col.children && col.children.length > 0
                    ? 1
                    : maxDepth - level;
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
                      level === 0 && idx === row.length - 1
                        ? "rounded-tr-2xl"
                        : "",
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
                const k = leafKey(leaf);

                // Year / Quarter: never show commas and bypass numberFormat
                let cell: React.ReactNode;
                if (k === "year" || k === "quarter") {
                  cell = stripCommas(raw);
                } else {
                  cell = numberFormat
                    ? numberFormat(raw, leaf.key || "")
                    : defaultFormat(raw, leaf.key || "");
                }

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

export default MacroTable;
