import { useEffect, useMemo, useState, useCallback } from "react";
import ExeTable from "../../../../components/overlay/development/interpolation/table/ExeTable";
import type { Frequency } from "../../../../components/overlay/development/interpolation/table/Columns";
import { ProcessModal } from "../../../../components/ProcessModal";
import { useAppSelector } from "../../../../redux_toolkit/hooks";

import {
  getInterpolationDataGET,
  runInterpolationPOST,
  sanitizeInterpolationRows,
  type InterpolationRow,
  type Mode,
} from "../../../../services/interpolation";

import {
  EyeIcon,
  PlayCircleIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export default function OverlayDevelopmentPage2() {
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const MODE: Mode = "development";

  // read workflow_id from Redux
  const {
    currentPdTransitionMatrixWorkflowId: selectedWorkflowId
  } = useAppSelector((s) => s.pdTransitionMatrixWfHelper as any);

  const token = useAppSelector(
    (s) => (s as any)?.auth?.token
  ) as string | null;

  const [rows, setRows] = useState<InterpolationRow[]>([]);
  const [loading, setLoading] = useState(false); // GET state
  const [posting, setPosting] = useState(false); // POST state
  const [err, setErr] = useState<string | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exportReady, setExportReady] = useState(false); // enabled after GET success

  // Clear on workflow change
  useEffect(() => {
    setRows([]);
    setErr(null);
    setFrequency("monthly");
    setExportReady(false);
  }, [selectedWorkflowId]);

  // ----- GET (read) -----
  const fetchInterpolation = useCallback(async () => {
    if (!selectedWorkflowId) {
      setRows([]);
      setErr("Select a workflow on Step 1 first.");
      setExportReady(false);
      return;
    }
    setErr(null); 
    setExportErr(null);
    setLoading(true);
    try {
      const resp = await getInterpolationDataGET({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
        frequency, // if backend ignores this, ok
        mode: MODE, // "development" | "execution"
      });

      const cleaned = sanitizeInterpolationRows(resp.data || []);
    
      setRows(cleaned);
      setExportReady(Array.isArray(cleaned) && cleaned.length > 0);
    } catch (e: any) {
      // If GET fails (e.g., 404 / empty), we keep table empty and let the user POST via button
      setErr(
        e?.message || 'No data yet. Click "Run Interpolation" to generate.'
      );
      setRows([]);
      setExportReady(false);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, token, selectedWorkflowId, frequency, MODE]);

  // Initial: try GET first
  useEffect(() => {
    if (!selectedWorkflowId) return;
    fetchInterpolation();
  }, [selectedWorkflowId, fetchInterpolation]);

  // Keep export flag accurate
  useEffect(() => {
    setExportReady(!!selectedWorkflowId && rows.length > 0 && !loading);
  }, [rows, loading, selectedWorkflowId]);

  // POST then GET
  const runInterpolation = useCallback(async () => {
    if (!selectedWorkflowId) return;
    setErr(null);
    setPosting(true);
    try {
      await runInterpolationPOST({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
        frequency, // optional
        mode: MODE,
      });
      // after POST, read results
      await fetchInterpolation();
    } catch (e: any) {
      setErr(e?.message || "Failed to run interpolation.");
    } finally {
      setPosting(false);
    }
  }, [API_BASE, token, selectedWorkflowId, frequency, MODE, fetchInterpolation]);

  // Table data
  const data = useMemo(() => rows, [rows]);

  // ===== Export CSV =====
  const exportCsv = useCallback(async () => {
    if (!selectedWorkflowId) return;
    setExportErr(null);
    setExporting(true);
    try {
      const url = `${API_BASE}/api/overlay/${MODE}/data_interpolation/export/?workflow_id=${encodeURIComponent(
        String(selectedWorkflowId)
      )}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        let msg = `Export failed: HTTP ${res.status}`;
        try {
          const t = await res.text();
          if (t) msg = `${msg} â€“ ${t}`;
        } catch {}
        throw new Error(msg);
      }

      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const match =
        cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i) ||
        cd.match(/filename=["']?([^"']+)["']?/i);
      const fallback = `interpolation_export_${selectedWorkflowId}.csv`;
      const filename = (match && decodeURIComponent(match[1])) || fallback;

      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e: any) {
      setExportErr(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }, [API_BASE, selectedWorkflowId, token, MODE]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white ">
        <div className="mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Interpolation
            </h1>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {/* View Process */}
            <button
              onClick={() => setOpen(true)}
              className="cursor-pointer rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50 flex items-center gap-1.5"
            >
              <EyeIcon className="h-4 w-4" />
              <span>View Process</span>
            </button>

            {/* Run (POST) */}
            <button
              onClick={runInterpolation}
              disabled={posting || !selectedWorkflowId}
              className="cursor-pointer rounded-xl bg-gray-100 text-gray-900 border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1.5"
              title={
                !selectedWorkflowId
                  ? "Select a workflow on Step 1 first"
                  : "Run interpolation job"
              }
            >
              <PlayCircleIcon className="h-4 w-4" />
              <span>{posting ? "Runningâ€¦" : "Run Interpolation"}</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={exportCsv}
              disabled={!exportReady || exporting || !selectedWorkflowId}
              className="cursor-pointer rounded-xl bg-white border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
              title={
                !selectedWorkflowId
                  ? "Select a workflow on Step 1 first"
                  : !exportReady
                  ? "Load data first (GET)"
                  : "Download CSV"
              }
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span>{exporting ? "Exportingâ€¦" : "Export CSV"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Data card */}
      <main className="mx-auto px-4 pb-8">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 ">
            <div className="text-sm text-gray-600">
              {selectedWorkflowId ? (
                <>
                  Showing{" "}
                  <span className="font-medium">{frequency}</span> dataset {" "}
                  {loading ? "Loading" : `${data.length.toLocaleString()} rows`}
                </>
              ) : (
                <>No workflow selected</>
              )}
            </div>

            {/* Inline actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={fetchInterpolation}
                disabled={loading || !selectedWorkflowId}
                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
                title={
                  !selectedWorkflowId
                    ? "Select a workflow on Step 1 first"
                    : "Refresh (GET)"
                }
              >
                <ArrowPathIcon className="h-4 w-4" />
                <span>{loading ? "Refreshing" : "Refresh"}</span>
              </button>
            </div>
          </div>

          {err && (
            <div className="px-4 py-3 text-sm text-red-700 bg-red-50  border-red-200">
              {err}
            </div>
          )}
          {exportErr && (
            <div className="px-4 py-3 text-sm text-red-700 bg-red-50  border-red-200">
              {exportErr}
            </div>
          )}

          <div className="p-3">
            <ExeTable
              frequency={frequency}
              data={data}
              caption={
                frequency === "monthly" ? "Monthly Data" : "Quarterly Data"
              }
              includeQuarterInMonthly={false}
              growthSuffix=" growth_rate" // <-- matches your API
            />
          </div>
        </div>
      </main>

      <ProcessModal
        open={open}
        onClose={() => setOpen(false)}
        heading={"OVERLAY MODEL DEVELOPMENT"}
        steps={[
          "Interpolate quarterly MEVs into monthly data to match default rate frequency",
          "Apply statistical transformations: lagging, logarithmic scaling, differencing, etc.",
          "Generate forecasts of economic variables using ARIMA or other time series models.",
          "Narrow down models based on statistical performance, business relevance, and logical relationship with default.",
          "Select a model for validation and endorsement to committee and management.",
        ]}
      />
    </div>
  );
}

