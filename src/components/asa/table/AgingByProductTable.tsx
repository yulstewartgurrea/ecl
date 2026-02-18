// ==========================
// components/asa/table/AgingByProductTable.tsx (PAGINATION + NEUTRAL HEADER)
// ==========================
import { useEffect, useMemo, useRef, useState } from "react";
import { SpreadsheetTable, type Column } from "./SpreadsheetTable";
import type { AnyRow as AgingRow } from "./aging.types";
import { fmtDate, fmtNum } from "./aging.types";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

const baseCols: Column<AgingRow>[] = [
  { key: "product", header: "Product", width: 160, sticky: true },
  {
    key: "date",
    header: "Date",
    width: 140,
    formatter: (v) => fmtDate(v as any),
  },
  {
    key: "total_loan_balance_with_cp",
    header: "Total Loan Balance with C/P",
    width: 240,
    align: "right",
    formatter: (v) => fmtNum(v),
  },
  {
    key: "d0",
    header: "0 day",
    width: 140,
    align: "right",
    formatter: (v) => fmtNum(v),
  },
  {
    key: "par1",
    header: "PAR 1 (1 & 30 days)",
    width: 190,
    align: "right",
    formatter: (v) => fmtNum(v),
  },
  {
    key: "par30",
    header: "PAR 30 (31 & 60 days)",
    width: 200,
    align: "right",
    formatter: (v) => fmtNum(v),
  },
  {
    key: "par60",
    header: "PAR 60 (61 & 90 days)",
    width: 200,
    align: "right",
    formatter: (v) => fmtNum(v),
  },
  {
    key: "par90",
    header: "PAR 90 (91 & 120 days)",
    width: 210,
    align: "right",
    formatter: (v) => fmtNum(v),
  },
  {
    key: "par120",
    header: "PAR 120 (121 & 180 days)",
    width: 220,
    align: "right",
    formatter: (v) => fmtNum(v),
  },
  {
    key: "par180",
    header: "PAR 180 (181 & 240 days)",
    width: 220,
    align: "right",
    formatter: (v) => fmtNum(v),
  },
  {
    key: "par240",
    header: "PAR 240 (241 & 360 days)",
    width: 220,
    align: "right",
    formatter: (v) => fmtNum(v),
  },
  {
    key: "par360",
    header: "PAR 360 (361 & Up days)",
    width: 220,
    align: "right",
    formatter: (v) => fmtNum(v),
  },
];

export default function AgingByProductTable({
  rows,
  height = 560,
  dense = false,
  title = "Aging by Product",
}: {
  rows: AgingRow[];
  height?: number | string;
  dense?: boolean;
  title?: string;
}) {
  /* ---------- Filtering ---------- */
  const products = useMemo(
    () => Array.from(new Set(rows.map((r) => r.product))).sort(),
    [rows],
  );

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | "All">("All");
  const anchorRef = useRef<HTMLDivElement>(null);

  // close the filter popover on outside click / Esc
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!anchorRef.current) return;
      if (!anchorRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (open) {
      document.addEventListener("mousedown", onDown);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(
    () =>
      selected === "All" ? rows : rows.filter((r) => r.product === selected),
    [rows, selected],
  );

  /* ---------- Pagination ---------- */
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const totalRows = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  useEffect(() => {
    // clamp page whenever filters / pageSize change
    setPage(1);
  }, [selected, pageSize]);
  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalRows);
  const pageRows = filtered.slice(startIdx, endIdx);

  /* ---------- Toolbar ---------- */
  const Toolbar = (
    <div className="flex items-center gap-2 w-full">
      {/* Title (small) */}
      <div className="text-xs text-gray-700 mr-2 hidden sm:block">{title}</div>

      {/* Filter button + popover */}
      <div ref={anchorRef} className="relative">
        {/* <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-400 bg-yellow-400 text-gray-900 hover:brightness-95 px-3 py-1.5 text-xs"
          title="Filter by product"
        >
          <FunnelIcon className="h-4 w-4" />
          Filter
          <ChevronDownIcon className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button> */}

        {open && (
          <div className="absolute right-0 mt-2 w-64 rounded-xl border bg-white shadow-lg z-20">
            <div className="p-3  bg-yellow-50 rounded-t-xl flex items-center justify-between">
              <div className="text-xs font-medium text-gray-800">
                Filter by product
              </div>
              <button
                className="p-1 text-gray-600 hover:bg-yellow-200/30 rounded-md"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="p-3 space-y-2">
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value as any)}
                className="w-full rounded-md border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-yellow-300"
              >
                <option value="All">All products</option>
                {products.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelected("All")}
                  className="text-xs px-2.5 py-1.5 rounded-md border border-yellow-400 bg-yellow-200 text-gray-900 hover:brightness-95"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-xs px-2.5 py-1.5 rounded-md bg-yellow-200 border border-yellow-400 text-gray-900 hover:brightness-95"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Rows/page selector */}
      <div className="inline-flex items-center gap-2 text-sm ml-1">
        <span className="text-gray-700">Rows/page</span>
        <select
          className="h-8 rounded-md border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
        >
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {/* Right side: range + pager */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-gray-600 text-sm">
          Showing{" "}
          <span className="font-medium text-gray-900">
            {totalRows === 0 ? 0 : startIdx + 1}
          </span>
          <span className="font-medium text-gray-900">{endIdx}</span> of{" "}
          <span className="font-medium text-gray-900">{totalRows}</span>
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={page <= 1}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50"
            title="First page"
          >
            <ChevronDoubleLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50"
            title="Previous page"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>

          <span className="px-2 text-sm tabular-nums">
            Page <span className="font-medium text-gray-900">{page}</span> /{" "}
            <span className="font-medium text-gray-900">{totalPages}</span>
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50"
            title="Next page"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages}
            className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50"
            title="Last page"
          >
            <ChevronDoubleRightIcon className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <SpreadsheetTable<AgingRow>
      columns={baseCols}
      rows={pageRows}
      height={height}
      dense={dense}
      zebra
      rowKey={(r, i) =>
        `${r.product}-${typeof r.date === "string" ? r.date : r.date.toISOString().slice(0, 10)}-${i}`
      }
      emptyText="No aging data"
      // Neutral header (aligns with Step 5)
      toolbar={Toolbar}
    />
  );
}
