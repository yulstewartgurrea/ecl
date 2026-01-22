import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Multi_Table, type Row } from "../../../../components/overlay/development/multi_factor/Multi_Table";
import { getFilteringModels, postFilteringModels } from "../../../../services/filteringModels";
import { useAppDispatch, useAppSelector } from "../../../../redux_toolkit/hooks";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import {
  ArrowPathIcon,
  PlayCircleIcon,
  Cog6ToothIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
} from "@heroicons/react/24/outline";

import FilteringConfigModal from "../../../../components/overlay/development/multi_factor/FilteringConfigModal";
import { loadHeaders, loadFilters, type FilterRule } from "../../../../components/overlay/development/multi_factor/headersStorage";
import {
  selectModuleProgress,
  setModuleProgress,
} from "../../../../redux_toolkit/features/progress/moduleProgressSlice";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

/* ------------------------- Required columns (Step 5) ------------------------- */
const REQUIRED_COLUMNS = ["Y", "X1", "X2", "R_Squared", "Adj_R_Squared", "MAPE"];
const norm = (s: string) => String(s || "").trim().toLowerCase();
const uniqCaseInsensitive = (arr: string[]) => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of arr) {
    const k = norm(h);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(h);
    }
  }
  return out;
};

/* ---------- Types ---------- */
type Step5Props = {
  title?: string;
  description?: string;
};

type Step5Persist = {
  ids: Array<string | number>;
  rows: Row[];
  savedAt: string;
};

type Step5ReadyState = {
  readyForStep6: boolean;
  hasAppliedFilters: boolean;
  hasRunAnalysis: boolean;
  selectedRowsCount: number;
  hasSavedSelection: boolean;
  lastUpdated: string;
};

// exclude some utility keys if we have to CSV-convert JSON client-side
const EXCLUDE_KEYS = new Set(["id", "index", "__rowid__", "_rowIndex"]);

// helper: build the backend payload from headers + selected
function buildPayload(headers: string[], selected: FilterRule[]): FilterRule[] {
  const selectedMap = new Map<string, string>();
  for (const r of selected) {
    if (!r?.column) continue;
    selectedMap.set(norm(r.column), String(r.value ?? "0").trim());
  }
  const out: FilterRule[] = [];
  for (const h of headers) {
    const k = norm(h);
    const val = selectedMap.has(k) ? selectedMap.get(k)! : "0";
    out.push({ id: `__payload_${h}`, column: h, value: val });
  }
  return out;
}

// CSV helpers (used only if export endpoint returns JSON)
function escapeCsv(value: any): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function deriveCsvHeaders(rows: Row[]): string[] {
  const set = new Set<string>();
  for (const r of rows || []) {
    Object.keys(r || {}).forEach((k) => {
      if (!EXCLUDE_KEYS.has(k)) set.add(k);
    });
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
function toCsv(headers: string[], rows: Row[]): string {
  const head = headers.join(",");
  const body = rows.map((r) => headers.map((h) => escapeCsv((r as any)[h])).join(",")).join("\n");
  return "\uFEFF" + head + "\n" + body; // BOM for Excel
}

const Step5: React.FC<Step5Props> = ({
  title = "Filtering Models — Selected Regression Outputs",
  description = "Configure filters, run the analysis, then select one or more models before proceeding to Step 6.",
}) => {
  const dispatch = useAppDispatch();
  const { currentPdTransitionMatrixWorkflowId: selectedWorkflowId } =
    useSelector((s: RootState) => (s as any).pdTransitionMatrixWfHelper);

  const token = useAppSelector((s) => (s as any)?.auth?.token) as string | null;

  const contextKey =
    Number.isFinite(Number(selectedWorkflowId)) && Number(selectedWorkflowId) > 0
      ? String(selectedWorkflowId)
      : undefined;
  const overlayProgress = useAppSelector((state: RootState) =>
    selectModuleProgress(state, "overlayDevelopment", contextKey)
  );
  const overlayData = (overlayProgress?.data ?? {}) as Record<string, unknown>;
  const persistedSelected = overlayData.step5Selected as Step5Persist | undefined;
  const persistedChecked = overlayData.step5Checked as Step5Persist | undefined;

  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [filtered, setFiltered] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | undefined>(undefined);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [pagination, setPagination] = useState<{
    page: number;
    page_size: number;
    total_rows: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  } | null>(null);

  // split selected vs payload
  const [headers, setHeaders] = useState<string[]>([]);
  const [mfaHeaders, setMfaHeaders] = useState<string[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<FilterRule[]>([]);
  const [payloadFilters, setPayloadFilters] = useState<FilterRule[]>([]);
  const [configOpen, setConfigOpen] = useState(false);

  // Export states
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exportReady, setExportReady] = useState(false);

  // New gating states
  const [hasAppliedFilters, setHasAppliedFilters] = useState(false);
  const [hasRunAnalysis, setHasRunAnalysis] = useState(false);
  const [selectedRowsCount, setSelectedRowsCount] = useState(0);
  const [selectedRows, setSelectedRows] = useState<Row[]>([]);
  const [hasSavedSelection, setHasSavedSelection] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const selectedCount = selectedFilters.length;
  // Run Analysis is only enabled if: workflow selected + filters exist + filters applied this session
  const canRun =
    Number.isFinite(selectedWorkflowId) && selectedCount > 0 && hasAppliedFilters;

  // Stable fetcher with pagination
  const fetchResults = useCallback(async () => {
    const wf = Number(selectedWorkflowId);
    if (!Number.isFinite(wf)) return;

    setLoading(true);
    setErrMsg(null);
    try {
      const { rows, total, pagination } = await getFilteringModels({
        apiBase: API_BASE,
        token,
        workflowId: wf,
        page: currentPage,
        page_size: pageSize,
      });
      setRows(rows ?? []);
      setTotal(total);
      setPagination(pagination ?? null);
      if (pagination?.page && pagination.page !== currentPage) {
        setCurrentPage(pagination.page);
      }
    } catch (e: any) {
      console.log(payloadFilters)
      setRows([]);
      setTotal(undefined);
      setPagination(null);
      setErrMsg(e?.message || "Failed to fetch filtering results.");
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflowId, token, currentPage, pageSize]);

  // Fetch MFA headers from API when modal opens
  const fetchMfaHeaders = useCallback(async () => {
    const wf = Number(selectedWorkflowId);
    if (!Number.isFinite(wf) || !token) return;

    try {
      const url = `${API_BASE}/api/overlay/development/filtering_models/mfa_file/headers?workflow_id=${encodeURIComponent(wf)}`;
      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        console.warn("Failed to fetch MFA headers, using fallback headers");
        setMfaHeaders([]);
        return;
      }

      const data = await res.json();
      const apiHeaders = data?.data?.headers || [];
      setMfaHeaders(apiHeaders);
    } catch (e: any) {
      console.warn("Error fetching MFA headers:", e);
      setMfaHeaders([]);
    }
  }, [selectedWorkflowId, token]);

  // Load headers + selected on workflow change; ensure REQUIRED present; derive payload for initial render
  useEffect(() => {
    if (!Number.isFinite(selectedWorkflowId)) {
      setHeaders([]);
      setSelectedFilters([]);
      setPayloadFilters([]);
      setHasAppliedFilters(false);
      setHasRunAnalysis(false);
      setSelectedRowsCount(0);
      setCurrentPage(1);
      setPagination(null);
      return;
    }
    const wf = Number(selectedWorkflowId);

    // Load captured headers from Step 4, then ensure REQUIRED are present.
    const captured = loadHeaders(wf);
    const merged = uniqCaseInsensitive([...captured, ...REQUIRED_COLUMNS]);

    const sel = loadFilters(wf); // only explicit selections saved by the modal (REQUIRED will be saved after first Apply)
    setHeaders(merged);
    setSelectedFilters(sel);
    setPayloadFilters(buildPayload(merged, sel));
    setHasSavedSelection(Boolean(persistedSelected?.rows?.length));

    // Reset gating for new workflow
    setHasAppliedFilters(false);
    setHasRunAnalysis(false);
    setSelectedRowsCount(0);
    setSelectedRows([]);
    setSaveMsg(null);
    setSaveMsg(null);
    setSelectedRowsCount(0);
    setSelectedRows([]);
    setHasSavedSelection(false);
    setSaveMsg(null);
    setCurrentPage(1);
    setPagination(null);
  }, [selectedWorkflowId, persistedSelected]);

  // Auto-fetch results on mount & whenever workflow/page/pageSize changes
  useEffect(() => {
    const wf = Number(selectedWorkflowId);
    if (!Number.isFinite(wf)) return;
    fetchResults();
  }, [selectedWorkflowId, currentPage, pageSize, fetchResults]);

  // Fetch MFA headers when modal opens
  useEffect(() => {
    if (configOpen) {
      fetchMfaHeaders();
    }
  }, [configOpen, fetchMfaHeaders]);

  // Optional: re-fetch when tab gains focus
  useEffect(() => {
    const onFocus = () => {
      const wf = Number(selectedWorkflowId);
      if (!Number.isFinite(wf)) return;
      fetchResults();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [selectedWorkflowId, fetchResults]);
  function handleApplyFilters(finalRules: FilterRule[]) {
    setPayloadFilters(finalRules);
    if (Number.isFinite(selectedWorkflowId)) {
      setSelectedFilters(loadFilters(Number(selectedWorkflowId)));
    }
    setHasAppliedFilters(true);
    setHasRunAnalysis(false);
    setCurrentPage(1);
    setSaveMsg(null);
    runFiltering();
  }

  async function runFiltering() {
    if (!Number.isFinite(selectedWorkflowId)) {
      setErrMsg("Missing or invalid selectedWorkflowId.");
      return;
    }
    if (selectedCount === 0) {
      setErrMsg("Please configure at least one filter (gear icon).");
      return;
    }
    if (headers.length === 0) {
      setErrMsg("Click Configure, set filters, and Apply before running the analysis.");
      return;
    }

    setPosting(true);
    setErrMsg(null);
    try {
      // Send workload_id and filter in the payload
      await postFilteringModels({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
        filter_list: payloadFilters.map((f) => ({ column: f.column, value: f.value })),
      });
      // Reset to page 1 after applying filters
      setCurrentPage(1);
      // Fetch results with pagination (page 1)
      await fetchResults();
      // Mark that analysis has run successfully with the current filters
      setHasRunAnalysis(true);
    } catch (e: any) {
      setErrMsg(e?.message || "Failed to start filtering.");
    } finally {
      setPosting(false);
    }
  }

  // Enable export when data is present and not loading/posting
  useEffect(() => {
    const ready =
      Number.isFinite(selectedWorkflowId) &&
      !loading &&
      !posting &&
      ((rows?.length ?? 0) > 0 || (total ?? 0) > 0);
    setExportReady(Boolean(ready));
  }, [selectedWorkflowId, loading, posting, rows, total]);

  // Persist "ready for Step 6" status in Redux so Step 6 can validate
  useEffect(() => {
    if (!Number.isFinite(selectedWorkflowId)) return;
    const readyForStep6 =
      hasAppliedFilters && hasRunAnalysis && selectedRowsCount > 0 && hasSavedSelection;
    const payload = {
      readyForStep6,
      hasAppliedFilters,
      hasRunAnalysis,
      selectedRowsCount,
      hasSavedSelection,
      lastUpdated: new Date().toISOString(),
    };
    dispatch(
      setModuleProgress({
        moduleKey: "overlayDevelopment",
        contextKey,
        data: { step5Ready: payload as Step5ReadyState },
      })
    );
  }, [
    selectedWorkflowId,
    hasAppliedFilters,
    hasRunAnalysis,
    selectedRowsCount,
    hasSavedSelection,
    dispatch,
    contextKey,
  ]);

  // ---- Export handler ----
  async function exportCsv() {
    if (!Number.isFinite(selectedWorkflowId)) return;
    setExportErr(null);
    setExporting(true);
    try {
      const url = `${API_BASE}/api/overlay/development/filtering_models/export/?workflow_id=${encodeURIComponent(
        String(selectedWorkflowId)
      )}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "text/csv,application/json;q=0.9,*/*;q=0.8",
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
      const fallback = `filtering_models_${selectedWorkflowId}.csv`;

      if (ct.includes("csv") || ct.startsWith("text/csv")) {
        const blob = await res.blob();
        const filename = (nameMatch && decodeURIComponent(nameMatch[1])) || fallback;
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      } else {
        const json = await res.json();
        const jsonRows: Row[] = Array.isArray(json?.rows) ? json.rows : Array.isArray(json) ? json : [];
        const headers = deriveCsvHeaders(jsonRows);
        const csv = toCsv(headers, jsonRows);
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = fallback;
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

  const handleSaveSelection = useCallback(() => {
    const wf = Number(selectedWorkflowId);
    if (!Number.isFinite(wf)) {
      setErrMsg("Pick a workflow on Step 1 first.");
      return;
    }
    if (!selectedRows.length) {
      setErrMsg("Select one or more rows before saving.");
      return;
    }
    const ids = selectedRows.map((r) =>
      String((r as any).index ?? (r as any).id ?? `${(r as any).Y}|${(r as any).X1}|${(r as any).X2}`)
    );
    const payload = {
      ids,
      rows: selectedRows,
      savedAt: new Date().toISOString(),
    };
    dispatch(
      setModuleProgress({
        moduleKey: "overlayDevelopment",
        contextKey,
        data: { step5Selected: payload },
      })
    );
    dispatch(
      setModuleProgress({
        moduleKey: "overlayDevelopment",
        data: { lastWorkflowId: wf },
      })
    );
    setHasSavedSelection(true);
    setSaveMsg(`Saved ${selectedRows.length} model(s).`);
    setErrMsg(null);
  }, [selectedWorkflowId, selectedRows, dispatch, contextKey]);

  const headerRight = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setConfigOpen(true)}
          disabled={!Number.isFinite(selectedWorkflowId) || headers.length === 0}
          className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
          title={headers.length === 0 ? "Run Step 4 first to capture headers" : "Configure filters"}
        >
          <Cog6ToothIcon className="h-4 w-4" />
          Configure
          {selectedCount > 0 && (
            <span className="ml-1 rounded-full bg-neutral-200 px-2 py-0.5 text-xs">
              {selectedCount}
            </span>
          )}
        </button>

        <button
          onClick={runFiltering}
          disabled={posting || loading}
          className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50"
          title={
            !Number.isFinite(selectedWorkflowId)
              ? "Pick a workflow on Step 1 first."
              : !selectedCount
              ? "Add at least one filter via Configure."
              : !hasAppliedFilters
              ? "After configuring filters, click Apply in the modal before running the analysis."
              : "Run analysis using the configured filters."
          }
        >
          <PlayCircleIcon className="h-4 w-4" />
          {posting ? "Saving..." : "Save Models"}
        </button>

        <button
          onClick={fetchResults}
          disabled={loading || !Number.isFinite(selectedWorkflowId)}
          className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
          title={!selectedWorkflowId ? "Pick a workflow on Step 1" : "Fetch latest results once"}
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>

        {/* Export */}
        <button
          onClick={exportCsv}
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
    ),
    [
      posting,
      loading,
      selectedWorkflowId,
      headers.length,
      selectedCount,
      canRun,
      exportReady,
      exporting,
      hasAppliedFilters,
      hasRunAnalysis,
      selectedRowsCount,
      handleSaveSelection,
      fetchResults,
      exportCsv,
    ]
  );

  return (
    <div className="min-h-dvh bg-neutral-50 p-6">
      {/* Header */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 max-w-3xl text-sm text-neutral-600">{description}</p>
        </div>
        {headerRight}
      </div>

      {/* Clear step-by-step instructions for the user */}
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
        <p className="font-semibold">Before you can proceed to Step 6, please follow these steps:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Click <strong>Configure</strong> and set your filter rules (columns &amp; values).
          </li>
          <li>
            Inside the configuration modal, click <strong>Apply</strong> to save the filters.
          </li>
          <li>
            Back on this page, click <strong>Run Analysis</strong> to generate the filtered model list.
          </li>
          <li>
            After the table is populated, <strong>select one or more rows</strong> in the table.
          </li>
          <li>
            Click <strong>Save Models</strong> to persist your selection for Step 6.
          </li>
        </ol>
        <p className="mt-2">
          You can only continue to <strong>Step 6</strong> after you have run the analysis and selected models in the
          table.
        </p>
      </div>

      {/* Errors */}
      {errMsg && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {errMsg}
        </div>
      )}
      {saveMsg && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {saveMsg}
        </div>
      )}
      {exportErr && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {exportErr}
        </div>
      )}

      {/* Controls / pagination */}
      {pagination && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-neutral-300 px-2 py-1 text-sm disabled:opacity-50"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={loading || !pagination.has_previous}
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
              max={pagination.total_pages}
              value={currentPage}
              onChange={(e) => {
                const n = Math.max(1, Number(e.target.value) || 1);
                setCurrentPage(Math.min(n, pagination.total_pages));
              }}
              className="w-16 rounded-md border border-neutral-300 px-2 py-1"
              disabled={loading}
            />
            <span>/ {pagination.total_pages}</span>
          </div>

          <div className="ml-auto flex items-center gap-2 text-sm">
            <span>Rows per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                const n = Number(e.target.value);
                setPageSize(n);
                setCurrentPage(1);
              }}
              className="rounded-md border border-neutral-300 px-2 py-1"
              disabled={loading}
            >
              {[10, 20, 50, 100, 1000].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
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
          data={rows}
          selectable
          onFilteredChange={(filtered: any) => setFiltered(filtered)}
          initialSelectedIds={persistedChecked?.ids ?? []}
          getRowId={(r) =>
            String((r as any).index ?? (r as any).id ?? `${(r as any).Y}|${(r as any).X1}|${(r as any).X2}`)
          }
          onSelectionChange={(selRows) => {
            console.log("Selected:", selRows.length);
            const wf = Number(selectedWorkflowId);
            if (Number.isFinite(wf) && (!selRows || selRows.length === 0)) {
              const existingCount = Array.isArray(persistedChecked?.rows)
                ? persistedChecked.rows.length
                : 0;
              if (existingCount > 0) return;
            }
            // track selected rows for Step 6 gating
            setSelectedRowsCount(selRows.length);
            setSelectedRows(selRows || []);
            setHasSavedSelection(false);
            setSaveMsg(null);
            if (Number.isFinite(wf)) {
              const ids = (selRows || []).map((r) =>
                String((r as any).index ?? (r as any).id ?? `${(r as any).Y}|${(r as any).X1}|${(r as any).X2}`)
              );
              const payload = {
                ids,
                rows: selRows || [],
                savedAt: new Date().toISOString(),
              };
              dispatch(
                setModuleProgress({
                  moduleKey: "overlayDevelopment",
                  contextKey,
                  data: { step5Checked: payload },
                })
              );
              dispatch(
                setModuleProgress({
                  moduleKey: "overlayDevelopment",
                  data: { lastWorkflowId: wf },
                })
              );
            }
          }}
          emptyMessage="Run analysis (after configuring filters) to see results, then select rows to proceed to Step 6."
        />
      </div>

      {/* Footer / counts */}
      <p className="mt-3 text-sm text-neutral-600">
        {pagination ? (
          <>Showing {filtered.length} of {pagination.total_rows.toLocaleString()} (page {pagination.page} of {pagination.total_pages}).</>
        ) : (
          <>Showing {filtered.length} of {total ?? rows.length} rows.</>
        )}
      </p>

      {/* Status hint for Step 6 */}
      <p className="mt-1 text-xs text-neutral-700">
        {hasAppliedFilters && hasRunAnalysis
          ? selectedRowsCount > 0
            ? hasSavedSelection
              ? "✅ Models saved. Step 6 can now be unlocked."
              : "⚠️ Selection made. Click Save Models to unlock Step 6."
            : "⚠️ Analysis complete. Select at least one row in the table to unlock Step 6."
          : "⚠️ Step 6 is locked until you configure filters, click Apply, and run the analysis."}
      </p>

      {/* Config Modal */}
      <FilteringConfigModal
        workflowId={Number(selectedWorkflowId)}
        headers={uniqCaseInsensitive([...headers, ...mfaHeaders])}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onApply={handleApplyFilters} // gets FULL payload; badge reads selected from storage
      />
    </div>
  );
};

export default Step5;
