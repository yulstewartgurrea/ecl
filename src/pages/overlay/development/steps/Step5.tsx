// src/pages/overlay/development/multi_factor/Step5.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { OdFilteringAbout } from "../../../../components/about/OverlayDevelopmentAbout";
import { Multi_Table, type Row } from "../../../../components/overlay/development/multi_factor/Multi_Table";
import { getFilteringModels, postFilteringModels } from "../../../../services/filteringModels";
import { useAppDispatch, useAppSelector } from "../../../../redux_toolkit/hooks";
import type { RootState } from "../../../../redux_toolkit/store";
import {
  ArrowPathIcon,
  PlayCircleIcon,
  Cog6ToothIcon,
  ArrowDownTrayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

import FilteringConfigModal from "../../../../components/overlay/development/multi_factor/FilteringConfigModal";
import {
  loadHeaders,
  loadFilters,
  loadFilterLogic,
  type FilterRule,
  type FilterLogic,
} from "../../../../utils/overlay/headersStorage";
import { selectModuleProgress, setModuleProgress } from "../../../../redux_toolkit/features/progress/moduleProgressSlice";
import { downloadBlobWithTauri } from "../../../../utils/downloadBlobWithTauri";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

/* ------------------------- Helper functions ------------------------- */
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

/**
 * Clean search string but preserve comma-separated format.
 * - Trim overall string
 * - If commas present: split on comma, trim each term, drop empty terms, re-join with commas.
 * - If no commas: just return the trimmed single term.
 */
const cleanSearchString = (s: string) => {
  const raw = String(s ?? "").trim();
  if (!raw) return "";
  if (raw.includes(",")) {
    return raw
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0)
      .join(",");
  }
  return raw;
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

const EXCLUDE_KEYS = new Set(["id", "index", "__rowid__", "_rowIndex"]);

function buildPayload(selected: FilterRule[]): FilterRule[] {
  return selected
    .filter((r) => r?.column && r.value && r.value !== "0")
    .map((r) => ({
      id: r.id || `__payload_${r.column}`,
      column: r.column,
      value: String(r.value ?? "").trim(),
      operator: r.operator || ">",
    }));
}

/* CSV helpers (used only if export endpoint returns JSON) */
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
  return "\uFEFF" + head + "\n" + body;
}

const Step5: React.FC<Step5Props> = ({ title = "Filtering of Models", description = "" }) => {
  const dispatch = useAppDispatch();

    const {
    currentPdTransitionMatrixWorkflowId: selectedWorkflowId
  } = useAppSelector((s) => s.pdTransitionMatrixWfHelper as any);

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

  // Server-paged rows (only current page)
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number>(0);

  // Pagination state (server-side)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [pagination, setPagination] = useState<{
    page: number;
    page_size: number;
    total_rows: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  } | null>(null);

  // Global server-side search (BUTTON TRIGGERED)
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [searchCooldown, setSearchCooldown] = useState(false);
  // headers + filters
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<FilterRule[]>([]);
  const [payloadFilters, setPayloadFilters] = useState<FilterRule[]>([]);
  const [filterLogic, setFilterLogic] = useState<FilterLogic>("AND");
  const [configOpen, setConfigOpen] = useState(false);
  const [num_vars_taken, setNum_vars_taken] = useState<number>(2);

  // Export states
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exportReady, setExportReady] = useState(false);

  // Step gating states
  const [hasAppliedFilters, setHasAppliedFilters] = useState(false);
  const [hasRunAnalysis, setHasRunAnalysis] = useState(false);
  const [selectedRowsCount, setSelectedRowsCount] = useState(0);
  const [selectedRows, setSelectedRows] = useState<Row[]>([]);
  const [hasSavedSelection, setHasSavedSelection] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const selectedCount = selectedFilters.length;

  /* ----------------------- Fetch results (page only) ----------------------- */
  const fetchFilteringResults = useCallback(async () => {
    const wf = Number(selectedWorkflowId);
    if (!Number.isFinite(wf)) return;
    console.log(selectedRows)
    setLoading(true);
    setErrMsg(null);
    try {
      const res = await getFilteringModels({
        apiBase: API_BASE,
        token,
        workflowId: wf,
        page: currentPage,
        page_size: pageSize,
        num_vars_taken: num_vars_taken,
        // NOTE: only works if backend supports `search` query param
        // If your backend doesn't support it yet, remove this and keep UI (no functional change).
        variable_names: search,
      } as any);

      const pageRows = (res.rows ?? []) as Row[];
      setRows(pageRows);

      const totalRows = res.pagination?.total_rows ?? res.total ?? pageRows.length ?? 0;
      setTotal(totalRows);

      setPagination(res.pagination ?? null);
    } catch (e: any) {
      setRows([]);
      setTotal(0);
      setPagination(null);
      setErrMsg(e?.message || "Failed to fetch filtering results.");
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflowId, token, currentPage, pageSize, num_vars_taken, search]);

  /* ------------------------- MFA headers fetcher -------------------------- */
  const fetchMfaHeaders = useCallback(async () => {
    const wf = Number(selectedWorkflowId);
    if (!Number.isFinite(wf) || !token) return [];

    try {
      const url = `${API_BASE}/api/overlay/development/filtering_models/mfa_file/headers?workflow_id=${encodeURIComponent(
        wf
      )}&num_of_vars=${encodeURIComponent(num_vars_taken)}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) return [];
      const data = await res.json();
      return data?.data?.headers || [];
    } catch {
      return [];
    }
  }, [selectedWorkflowId, token, num_vars_taken]);

  /* -------------------- Workflow change: load headers --------------------- */
  useEffect(() => {
    if (!Number.isFinite(selectedWorkflowId)) {
      setHeaders([]);
      setSelectedFilters([]);
      setPayloadFilters([]);
      setFilterLogic("AND");

      setHasAppliedFilters(false);
      setHasRunAnalysis(false);
      setSelectedRowsCount(0);
      setSelectedRows([]);
      setHasSavedSelection(false);
      setSaveMsg(null);

      setRows([]);
      setTotal(0);
      setPagination(null);

      setCurrentPage(1);
      setPageSize(10);

      setSearchInput("");
      setSearch("");

      return;
    }

    const wf = Number(selectedWorkflowId);

    const loadHeadersAsync = async () => {
      const apiHeaders = await fetchMfaHeaders();
      const captured = loadHeaders(wf);
      const merged = uniqCaseInsensitive([...captured, ...apiHeaders]);

      const sel = loadFilters(wf);
      const logic = loadFilterLogic(wf);

      setHeaders(merged);
      setSelectedFilters(sel);
      setPayloadFilters(buildPayload(sel));
      setFilterLogic(logic);

      setHasSavedSelection(Boolean(persistedSelected?.rows?.length));

      // reset gating & paging for new workflow
      setHasAppliedFilters(false);
      setHasRunAnalysis(false);
      setSelectedRowsCount(0);
      setSelectedRows([]);
      setSaveMsg(null);

      setCurrentPage(1);
      setPagination(null);

      setSearchInput("");
      setSearch("");
    };

    loadHeadersAsync();
  }, [selectedWorkflowId, persistedSelected, fetchMfaHeaders]);

  /* ------------- Re-fetch headers if num_vars_taken changes -------------- */
  useEffect(() => {
    const wf = Number(selectedWorkflowId);
    if (!Number.isFinite(wf)) return;

    const refetch = async () => {
      const apiHeaders = await fetchMfaHeaders();
      const captured = loadHeaders(wf);
      const merged = uniqCaseInsensitive([...captured, ...apiHeaders]);
      setHeaders(merged);
    };

    refetch();
  }, [num_vars_taken, selectedWorkflowId, fetchMfaHeaders]);

  /* ---------------- Fetch page when dependencies change ------------------ */
  useEffect(() => {
    const wf = Number(selectedWorkflowId);
    if (!Number.isFinite(wf)) return;
    fetchFilteringResults();
  }, [selectedWorkflowId, fetchFilteringResults]);

  /* ----------------------- Re-fetch on tab focus -------------------------- */
  useEffect(() => {
    const onFocus = () => {
      const wf = Number(selectedWorkflowId);
      if (!Number.isFinite(wf)) return;
      fetchFilteringResults();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [selectedWorkflowId, fetchFilteringResults]);

  /* -------------------------- Search handlers ----------------------------- */
const applySearch = useCallback(() => {
    if (searchCooldown || loading) return;
    const next = cleanSearchString(searchInput);
    // avoid duplicate requests
    if (next === search) return;

    // simple cooldown to prevent spamming the backend
    setSearchCooldown(true);
    window.setTimeout(() => setSearchCooldown(false), 1000);

    setCurrentPage(1);
    setSearch(next);
  }, [searchInput, search, searchCooldown, loading]);

  const clearSearch = useCallback(() => {
    setSearchInput("");
    setCurrentPage(1);
    setSearch("");
  }, []);

  const onSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        applySearch();
      }
    },
    [applySearch]
  );

  /* ------------------------ Apply filters (POST) -------------------------- */
  function handleApplyFilters(selectedRules: FilterRule[], numVarsTaken?: number, logic?: FilterLogic) {
    const filteredRules = selectedRules
      .filter((r) => r.value && r.value !== "0")
      .map((r) => ({ ...r, operator: r.operator || ">" }));

    setPayloadFilters(filteredRules);

    if (numVarsTaken !== undefined) setNum_vars_taken(numVarsTaken);
    if (logic !== undefined) setFilterLogic(logic);

    if (Number.isFinite(selectedWorkflowId)) {
      setSelectedFilters(loadFilters(Number(selectedWorkflowId)));
    }

    setHasAppliedFilters(true);
    setHasRunAnalysis(false);
    setCurrentPage(1);
    setSaveMsg(null);

    handleRunFiltering(filteredRules, logic);
  }

  async function handleRunFiltering(filtersToUse?: FilterRule[], logicOverride?: FilterLogic) {
    if (!Number.isFinite(selectedWorkflowId)) {
      setErrMsg("Missing or invalid selectedWorkflowId.");
      return;
    }
    const effectiveFilters = (filtersToUse && filtersToUse.length ? filtersToUse : payloadFilters) || [];
    const effectiveCount = effectiveFilters.filter((f) => f?.column && f.value && f.value !== "0").length;
    if (effectiveCount === 0) {
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
      const filters = filtersToUse || payloadFilters;
      const logic = logicOverride || filterLogic || "AND";

      await postFilteringModels({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
        filter_logic: logic as any, // if your service expects it, keep; otherwise remove
        filter_list: filters
          .filter((f) => f.value && f.value !== "0")
          .map((f) => ({
            column: f.column,
            value: f.value,
            operator: f.operator || ">",
          })),
        // Use cleaned search input (preserve comma-separated string)
        variable_names: cleanSearchString(searchInput),
      } as any);

      // after POST, fetch page 1
      setCurrentPage(1);
      await fetchFilteringResults();
      setHasRunAnalysis(true);
    } catch (e: any) {
      setErrMsg(e?.message || "Failed to start filtering.");
    } finally {
      setPosting(false);
    }
  }

  /* -------------------------- Export readiness ---------------------------- */
  useEffect(() => {
    const ready =
      Number.isFinite(selectedWorkflowId) &&
      !loading &&
      !posting &&
      ((rows?.length ?? 0) > 0 || (total ?? 0) > 0);

    setExportReady(Boolean(ready));
  }, [selectedWorkflowId, loading, posting, rows, total]);

  /* --------------------- Persist Step 6 readiness ------------------------- */
  useEffect(() => {
    if (!Number.isFinite(selectedWorkflowId)) return;

    const readyForStep6 = hasAppliedFilters && hasRunAnalysis && selectedRowsCount > 0 && hasSavedSelection;

    const payload: Step5ReadyState = {
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
        data: { step5Ready: payload },
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

  /* ----------------------------- Export CSV ------------------------------- */
  async function exportCsv() {
    if (!Number.isFinite(selectedWorkflowId)) return;

    setExportErr(null);
    setExporting(true);

    try {
      const url = `${API_BASE}/api/overlay/development/filtering_models/export/?workflow_id=${encodeURIComponent(
        String(selectedWorkflowId)
      )}&num_of_vars=${encodeURIComponent(num_vars_taken)}`;

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
        await downloadBlobWithTauri(blob, filename);
      } else {
        const json = await res.json();
        const jsonRows: Row[] = Array.isArray(json?.rows) ? json.rows : Array.isArray(json) ? json : [];
        const headers = deriveCsvHeaders(jsonRows);
        const csv = toCsv(headers, jsonRows);

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        await downloadBlobWithTauri(blob, fallback);
      }
    } catch (e: any) {
      setExportErr(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }

  /* ---------------------- Selection + persistence ------------------------- */
  const getRowId = useCallback((r: Row) => {
    return String(
      (r as any).index ?? (r as any).id ?? `${(r as any).Y}|${(r as any).X1}|${(r as any).X2}`
    );
  }, []);

  // const handleSaveSelection = useCallback(() => {
  //   const wf = Number(selectedWorkflowId);
  //   if (!Number.isFinite(wf)) {
  //     setErrMsg("Pick a workflow on Step 1 first.");
  //     return;
  //   }
  //   if (!selectedRows.length) {
  //     setErrMsg("Select one or more rows before saving.");
  //     return;
  //   }

  //   const ids = selectedRows.map((r) =>
  //     String((r as any).index ?? (r as any).id ?? `${(r as any).Y}|${(r as any).X1}|${(r as any).X2}`)
  //   );

  //   const payload = { ids, rows: selectedRows, savedAt: new Date().toISOString() };

  //   dispatch(
  //     setModuleProgress({
  //       moduleKey: "overlayDevelopment",
  //       contextKey,
  //       data: { step5Selected: payload },
  //     })
  //   );

  //   dispatch(
  //     setModuleProgress({
  //       moduleKey: "overlayDevelopment",
  //       data: { lastWorkflowId: wf },
  //     })
  //   );

  //   setHasSavedSelection(true);
  //   setSaveMsg(`Saved ${selectedRows.length} model(s).`);
  //   setErrMsg(null);
  // }, [selectedWorkflowId, selectedRows, dispatch, contextKey]);

  const handleSelectionChange = useCallback(
    (selRows: Row[]) => {
      const wf = Number(selectedWorkflowId);

      // if user clears selection but we have persisted selection, keep it (your existing behavior)
      if (Number.isFinite(wf) && (!selRows || selRows.length === 0)) {
        const existingCount = Array.isArray(persistedChecked?.rows) ? persistedChecked.rows.length : 0;
        if (existingCount > 0) return;
      }

      const currentIds = (selRows || [])
        .map((r) => String((r as any).index ?? (r as any).id ?? `${(r as any).Y}|${(r as any).X1}|${(r as any).X2}`))
        .sort();

      const persistedIds = (persistedChecked?.ids || []).map(String).sort();

      const selectionChanged =
        currentIds.length !== persistedIds.length || currentIds.some((id, i) => id !== persistedIds[i]);

      setSelectedRowsCount(selRows.length);
      setSelectedRows(selRows || []);
      setHasSavedSelection(false);
      setSaveMsg(null);

      if (Number.isFinite(wf) && selectionChanged) {
        const payload = { ids: currentIds, rows: selRows || [], savedAt: new Date().toISOString() };

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
    },
    [selectedWorkflowId, persistedChecked, dispatch, contextKey]
  );

  /* -------------------------- Derived pagination -------------------------- */
  const clientPagination = useMemo(() => {
    if (!pagination) {
      const totalPages = Math.max(1, Math.ceil((total ?? 0) / Math.max(1, pageSize)));
      return {
        page: currentPage,
        page_size: pageSize,
        total_rows: total ?? 0,
        total_pages: totalPages,
        has_next: currentPage < totalPages,
        has_previous: currentPage > 1,
      };
    }

    return {
      page: pagination.page,
      page_size: pagination.page_size,
      total_rows: pagination.total_rows,
      total_pages: pagination.total_pages,
      has_next: pagination.has_next,
      has_previous: pagination.has_previous,
    };
  }, [pagination, currentPage, pageSize, total]);

  /* ------------------------------- Header UI ------------------------------ */
  const headerRight = useMemo(
    () => (
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setConfigOpen(true)}
          className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
          title={headers.length === 0 ? "Run Step 4 first to capture headers" : "Configure filters"}
        >
          <Cog6ToothIcon className="h-4 w-4" />
          Configure
          {selectedCount > 0 && (
            <span className="ml-1 rounded-full bg-neutral-200 px-2 py-0.5 text-xs">{selectedCount}</span>
          )}
        </button>

        <button
          onClick={() => handleRunFiltering()}
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
          onClick={fetchFilteringResults}
          disabled={loading || !Number.isFinite(selectedWorkflowId)}
          className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
          title={!selectedWorkflowId ? "Pick a workflow on Step 1" : "Fetch latest results once"}
        >
          <ArrowPathIcon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>

        <button
          onClick={exportCsv}
          disabled={!exportReady || exporting || !Number.isFinite(selectedWorkflowId)}
          className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
          title={
            !Number.isFinite(selectedWorkflowId) ? "Pick a workflow on Step 1" : !exportReady ? "Load results first" : "Download CSV"
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
      exportReady,
      exporting,
      hasAppliedFilters,
      fetchFilteringResults,
    ]
  );
  /* -------------------------------- Render -------------------------------- */
  return (
    <div className="min-h-dvh bg-neutral-50 p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-sm text-neutral-600">{description}</p> : null}
        </div>
        {headerRight}
      </div>

      <div className="mb-4">
        <OdFilteringAbout />
      </div>

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
          You can only continue to <strong>Step 6</strong> after you have run the analysis and selected models in the table.
        </p>
      </div>

      {errMsg && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{errMsg}</div>}
      {saveMsg && <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{saveMsg}</div>}
      {exportErr && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{exportErr}</div>}

      {/* Controls: Search + Pagination */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {/* Search box (manual trigger) */}
        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 py-2">
          <span className="text-sm text-neutral-700">Search</span>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Type keyword..."
            className="w-64 rounded-md border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
            disabled={loading}
          />

          <button
            onClick={applySearch}
            disabled={loading || searchCooldown || cleanSearchString(searchInput) === search}
            className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50"
            title="Search"
          >
            <MagnifyingGlassIcon className="h-4 w-4" />
            Search
          </button>

          <button
            onClick={clearSearch}
            disabled={loading || (searchInput.length === 0 && search.length === 0)}
            className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-800 hover:bg-neutral-50 disabled:opacity-50"
            title="Clear"
          >
            <XMarkIcon className="h-4 w-4" />
            Clear
          </button>
        </div>

        {/* Prev / Next */}
        <div className="flex items-center gap-2">
          <button
            className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={loading || !clientPagination.has_previous}
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Prev
          </button>

          <button
            className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm disabled:opacity-50"
            onClick={() => setCurrentPage((p) => p + 1)}
            disabled={loading || !clientPagination.has_next}
          >
            Next
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>

        {/* Page input */}
        <div className="flex items-center gap-2 text-sm">
          <span>Page</span>
          <input
            type="number"
            min={1}
            max={clientPagination.total_pages}
            value={currentPage}
            onChange={(e) => {
              const n = Math.max(1, Number(e.target.value) || 1);
              setCurrentPage(Math.min(n, clientPagination.total_pages));
            }}
            className="w-16 rounded-md border border-neutral-300 px-2 py-1"
            disabled={loading}
          />
          <span>/ {clientPagination.total_pages}</span>
        </div>

        {/* Page size */}
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => {
              const n = Number(e.target.value);
              setPageSize(n);
              setCurrentPage(1);
            }}
            className="rounded-md border border-neutral-300 bg-white px-2 py-1"
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

      {/* Table */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 z-10 grid place-items-center rounded-2xl bg-white/60 backdrop-blur-sm">
            <div className="animate-pulse rounded-xl border border-neutral-200 bg-white px-4 py-2 text-sm">Loading…</div>
          </div>
        )}

        <Multi_Table
          data={rows}
          selectable
          initialSelectedIds={persistedChecked?.ids ?? []}
          getRowId={(r) => getRowId(r)}
          onSelectionChange={(selRows) => handleSelectionChange(selRows)}
          emptyMessage="Run analysis (after configuring filters) to see results, then select rows to proceed to Step 6."
        />
      </div>

      {/* Footer / counts */}
      <p className="mt-3 text-sm text-neutral-600">
        Showing <strong>{rows.length.toLocaleString()}</strong> rows on this page • Total{" "}
        <strong>{clientPagination.total_rows.toLocaleString()}</strong> rows (page{" "}
        <strong>{clientPagination.page}</strong> of <strong>{clientPagination.total_pages}</strong>).
      </p>

      {/* Status hint */}
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
        headers={headers}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onApply={handleApplyFilters}
        initialNumVarsTaken={num_vars_taken}
        token={token}
        apiBase={API_BASE}
      />
    </div>
  );
};

export default Step5;
