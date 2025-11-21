// src/pages/overlay/development/.../Step4.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Multi_Table, type Row } from "../../../../components/overlay/development/multi_factor/Multi_Table";
import { getMultiFactorResults, postMultiFactorTrigger } from "../../../../services/multi_factor";
import { useAppSelector } from "../../../../redux_toolkit/hooks";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import {
  ArrowPathIcon,
  PlayCircleIcon,
  ArrowDownTrayIcon,   // ✅ NEW
  ChevronLeftIcon,     // ✅ NEW (for Prev)
} from "@heroicons/react/24/outline";

// NEW: headers storage helper
import { saveHeaders } from "../../../../components/overlay/development/multi_factor/headersStorage";

// ✅ NEW: polling notifier
import { PollIsendNotifier } from "../../../../components/PollIsendNotifier";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

type Step4Props = {
  title?: string;
  description?: string;
};

const EXCLUDE_KEYS = new Set(["id", "index", "__rowid__", "_rowIndex"]);

function deriveHeaders(rows: Row[]): string[] {
  const set = new Set<string>();
  for (const r of rows || []) {
    Object.keys(r || {}).forEach((k) => {
      if (!EXCLUDE_KEYS.has(k)) set.add(k);
    });
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// CSV helpers (used if server returns JSON)
function escapeCsv(value: any): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function toCsv(headers: string[], rows: Row[]): string {
  const head = headers.join(",");
  const body = rows.map((r) => headers.map((h) => escapeCsv(r[h])).join(",")).join("\n");
  // Add BOM so Excel opens UTF-8 cleanly
  return "\uFEFF" + head + "\n" + body;
}

const Step4: React.FC<Step4Props> = ({
  title = "Multi-Factor Analysis — Regression Results",
  description = "Run the analysis, then browse paginated results. Use column filters for quick sensitivity checks.",
}) => {
  const { currentPdTransitionMatrixWorkflowId: selectedWorkflowId } =
    useSelector((s: RootState) => s.pdTransitionMatrixWfHelper as any);
  const token = useAppSelector((s) => (s as any)?.auth?.token) as string | null;

  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10); // server supports page_size

  const [serverRows, setServerRows] = useState<Row[]>([]);
  const [filteredRows, setFilteredRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | undefined>(undefined);
  const [pages, setPages] = useState<number | undefined>(undefined);

  const [hasTriggered, setHasTriggered] = useState(false);

  // EXPORT state
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exportReady, setExportReady] = useState(false);

  const totalPages = useMemo(() => {
    if (pages && pages > 0) return pages;
    if (total && pageSize) return Math.max(1, Math.ceil(total / pageSize));
    if (!pages && !total && serverRows?.length) {
      return Math.max(1, Math.ceil(serverRows.length / pageSize));
    }
    return undefined;
  }, [pages, total, pageSize, serverRows]);

  const canPrev = page > 1;
  const canNext = totalPages ? page < totalPages : serverRows.length === pageSize;
  console.log(canNext)
  const displayRows = useMemo(() => {
    const usingServerPaging = Boolean(pages || total);
    if (usingServerPaging) return serverRows;
    const start = (page - 1) * pageSize;
    return serverRows.slice(start, start + pageSize);
  }, [serverRows, page, pageSize, pages, total]);

  async function fetchPage(nextPage = page, nextPageSize = pageSize) {
    setLoading(true);
    setErrMsg(null);
    try {
      const res = await getMultiFactorResults({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
        page: nextPage,
        pageSize: nextPageSize, // mapped to ?page_size= in service
      });
      setHasTriggered(true);
      setServerRows(res.rows ?? []);
      setTotal(res.total_items);
      setPages(res.pages);

      // persist headers for Step5
      if (Array.isArray(res?.rows) && res.rows.length > 0 && Number.isFinite(selectedWorkflowId)) {
        const headers = deriveHeaders(res.rows);
        saveHeaders(Number(selectedWorkflowId), headers);
      } else if (Number.isFinite(selectedWorkflowId)) {
        saveHeaders(Number(selectedWorkflowId), []);
      }
    } catch (e: any) {
      setServerRows([]);
      setTotal(undefined);
      setPages(undefined);
      setErrMsg(e?.message || "Failed to fetch results.");
    } finally {
      setLoading(false);
    }
  }

  async function runAnalysis() {
    if (!Number.isFinite(selectedWorkflowId)) {
      setErrMsg("Missing or invalid workflowId.");
      return;
    }
    setPosting(true);
    setErrMsg(null);
    try {
      await postMultiFactorTrigger({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
      });
      setHasTriggered(true);
      setPage(1);
      await fetchPage(1, pageSize);
    } catch (e: any) {
      setErrMsg(e?.message || "Failed to start analysis.");
    } finally {
      setPosting(false);
    }
  }

  // Enable export once we have data and not loading/posting
  useEffect(() => {
    const ready =
      Number.isFinite(selectedWorkflowId) &&
      !loading &&
      !posting &&
      ((serverRows?.length ?? 0) > 0 || (total ?? 0) > 0);
    setExportReady(Boolean(ready));
  }, [selectedWorkflowId, loading, posting, serverRows, total]);

  // Export the current page via your exact endpoint
  async function exportCurrentPage() {
    if (!Number.isFinite(selectedWorkflowId)) return;
    setExportErr(null);
    setExporting(true);
    try {
      const url = new URL(`${API_BASE}/api/overlay/development/multifactor_analysis`);
      url.searchParams.set("workflow_id", String(selectedWorkflowId));
      url.searchParams.set("page", String(page));
      url.searchParams.set("page_size", String(pageSize));

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "text/csv,application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        let msg = `Export failed: HTTP ${res.status}`;
        try {
          const t = await res.text();
          if (t) msg = `${msg} – ${t}`;
        } catch {}
        throw new Error(msg);
      }

      const ct = (res.headers.get("content-type") || "").toLowerCase();
      const cd = res.headers.get("content-disposition") || "";
      const nameMatch =
        cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i) ||
        cd.match(/filename=["']?([^"']+)["']?/i);
      const fallbackName = `multifactor_results_${selectedWorkflowId}_p${page}_ps${pageSize}`;

      if (ct.includes("csv") || ct.startsWith("text/csv")) {
        // Server already returns CSV → download directly
        const blob = await res.blob();
        const filename = (nameMatch && decodeURIComponent(nameMatch[1])) || `${fallbackName}.csv`;
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      } else {
        // Server returned JSON → convert to CSV client-side and download
        const json = await res.json();
        const rows: Row[] = Array.isArray(json?.rows) ? json.rows : Array.isArray(json) ? json : [];
        const headers = deriveHeaders(rows);
        const csv = toCsv(headers, rows);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const filename = `${fallbackName}.csv`;
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      }
    } catch (e: any) {
      setExportErr(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (!hasTriggered) return;
    fetchPage(page, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize]);

  useEffect(() => {
    setHasTriggered(false);
    setPage(1);
    setServerRows([]);
    setFilteredRows([]);
    setTotal(undefined);
    setPages(undefined);
    setErrMsg(null);
    if (Number.isFinite(selectedWorkflowId)) saveHeaders(Number(selectedWorkflowId), []);
  }, [selectedWorkflowId]);

  useEffect(() => {
    if (!totalPages) return;
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const headerMeta = useMemo(
    () => ({
      total: total ?? serverRows.length,
      page,
      pageSize,
      totalPages,
    }),
    [total, serverRows.length, page, pageSize, totalPages]
  );

  // ✅ GET-only status URL for the polling notifier (minimal payload)
  const statusUrl =
    Number.isFinite(selectedWorkflowId)
      ? `${API_BASE}/api/overlay/development/multifactor_analysis?workflow_id=${encodeURIComponent(
          String(selectedWorkflowId)
        )}&page=1&page_size=1`
      : "";

  return (
    <div className="min-h-dvh bg-neutral-50 p-6">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-neutral-600">{description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Run */}
          <button
            onClick={runAnalysis}
            disabled={posting || loading || !Number.isFinite(selectedWorkflowId)}
            className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50"
            title={!selectedWorkflowId ? "Pick a workflow on Step 1" : ""}
          >
            <PlayCircleIcon className="h-4 w-4" />
            {posting ? "Running…" : "Run Analysis"}
          </button>

          {/* Refresh */}
          <button
            onClick={() => fetchPage()}
            disabled={loading || !Number.isFinite(selectedWorkflowId)}
            className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
            title={!selectedWorkflowId ? "Pick a workflow on Step 1" : "Fetch latest results once"}
          >
            <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Refreshing…" : "Refresh"}
          </button>



          {/* ✅ Auto-checker (GET-only, every 10 mins) */}
          {Number.isFinite(selectedWorkflowId) && (
            <PollIsendNotifier<any>
              url={statusUrl}
              everyMinutes={10}
              requestInit={{
                headers: {
                  ...(token ? { Authorization: `Bearer ${token}` } : {}),
                  Accept: "application/json",
                },
              }}
              // Robust 'done' detection for either an envelope or plain JSON:
              // - Envelope: { success, data: { rows, total_items, ... } }
              // - Plain:    { rows, total_items, ... }
              parseDone={(env: any) => {
                const data = env?.data ?? env;
                const rows = Array.isArray(data?.rows) ? data.rows : [];
                const totalItems =
                  typeof data?.total_items === "number"
                    ? data.total_items
                    : Array.isArray(rows)
                    ? rows.length
                    : 0;
                return (rows.length ?? 0) > 0 || (totalItems ?? 0) > 0;
              }}
              onDone={async () => {
                // When results appear, load the first page immediately.
                setHasTriggered(true);
                setPage(1);
                await fetchPage(1, pageSize);
              }}
            />
          )}
        </div>
      </div>

      {/* Controls / pagination */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!hasTriggered || loading || !canPrev}
          >
            <ChevronLeftIcon className="h-4 w-4" />
            ← Prev
          </button>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span>Page</span>
          <input
            type="number"
            min={1}
            max={totalPages ?? undefined}
            value={page}
            onChange={(e) => {
              const n = Math.max(1, Number(e.target.value) || 1);
              setPage(totalPages ? Math.min(n, totalPages) : n);
            }}
            className="w-16 rounded-md border border-neutral-300 px-2 py-1"
            disabled={!hasTriggered || loading}
          />
          <span>/ {totalPages ?? "?"}</span>
          
        </div>

        <div className="ml-auto flex items-center gap-2 text-sm">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const n = Number(e.target.value);
              setPageSize(n);
              setPage(1);
            }}
            className="rounded-md border border-neutral-300 px-2 py-1"
            disabled={!hasTriggered || loading}
          >
            {[10, 20, 50, 100, 1000].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
                    {/* Export */}
          <button
            onClick={exportCurrentPage}
            disabled={!exportReady || exporting || !Number.isFinite(selectedWorkflowId)}
            className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
            title={
              !Number.isFinite(selectedWorkflowId)
                ? "Pick a workflow on Step 1"
                : !exportReady
                ? "Load results first"
                : "Download CSV"
            }
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {exporting ? "Exporting…" : "Export"}
          </button>
        </div>
      </div>

      {/* Errors */}
      {errMsg && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errMsg}
        </div>
      )}
      {exportErr && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {exportErr}
        </div>
      )}

      {/* Table */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-white/60 backdrop-blur-sm">
            <div className="animate-pulse rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm">
              Loading…
            </div>
          </div>
        )}

        <Multi_Table
          data={displayRows}
          onFilteredChange={(filtered: any) => setFilteredRows(filtered)}
          emptyMessage={hasTriggered ? "No results" : "Click “Run Analysis” to fetch results."}
        />
      </div>

      {/* Footer / counts */}
      <p className="mt-3 text-sm text-neutral-600">
        Showing {filteredRows.length} of {headerMeta.total ?? 0} (page {headerMeta.page} of{" "}
        {headerMeta.totalPages ?? "?"}).
      </p>
    </div>
  );
};

export default Step4;