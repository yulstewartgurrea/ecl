import React from "react";

export type ColumnNode = {
  key?: string;
  header: React.ReactNode;
  align?: "left" | "center" | "right";
  width?: string;
  className?: string;
  children?: ColumnNode[];
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

function depth(n: ColumnNode): number {
  return n.children?.length ? 1 + Math.max(...n.children.map(depth)) : 1;
}
function leaves(n: ColumnNode): number {
  return n.children?.length ? n.children.map(leaves).reduce((a, b) => a + b, 0) : 1;
}
function collectRows(nodes: ColumnNode[], lvl = 0, rows: ColumnNode[][] = []) {
  rows[lvl] ??= [];
  for (const n of nodes) {
    rows[lvl].push(n);
    if (n.children?.length) collectRows(n.children, lvl + 1, rows);
  }
  return rows;
}

export default function MacroTable<T extends Record<string, any>>({
  caption,
  columns,
  rows,
  getRowId,
  stickyHeader = true,
  zebra = true,
  numberFormat,
  className,
}: MacroTableProps<T>) {
  // Prune columns to remove any Month (int) headers before rendering
  const isMonthInt = (leaf: ColumnNode) => {
    const key = String(leaf.key ?? "").toLowerCase().trim();
    const header = (typeof leaf.header === "string" ? leaf.header : String(leaf.header ?? "")).toLowerCase().trim();
    if (!key && !header) return false;
    const candidates = [key, header];
    return candidates.some((s) => {
      if (!s) return false;
      const cleaned = s.replace(/[_\s]/g, "");
      return cleaned === "month(int)" || cleaned === "monthint" || (s.includes("month") && s.includes("int"));
    });
  };

  const prune = (nodes: ColumnNode[]): ColumnNode[] =>
    nodes
      .map((n) => {
        if (isMonthInt(n)) return null as any;
        if (n.children?.length) {
          const kids = prune(n.children);
          return { ...n, children: kids } as ColumnNode;
        }
        return n;
      })
      .filter(Boolean) as ColumnNode[];

  const prunedColumns = prune(columns);

  const maxDepth = Math.max(...prunedColumns.map(depth));
  const headerRows = collectRows(prunedColumns);

  const tierClass = (level: number) =>
    level === 0
      ? "bg-yellow-400 text-gray-900 font-semibold"
      : level === 1
      ? "bg-gray-700 text-white"
      : "bg-gray-600 text-white";

  const thBase =
    "whitespace-pre-wrap text-xs leading-tight px-2 py-2 border border-gray-300 text-left align-bottom";

  const flatLeaves: ColumnNode[] = [];
  (function flatten(nodes: ColumnNode[]) {
    nodes.forEach((n) => (n.children?.length ? flatten(n.children) : flatLeaves.push(n)));
  })(prunedColumns);

  const displayLeaves = flatLeaves; // already pruned

  return (
    <div className={"w-full overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm " + (className ?? "")}>
      {caption && (
        <div className="px-4 py-2 text-[11px] font-semibold text-red-600 uppercase tracking-wide">
          {caption}
        </div>
      )}

      <table className="min-w-max w-full border-collapse">
        <thead className={stickyHeader ? "sticky top-0 z-10" : undefined}>
          {headerRows.map((row, level) => (
            <tr key={level}>
              {row.map((col, i) => {
                const colSpan = leaves(col);
                const rowSpan = col.children?.length ? 1 : maxDepth - level;
                return (
                  <th
                    key={i}
                    colSpan={colSpan}
                    rowSpan={rowSpan}
                    style={{ width: col.width }}
                    className={[
                      thBase,
                      tierClass(level),
                      level === 0 && i === 0 ? "rounded-tl-2xl" : "",
                      level === 0 && i === row.length - 1 ? "rounded-tr-2xl" : "",
                      col.className ?? "",
                    ].join(" ")}
                  >
                    <span className="block text-[11px] md:text-[12px]">{col.header}</span>
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>

        <tbody>
        {rows.map((r, idx) => {
            const rawKey = getRowId ? getRowId(r, idx) : idx;   // e.g. "2024-06"
            const rowKey = `${String(rawKey)}__${idx}`;         // => "2024-06__5" (always unique)
            return (
            <tr
                key={rowKey}
                className={zebra && idx % 2 ? "bg-gray-50" : undefined}
            >
                {displayLeaves.map((leaf, j) => {
                const v = leaf.key ? r[leaf.key] : undefined;
                const content = numberFormat ? numberFormat(v, leaf.key || "") : defaultFmt(v, leaf.key || "");
                const align =
                    leaf.align === "right" ? "text-right" :
                    leaf.align === "center" ? "text-center" : "text-left";
                return (
                    <td
                    key={`${leaf.key ?? "col"}__${j}`}     // see #2 below
                    className={`px-2 py-1.5 border border-gray-200 text-[12px] ${align} tabular-nums`}
                    >
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
  );
}

function defaultFmt(v: any, key: string | undefined = undefined) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    const k = String(key ?? "").toLowerCase();
    // For year-like columns, avoid grouping separators (show 2003 instead of 2,003)
    if (k === "year" || k.includes("year")) {
      return String(Math.trunc(v));
    }
    return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(v);
}