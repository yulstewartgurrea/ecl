import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Multi_Table, type Row } from "../../../../components/overlay/development/multi_factor/Multi_Table";
import { getFilteringModels, postFilteringModels } from "../../../../services/filteringModels";
import { useAppSelector } from "../../../../redux_toolkit/hooks";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import { ArrowPathIcon, PlayCircleIcon, Cog6ToothIcon } from "@heroicons/react/24/outline";

import FilteringConfigModal from "../../../../components/overlay/development/multi_factor/FilteringConfigModal";
import { loadHeaders, loadFilters, type FilterRule } from "../../../../components/overlay/development/multi_factor/headersStorage";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

type Step5Props = {
  title?: string;
  description?: string;
};

// exclude some utility keys if we have to CSV-convert JSON client-side
const EXCLUDE_KEYS = new Set(["id", "index", "__rowid__", "_rowIndex"]);

// helper: build the backend payload from headers + selected
function buildPayload(headers: string[], selected: FilterRule[]): FilterRule[] {
  const norm = (s: string) => String(s || "").trim().toLowerCase();
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
  description = "Trigger filtering, then review the filtered model list. Use column filters to narrow by variables, lags, and stats."
}) => {
  const { currentPdTransitionMatrixWorkflowId: selectedWorkflowId } =
    useSelector((s: RootState) => s.pdTransitionMatrixWfHelper as any);

  const token = useAppSelector((s) => (s as any)?.auth?.token) as string | null;

  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [filtered, setFiltered] = useState<Row[]>([]);
  const [total, setTotal] = useState<number | undefined>(undefined);

  // NEW: split selected vs payload
  const [headers, setHeaders] = useState<string[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<FilterRule[]>([]);
  const [payloadFilters, setPayloadFilters] = useState<FilterRule[]>([]);
  const [configOpen, setConfigOpen] = useState(false);

  // Export states
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exportReady, setExportReady] = useState(false);

  const selectedCount = selectedFilters.length;
  const canRun = Number.isFinite(selectedWorkflowId) && selectedCount > 0;

  // Stable fetcher
  const fetchResults = useCallback(async () => {
    const wf = Number(selectedWorkflowId);
    if (!Number.isFinite(wf)) return;

    setLoading(true);
    setErrMsg(null);
    try {
      const { rows, total } = await getFilteringModels({
        apiBase: API_BASE,
        token,
        workflowId: wf,
      });
      setRows(rows ?? []);
      setTotal(total);
    } catch (e: any) {
      setRows([]);
      setTotal(undefined);
      setErrMsg(e?.message || "Failed to fetch filtering results.");
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflowId, token]);

  // Load headers + selected on workflow change; derive payload for initial render
  useEffect(() => {
    if (!Number.isFinite(selectedWorkflowId)) {
      setHeaders([]);
      setSelectedFilters([]);
      setPayloadFilters([]);
      return;
    }
    const wf = Number(selectedWorkflowId);
    const h = loadHeaders(wf);
    const sel = loadFilters(wf); // only explicit selections saved by the modal
    setHeaders(h);
    setSelectedFilters(sel);
    setPayloadFilters(buildPayload(h, sel));
  }, [selectedWorkflowId]);

  // ✅ Auto-fetch results on mount & whenever the workflow changes
  useEffect(() => {
    const wf = Number(selectedWorkflowId);
    if (!Number.isFinite(wf)) return;
    fetchResults();
  }, [selectedWorkflowId, fetchResults]);

  // ✅ Optional: re-fetch when the tab gains focus (e.g., after running Step 4)
  useEffect(() => {
    const onFocus = () => {
      const wf = Number(selectedWorkflowId);
      if (!Number.isFinite(wf)) return;
      fetchResults();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [selectedWorkflowId, fetchResults]);

  // ✅ When modal applies filters, reflect them locally and pull current results (no heavy POST)
  function handleApplyFilters(finalRules: FilterRule[]) {
    setPayloadFilters(finalRules); // use for POST
    if (Number.isFinite(selectedWorkflowId)) {
      setSelectedFilters(loadFilters(Number(selectedWorkflowId)));
    }
    // Just fetch what's currently available (user can still click "Run Analysis" to recompute)
    fetchResults();
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
    setPosting(true);
    setErrMsg(null);
    try {
      // IMPORTANT: if backend expects filters in body, include payloadFilters here.
      await postFilteringModels({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
        // filters: payloadFilters.map((f) => ({ column: f.column, value: f.value })),
      });
      // After triggering compute, pull fresh results
      await fetchResults();
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
        // Server already returns CSV
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
        // Server returned JSON → convert to CSV client-side
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
            <span className="ml-1 rounded-full bg-neutral-200 px-2 py-0.5 text-xs">{selectedCount}</span>
          )}
        </button>

        <button
          onClick={runFiltering}
          disabled={posting || loading || !canRun}
          className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50"
          title={!canRun ? "Configure at least one filter via the gear icon" : ""}
        >
          <PlayCircleIcon className="h-4 w-4" />
          {posting ? "Running…" : "Run Analysis"}
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

        {/* NEW: Export */}
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
          {exporting ? "Exporting…" : "Export"}
        </button>
      </div>
    ),
    [posting, loading, selectedWorkflowId, headers.length, selectedCount, canRun, exportReady, exporting]
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
          data={rows}
          selectable
          onFilteredChange={(filtered: any) => setFiltered(filtered)}
          storageKey={`overlay:step5:selected:${selectedWorkflowId}`}
          getRowId={(r) =>
            String((r as any).index ?? (r as any).id ?? `${(r as any).Y}|${(r as any).X1}|${(r as any).X2}`)
          }
          onSelectionChange={(selRows) => {
            // eslint-disable-next-line no-console
            console.log("Selected:", selRows.length);
          }}
          emptyMessage="Run analysis (after configuring filters) to see results."
        />
      </div>

      {/* Footer / count */}
      <p className="mt-3 text-sm text-neutral-600">
        Showing {filtered.length} of {total ?? rows.length} rows.
      </p>

      {/* Config Modal */}
      <FilteringConfigModal
        workflowId={Number(selectedWorkflowId)}
        headers={headers}
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        onApply={handleApplyFilters} // gets FULL payload; badge reads selected from storage
      />
    </div>
  );
};

export default Step5;