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
  const maxDepth = Math.max(...columns.map(depth));
  const headerRows = collectRows(columns);

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
  })(columns);

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
          {rows.map((r, idx) => (
            <tr key={(getRowId ? getRowId(r, idx) : idx) as React.Key} className={zebra && idx % 2 ? "bg-gray-50" : undefined}>
              {flatLeaves.map((leaf, j) => {
                const v = leaf.key ? r[leaf.key] : undefined;
                const content = numberFormat ? numberFormat(v, leaf.key || "") : defaultFmt(v);
                const align =
                  leaf.align === "right" ? "text-right" : leaf.align === "center" ? "text-center" : "text-left";
                return (
                  <td key={j} className={`px-2 py-1.5 border border-gray-200 text-[12px] ${align} tabular-nums`}>
                    {content}
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

function defaultFmt(v: any) {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return String(v);
}
