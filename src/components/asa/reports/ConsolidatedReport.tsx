// ==========================
// components/asa/reports/ConsolidatedReport.tsx
// (Date-range button with dropdown + pagination inside toolbar)
// ==========================
import { useMemo, useState, useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/outline";

type Align = "left" | "center" | "right";
type FontScale = "normal" | "large";

export type Column<T> = {
  key: keyof T | string;
  header: string;
  width?: number;
  align?: Align;
  render?: (row: T, rowIndex: number) => ReactNode;
  headerTitle?: string;
};

export type DataGridProps<T> = {
  title?: string;
  columns: Column<T>[];
  rows: T[];
  fontScale?: FontScale;
  headerTone?: "neutral" | "brand";
  headerColorHex?: string;
  horizontalScroll?: boolean;
  stickyHeader?: boolean;
  className?: string;
  toolbar?: ReactNode;
  rowClassName?: (row: T, rowIndex: number, prev?: T) => string | undefined;
  onRowClick?: (row: T, rowIndex: number) => void;
};

const cls = (...p: Array<string | false | undefined>) => p.filter(Boolean).join(" ");
const toISO = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

function cellBox(col: Column<any>): CSSProperties {
  const s: CSSProperties = {};
  if (col.width) {
    s.width = col.width;
    s.minWidth = col.width;
  }
  return s;
}

/* ---------- Small date-range popover button ---------- */
function DateRangeButton({
  from,
  to,
  onApply,
  onClear,
  className = "",
}: {
  from: string;
  to: string;
  onApply: (from: string, to: string) => void;
  onClear: () => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tmpFrom, setTmpFrom] = useState(from);
  const [tmpTo, setTmpTo] = useState(to);
  const rootRef = useRef<HTMLDivElement>(null);

  // keep temporary values in sync on open
  useEffect(() => {
    if (open) {
      setTmpFrom(from);
      setTmpTo(to);
    }
  }, [open, from, to]);

  // close on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // close on Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const label =
    from && to
      ? `${from} → ${to}`
      : from
      ? `From ${from}`
      : to
      ? `To ${to}`
      : "Date range";

  const quick = {
    thisMonth: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setTmpFrom(toISO(start));
      setTmpTo(toISO(end));
    },
    last30: () => {
      const end = new Date();
      const start = addDays(end, -30);
      setTmpFrom(toISO(start));
      setTmpTo(toISO(end));
    },
    last90: () => {
      const end = new Date();
      const start = addDays(end, -90);
      setTmpFrom(toISO(start));
      setTmpTo(toISO(end));
    },
    ytd: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date();
      setTmpFrom(toISO(start));
      setTmpTo(toISO(end));
    },
    all: () => {
      setTmpFrom("");
      setTmpTo("");
    },
  };

  return (
    <div ref={rootRef} className={cls("relative inline-block", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-yellow-400 bg-yellow-400 text-gray-900 px-3 hover:brightness-95"
      >
        <CalendarDaysIcon className="h-4 w-4" />
        {label}
      </button>

      {open && (
        <div className="absolute z-50 mt-2 w-[360px] rounded-xl border border-gray-200 bg-white shadow-xl"
             style={{ left: 0 }}>
          <div className="flex items-center justify-between px-4 py-3 border-b bg-yellow-50 rounded-t-xl">
            <div className="text-sm font-semibold text-gray-800">Filter by date range</div>
            <button
              type="button"
              className="p-1 text-gray-600 hover:bg-yellow-400/30 rounded-md"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">From</label>
                <input
                  type="date"
                  value={tmpFrom}
                  onChange={(e) => setTmpFrom(e.target.value)}
                  className="w-full h-9 rounded-lg border border-gray-300 px-2 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">To</label>
                <input
                  type="date"
                  value={tmpTo}
                  onChange={(e) => setTmpTo(e.target.value)}
                  className="w-full h-9 rounded-lg border border-gray-300 px-2 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                />
              </div>
            </div>

            {/* Quick presets */}
            <div className="flex flex-wrap gap-2">
              <button onClick={quick.thisMonth} className="text-xs rounded-md border px-2 py-1 hover:bg-gray-50">
                This month
              </button>
              <button onClick={quick.last30} className="text-xs rounded-md border px-2 py-1 hover:bg-gray-50">
                Last 30 days
              </button>
              <button onClick={quick.last90} className="text-xs rounded-md border px-2 py-1 hover:bg-gray-50">
                Last 90 days
              </button>
              <button onClick={quick.ytd} className="text-xs rounded-md border px-2 py-1 hover:bg-gray-50">
                YTD
              </button>
              <button onClick={quick.all} className="text-xs rounded-md border px-2 py-1 hover:bg-gray-50">
                All time
              </button>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  onClear();
                  setOpen(false);
                }}
                className="rounded-lg border border-yellow-400 bg-yellow-400 px-3 py-1.5 text-sm text-gray-900 hover:brightness-95"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  onApply(tmpFrom, tmpTo);
                  setOpen(false);
                }}
                className="rounded-lg bg-yellow-400 border border-yellow-400 px-3 py-1.5 text-sm font-medium text-gray-900 hover:brightness-95"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- DataGrid ---------- */
export function DataGrid<T>({
  title,
  columns,
  rows,
  fontScale = "large",
  headerTone = "neutral",
  headerColorHex,
  horizontalScroll = false,
  stickyHeader = true,
  className,
  toolbar,
  rowClassName,
  onRowClick,
}: DataGridProps<T>) {
  const textBase = fontScale === "large" ? "text-base" : "text-sm";
  const padY = fontScale === "large" ? "py-3" : "py-2";
  const minTableWidth = useMemo(
    () => (horizontalScroll ? columns.reduce((sum, c) => sum + (c.width ?? 160), 0) : undefined),
    [columns, horizontalScroll]
  );

  const theadClass = headerTone === "brand" ? "bg-yellow-500" : headerTone === "neutral" ? "bg-gray-50" : "";
  const theadStyle = headerTone || !headerColorHex ? undefined : ({ backgroundColor: headerColorHex } as CSSProperties);

  return (
    <section className={cls("rounded-2xl ring-1 ring-gray-200 bg-white shadow-sm", className)}>
      {(title || toolbar) && (
        <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
          {title && <h3 className={cls("font-semibold text-slate-800", textBase)}>{title}</h3>}
          {toolbar}
        </div>
      )}

      <div className={horizontalScroll ? "overflow-x-auto" : "overflow-x-hidden"}>
        <table
          className={cls(
            "w-full border-collapse",
            horizontalScroll ? "table-fixed" : "table-auto",
            "font-normal [font-variant-numeric:tabular-nums]",
            textBase
          )}
          style={minTableWidth ? { minWidth: minTableWidth } : undefined}
        >
          <thead className={cls(stickyHeader && "sticky top-0 z-10", "text-slate-900", theadClass)} style={theadStyle}>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={i}
                  title={c.headerTitle || c.header}
                  className={cls(
                    "border-b border-gray-300 px-3 font-semibold leading-tight h-12",
                    "whitespace-nowrap overflow-hidden text-ellipsis",
                    c.align === "center" && "text-center",
                    c.align === "right" && "text-right"
                  )}
                  style={cellBox(c)}
                >
                  <span className="block min-w-0">{c.header}</span>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-10 text-center text-gray-500" colSpan={columns.length}>
                  No data
                </td>
              </tr>
            ) : (
              rows.map((row, rIdx) => {
                const prev = rIdx > 0 ? rows[rIdx - 1] : undefined;
                const clickable = !!onRowClick;
                return (
                  <tr
                    key={rIdx}
                    onClick={clickable ? () => onRowClick!(row, rIdx) : undefined}
                    className={cls(
                      rIdx % 2 === 0 ? "bg-white" : "bg-slate-50/70",
                      "text-slate-900 transition-colors",
                      clickable && "hover:bg-yellow-50 cursor-pointer",
                      rowClassName?.(row, rIdx, prev)
                    )}
                  >
                    {columns.map((c, cIdx) => {
                      const content = c.render ? c.render(row, rIdx) : (row as any)[c.key as string];
                      return (
                        <td
                          key={cIdx}
                          className={cls(
                            "border-b border-gray-200 px-3 align-top",
                            padY,
                            "whitespace-normal break-words",
                            c.align === "center" && "text-center",
                            c.align === "right" && "text-right"
                          )}
                          style={cellBox(c)}
                        >
                          {content ?? ""}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- Types ---------- */
export type SummaryRow = { uniqueReportDate: string; uniqueProduct: string; index: number };
export type ConsolidatedRow = {
  reportDate: string;
  agingCategory: string;
  numberOfDelinquents?: number;
  loanBalancePrincipal?: number;
  netParAmount_LB_withCP?: number;
  netParAmount_LB_Principal?: number;
  netParPercent?: number;
  repaymentRate?: number;
};

const fmt = (v?: number, f = 0) =>
  v == null ? "" : v.toLocaleString(undefined, { minimumFractionDigits: f, maximumFractionDigits: f });

/* ---------- CSV helpers ---------- */
const toCSV = (headers: string[], rows: (string | number)[][]) => {
  const esc = (s: string | number) => `"${String(s).replace(/"/g, '""')}"`;
  return [headers.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
};

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- Report (pagination + date button in toolbar) ---------- */
export default function ConsolidatedReport({
  summaryRows,
  consolidatedRows,
}: {
  summaryRows: SummaryRow[];
  consolidatedRows: ConsolidatedRow[];
}) {
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  const inRange = (d: string) => {
    if (!fromDate && !toDate) return true;
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };

  const filteredSummary = useMemo(
    () => summaryRows.filter((r) => inRange(r.uniqueReportDate)),
    [summaryRows, fromDate, toDate]
  );
  const filteredConsolidated = useMemo(
    () => consolidatedRows.filter((r) => inRange(r.reportDate)),
    [consolidatedRows, fromDate, toDate]
  );

  // Clamp / reset page
  const totalRows = filteredConsolidated.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);
  useEffect(() => {
    setPage(1);
  }, [fromDate, toDate, pageSize]);

  const startIdx = (page - 1) * pageSize;
  const endIdx = Math.min(startIdx + pageSize, totalRows);
  const pageRows = filteredConsolidated.slice(startIdx, endIdx);

  const clearDates = () => {
    setFromDate("");
    setToDate("");
  };

  const exportConsolidated = () => {
    const headers = [
      "Report Date",
      "Aging Category",
      "No. of Delinquents",
      "Loan Bal. Principal",
      "NET PAR Amt (LB w/ CP)",
      "NET PAR Amt (LB Principal)",
      "NET PAR %",
      "Repayment Rate",
    ];
    const rows = filteredConsolidated.map((r) => [
      r.reportDate,
      r.agingCategory,
      r.numberOfDelinquents ?? "",
      r.loanBalancePrincipal ?? "",
      r.netParAmount_LB_withCP ?? "",
      r.netParAmount_LB_Principal ?? "",
      r.netParPercent ?? "",
      r.repaymentRate ?? "",
    ]);
    download("consolidated_data.csv", toCSV(headers, rows));
  };

  const summaryCols: Column<SummaryRow>[] = [
    { key: "uniqueReportDate", header: "Unique Report Date" },
    { key: "uniqueProduct", header: "Unique Product" },
    { key: "index", header: "Index", align: "right" },
  ];

  const consolidatedCols: Column<ConsolidatedRow>[] = [
    { key: "reportDate", header: "Report Date", width: 140 },
    { key: "agingCategory", header: "Aging Category", width: 300 },
    { key: "numberOfDelinquents", header: "No. of Delinquents", align: "right", width: 190, render: (r) => fmt(r.numberOfDelinquents) },
    { key: "loanBalancePrincipal", header: "Loan Bal. Principal", align: "right", width: 210, render: (r) => fmt(r.loanBalancePrincipal) },
    { key: "netParAmount_LB_withCP", header: "NET PAR Amt (LB w/ CP)", align: "right", width: 240, render: (r) => fmt(r.netParAmount_LB_withCP) },
    { key: "netParAmount_LB_Principal", header: "NET PAR Amt (LB Principal)", align: "right", width: 260, render: (r) => fmt(r.netParAmount_LB_Principal) },
    { key: "netParPercent", header: "NET PAR %", align: "right", width: 140, render: (r) => (r.netParPercent == null ? "" : `${fmt(r.netParPercent, 2)}%`) },
    { key: "repaymentRate", header: "Repayment Rate", align: "right", width: 160, render: (r) => (r.repaymentRate == null ? "" : `${fmt(r.repaymentRate, 2)}%`) },
  ];

  /* ---- Toolbar: Date button + rows/page + pager + export ---- */
  const FilterBar = (
    <div className="flex flex-wrap items-center gap-2 text-sm w-full">
      <DateRangeButton
        from={fromDate}
        to={toDate}
        onApply={(f, t) => {
          setFromDate(f);
          setToDate(t);
        }}
        onClear={clearDates}
      />

      {/* Rows/page */}
      <div className="inline-flex items-center gap-2 ml-1">
        <span className="text-gray-700">Rows/page</span>
        <select
          className="h-9 rounded-lg border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
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

      {/* Right side: range + pager + export */}
      <div className="ml-auto flex items-center gap-2">
        <span className="text-gray-600 text-sm">
          Showing <span className="font-medium text-gray-900">{totalRows === 0 ? 0 : startIdx + 1}</span>–
          <span className="font-medium text-gray-900">{endIdx}</span> of{" "}
          <span className="font-medium text-gray-900">{totalRows}</span>
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={page <= 1}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50"
            title="First page"
          >
            <ChevronDoubleLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50"
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
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50"
            title="Next page"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages)}
            disabled={page >= totalPages}
            className="inline-flex items-center justify-center h-9 w-9 rounded-lg border border-gray-300 text-gray-700 disabled:opacity-40 hover:bg-gray-50"
            title="Last page"
          >
            <ChevronDoubleRightIcon className="h-5 w-5" />
          </button>
        </div>

        <button
          type="button"
          onClick={exportConsolidated}
          className="inline-flex items-center gap-1.5 h-9 rounded-lg border border-yellow-400 bg-yellow-400 text-gray-900 px-3 hover:brightness-95"
          title="Export filtered rows"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          Export
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[70vh] gap-6 rounded-2xl">
      {/* LEFT: Summary card */}
      <div className="w-[460px] shrink-0">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-yellow-500">
            <h3 className="text-sm font-semibold text-gray-900">Data Summary</h3>
            <p className="text-xs text-gray-800 -mt-0.5">Click a date to set the range</p>
          </div>

          <DataGrid<SummaryRow>
            columns={summaryCols}
            rows={filteredSummary}
            headerTone="neutral"
            stickyHeader
            horizontalScroll={false}
            onRowClick={(row) => {
              setFromDate(row.uniqueReportDate);
              setToDate(row.uniqueReportDate);
            }}
            rowClassName={(row) =>
              row.uniqueReportDate >= fromDate && (!!toDate ? row.uniqueReportDate <= toDate : true)
                ? "ring-1 ring-yellow-300"
                : ""
            }
          />
        </div>
      </div>

      {/* RIGHT: Consolidated card */}
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b bg-yellow-500">
            <h3 className="text-sm font-semibold text-gray-900">Consolidated Data</h3>
          </div>

          <DataGrid<ConsolidatedRow>
            columns={consolidatedCols}
            rows={pageRows}
            headerTone="neutral"
            stickyHeader
            horizontalScroll
            toolbar={FilterBar}
          />
        </div>
      </div>
    </div>
  );
}
