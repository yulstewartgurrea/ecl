// ==========================
// components/asa/reports/ConsolidatedReport.tsx
// Dynamic columns + <colgroup> alignment + auto date detection
// ==========================
import { useMemo, useState, useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import {
  ArrowDownTrayIcon,
  CalendarDaysIcon,
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
} from "@heroicons/react/24/outline";

/* ---------- Shared types ---------- */
type Align = "left" | "center" | "right";
type FontScale = "normal" | "large";
type AnyRow = Record<string, any>;

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

/* ---------- Utils ---------- */
const cls = (...p: Array<string | false | undefined>) => p.filter(Boolean).join(" ");
const toISO = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};
const titleFromKey = (k: string) =>
  k
    .replace(/[_\-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (s) => s.toUpperCase());

const isISODate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** numeric or numeric-like string (e.g. "101,446,878.32") */
const isNumLike = (v: unknown) =>
  (typeof v === "number" && Number.isFinite(v)) ||
  (typeof v === "string" && /^-?\d{1,3}(?:,\d{3})*(?:\.\d+)?$|^-?\d+(\.\d+)?$/.test(v.trim()));

const toNumber = (v: unknown) =>
  typeof v === "number" ? v : typeof v === "string" ? parseFloat(v.replace(/,/g, "")) : NaN;

function pickUnionKeys(rows: AnyRow[]): string[] {
  const set = new Set<string>();
  rows.forEach((r) => Object.keys(r || {}).forEach((k) => set.add(k)));
  return Array.from(set);
}

/** detect which key is a date field in the given rows */
function detectDateKey(rows: AnyRow[]): string | null {
  if (!rows.length) return null;
  const keys = pickUnionKeys(rows);

  // name hints first
  const hints = ["uniqueReportDate", "reportDate", "asOfDate", "date", "report_date"];
  for (const h of hints) {
    const found = keys.find((k) => k.toLowerCase() === h.toLowerCase());
    if (found) return found;
  }

  // majority ISO values
  for (const k of keys) {
    const sample = rows.slice(0, 30).map((r) => r?.[k]);
    const hits = sample.filter(isISODate).length;
    if (hits >= Math.ceil(sample.length * 0.6)) return k;
  }
  return null;
}

function approxColWidth(header: string, values: unknown[], kind: "date" | "num" | "text") {
  const strLens = [header.length, ...values.map((v) => String(v ?? "").length)];
  const maxLen = Math.min(Math.max(...strLens, 6), 28);
  const base = kind === "num" ? 9.5 : kind === "date" ? 9 : 8.2;
  const px = Math.round(maxLen * base) + 36; // padding
  const min = kind === "num" ? 140 : kind === "date" ? 140 : 160;
  const max = 420;
  return Math.max(min, Math.min(px, max));
}

const fmt = (v?: number, f = 0) =>
  v == null ? "" : v.toLocaleString(undefined, { minimumFractionDigits: f, maximumFractionDigits: f });

/* ---------- Date-range button ---------- */
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

  useEffect(() => {
    if (open) {
      setTmpFrom(from);
      setTmpTo(to);
    }
  }, [open, from, to]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    if (open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const label =
    from && to ? `${from}  ${to}` : from ? `From ${from}` : to ? `To ${to}` : "Date range";

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
        <div
          className="absolute z-50 mt-2 w-[360px] rounded-xl border border-gray-200 bg-white shadow-xl"
          style={{ left: 0 }}
        >
          <div className="flex items-center justify-between px-4 py-3  bg-yellow-50 rounded-t-xl">
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

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  onClear();
                }}
                className="rounded-lg border border-yellow-400 bg-yellow-400 px-3 py-1.5 text-sm text-gray-900 hover:brightness-95"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => {
                  onApply(tmpFrom, tmpTo);
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

/* ---------- DataGrid with <colgroup> for perfect alignment ---------- */
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

  const theadClass = headerTone === "brand" ? "bg-yellow-500" : headerTone === "neutral" ? "bg-gray-50" : "";
  const theadStyle: CSSProperties | undefined =
    headerTone || !headerColorHex ? undefined : ({ backgroundColor: headerColorHex } as CSSProperties);

  const minW = horizontalScroll ? columns.reduce((sum, c) => sum + (c.width ?? 160), 0) : undefined;

  return (
    <section className={cls("rounded-2xl ring-1 ring-gray-200 bg-white shadow-sm", className)}>
      {(title || toolbar) && (
        <div className="flex items-center justify-between gap-3  border-gray-200 px-4 py-3">
          {title && <h3 className={cls("font-semibold text-slate-800", textBase)}>{title}</h3>}
          {toolbar}
        </div>
      )}

      <div className={horizontalScroll ? "overflow-x-auto" : "overflow-x-hidden"}>
        <table
          className={cls(
            "w-full border-collapse",
            "table-auto", // important for colgroup widths
            "font-normal [font-variant-numeric:tabular-nums]",
            textBase
          )}
          style={minW ? { minWidth: minW } : undefined}
        >
          {/* lock column widths so <th> and <td> always align */}
          <colgroup>
            {columns.map((c, i) => (
              <col key={i} style={c.width ? { width: c.width } : undefined} />
            ))}
          </colgroup>

          <thead className={cls(stickyHeader && "sticky top-0 z-10", "text-slate-900", theadClass)} style={theadStyle}>
            <tr>
              {columns.map((c, i) => (
                <th
                  key={i}
                  title={c.headerTitle || c.header}
                  className={cls(
                    " border-gray-300 px-3 font-semibold leading-tight h-12",
                    "whitespace-nowrap overflow-hidden text-ellipsis",
                    c.align === "center" && "text-center",
                    c.align === "left" && "text-left"
                  )}
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
                      const content = c.render ? c.render(row as any, rIdx) : (row as any)[c.key as string];
                      return (
                        <td
                          key={cIdx}
                          className={cls(
                            " border-gray-200 px-3 align-top",
                            padY,
                            "whitespace-normal break-words",
                            c.align === "center" && "text-center",
                            c.align === "right" && "text-right"
                          )}
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

/* ---------- Column inference (dynamic) ---------- */
type Inferred = {
  columns: Column<AnyRow>[];
  formatForCsv: (r: AnyRow) => (string | number)[];
};

function inferColumnsFromRows(rows: AnyRow[]): Inferred {
  const keys = pickUnionKeys(rows);
  if (keys.length === 0) return { columns: [], formatForCsv: () => [] };

  const sample = rows.slice(0, 50);

  type Info = {
    k: string;
    header: string;
    width: number;
    align: Align;
    kind: "num" | "date" | "text";
    percentLike: boolean;
    percentScale: number;
    decimals: number;
    render?: (row: AnyRow) => ReactNode;
    toCsv: (row: AnyRow) => string | number;
  };

  const infos: Info[] = keys.map((k) => {
    const vals = sample.map((r) => r?.[k]).filter((v) => v !== undefined);
    const numVals = vals.filter(isNumLike).map(toNumber);
    const hasNums = numVals.length > 0;
    const hasDates = vals.some(isISODate);
    const header = titleFromKey(k);

    // detect percent-like
    const percentLike = /percent|rate|ratio|pct|%/i.test(k);
    let percentScale = 1;
    if (percentLike && numVals.length > 0) {
      const max = Math.max(...numVals.map((n) => Math.abs(n)));
      if (max <= 1.5) percentScale = 100; // treat 0..1 as %
    }

    const kind: "num" | "date" | "text" = hasDates ? "date" : hasNums ? "num" : "text";
    const width = approxColWidth(header, vals, kind);
    const align: Align = kind === "num" ? "right" : "left";

    const hasFraction = numVals.some((n) => Math.abs(n % 1) > 1e-6);
    const decimals = percentLike ? 2 : hasFraction ? 2 : 0;

    const render =
      kind === "num"
        ? (row: AnyRow) => {
            const raw = row[k];
            const n = toNumber(raw);
            if (!Number.isFinite(n)) return "";
            if (percentLike) return `${fmt(n * percentScale, 2)}%`;
            return fmt(n, decimals);
          }
        : undefined;

    const toCsv = (row: AnyRow) => {
      const v = row[k];
      if (v == null) return "";
      if (kind === "num") {
        const n = toNumber(v);
        if (!Number.isFinite(n)) return "";
        return percentLike ? `${(n * percentScale).toFixed(2)}%` : n;
      }
      return String(v);
    };

    return { k, header, width, align, kind, percentLike, percentScale, decimals, render, toCsv };
  });

  // Order: date columns first (prefer those containing "report"), then texts, then numbers
  const byReportFirst = (a: Info, b: Info) =>
    a.k.toLowerCase().includes("report") ? -1 : b.k.toLowerCase().includes("report") ? 1 : 0;

  const dates = infos.filter((i) => i.kind === "date").sort(byReportFirst);
  const texts = infos.filter((i) => i.kind === "text");
  const nums = infos.filter((i) => i.kind === "num");

  const ordered = [...dates, ...texts, ...nums];

  const columns: Column<AnyRow>[] = ordered.map((i) => ({
    key: i.k,
    header: i.header,
    width: i.width,
    align: i.align,
    render: i.render,
  }));

  const formatForCsv = (r: AnyRow) => ordered.map((i) => i.toCsv(r));

  return { columns, formatForCsv };
}

/* ---------- Public (dynamic) API for callers ---------- */
export type SummaryRow = { [k: string]: any };
export type ConsolidatedRow = { [k: string]: any };

/* ---------- Report (dynamic) ---------- */
export default function ConsolidatedReport({
  summaryRows,
  consolidatedRows,
}: {
  summaryRows: SummaryRow[];
  consolidatedRows: ConsolidatedRow[];
}) {
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  // Auto-detect date keys
  const summaryDateKey = useMemo(() => detectDateKey(summaryRows) ?? "", [summaryRows]);
  const consolidatedDateKey = useMemo(() => detectDateKey(consolidatedRows) ?? "", [consolidatedRows]);

  const inRangeRow = (row: AnyRow, dateKey: string) => {
    if (!dateKey) return true;
    const d = row?.[dateKey];
    if (!isISODate(d)) return true;
    if (!fromDate && !toDate) return true;
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };

  const filteredSummary = useMemo(
    () => summaryRows.filter((r) => inRangeRow(r, summaryDateKey)),
    [summaryRows, fromDate, toDate, summaryDateKey]
  );
  const filteredConsolidated = useMemo(
    () => consolidatedRows.filter((r) => inRangeRow(r, consolidatedDateKey)),
    [consolidatedRows, fromDate, toDate, consolidatedDateKey]
  );

  // Dynamic columns
  const { columns: summaryCols } = useMemo(() => inferColumnsFromRows(summaryRows), [summaryRows]);
  const { columns: consolidatedCols, formatForCsv } = useMemo(
    () => inferColumnsFromRows(consolidatedRows),
    [consolidatedRows]
  );

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
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
  const exportConsolidated = () => {
    const headers = consolidatedCols.map((c) => c.header);
    const rows = filteredConsolidated.map((r) => formatForCsv(r));
    download("consolidated_data.csv", toCSV(headers, rows));
  };

  /* ---- Toolbar ---- */
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
          Showing <span className="font-medium text-gray-900">{totalRows === 0 ? 0 : startIdx + 1}</span>
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
          <div className="px-4 py-3  bg-yellow-500">
            <h3 className="text-sm font-semibold text-gray-900">Data Summary</h3>
            <p className="text-xs text-gray-800 -mt-0.5">
              {summaryDateKey ? "Click a date to set the range" : "No date field detected"}
            </p>
          </div>

          <DataGrid<AnyRow>
            columns={summaryCols}
            rows={filteredSummary}
            headerTone="neutral"
            stickyHeader
            horizontalScroll={summaryCols.reduce((w, c) => w + (c.width ?? 0), 0) > 460}
            onRowClick={
              summaryDateKey
                ? (row) => {
                    const d = row?.[summaryDateKey];
                    if (isISODate(d)) {
                      setFromDate(d);
                      setToDate(d);
                    }
                  }
                : undefined
            }
            rowClassName={(row) => {
              if (!summaryDateKey) return "";
              const d = row?.[summaryDateKey];
              return isISODate(d) && d >= fromDate && (!!toDate ? d <= toDate : true) ? "ring-1 ring-yellow-300" : "";
            }}
          />
        </div>
      </div>

      {/* RIGHT: Consolidated card */}
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-4 py-3  bg-yellow-500">
            <h3 className="text-sm font-semibold text-gray-900">Consolidated Data</h3>
          </div>

          <DataGrid<AnyRow>
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

