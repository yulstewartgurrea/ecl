import { useEffect, useMemo, useState, useCallback } from "react";
import ExeTable from "../../../../components/overlay/development/interpolation/table/ExeTable";
import type { Frequency } from "../../../../components/overlay/development/interpolation/table/Columns";
import { ProcessModal } from "../../../../components/ProcessModal";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import { useAppSelector } from "../../../../redux_toolkit/hooks";

import {
  getInterpolationData,
  sanitizeInterpolationRows,
  type InterpolationRow,
} from "../../../../services/interpolation.ts";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

/** Flag key written by Step 1 (POST) once it succeeds */
const postDoneKey = (workflowId: number | string) =>
  `overlay:interpolation:posted:${workflowId}`;

export default function OverlayDevelopmentPage2() {
  const [open, setOpen] = useState(true);
  const [frequency, setFrequency] = useState<Frequency>("monthly");

  // read workflow_id from Redux
  const { currentPdTransitionMatrixWorkflowId: selectedWorkflowId } =
    useSelector((s: RootState) => s.pdTransitionMatrixWfHelper as any);

  const token = useAppSelector((s) => (s as any)?.auth?.token) as string | null;

  const [rows, setRows] = useState<InterpolationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Export state
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exportReady, setExportReady] = useState(false); // enabled after GET success

  // Optional: when workflow changes, clear current table but DON'T fetch.
  useEffect(() => {
    setRows([]);
    setErr(null);
    setFrequency("monthly");
    setExportReady(false);
  }, [selectedWorkflowId]);

  // Manual trigger (Refresh buttons call this)
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
      const resp = await getInterpolationData({
        apiBase: API_BASE,
        token,
        workflowId: selectedWorkflowId,
        frequency, // if backend ignores this, it’s fine
      });
      const cleaned = sanitizeInterpolationRows(resp.data);
      setRows(cleaned);
      // Mark export as ready once GET succeeded and we have any rows
      setExportReady(Array.isArray(cleaned) && cleaned.length > 0);
    } catch (e: any) {
      setErr(e?.message || "Failed to load interpolated data");
      setRows([]);
      setExportReady(false);
    } finally {
      setLoading(false);
    }
  }, [API_BASE, token, selectedWorkflowId, frequency]);

  /**
   * NEW: Auto-run GET once Step 1 POST has completed.
   * Step 1 should set localStorage flag postDoneKey(workflowId) after POST succeeds.
   * We check it on mount / workflow change, and then clear it after fetching (one-shot).
   */
  useEffect(() => {
    if (!selectedWorkflowId) return;

    fetchInterpolation()
  }, [selectedWorkflowId, fetchInterpolation]);

  // Also ensure exportReady toggles properly whenever rows change via other triggers
  useEffect(() => {
    
    setExportReady(!!selectedWorkflowId && rows.length > 0 && !loading);
  }, [rows, loading, selectedWorkflowId]);

  // Table data
  const data = useMemo(() => rows, [rows]);

  // ===== Export CSV =====
  // Endpoint example required by you:
  // http://localhost:8000/api/overlay/development/data_interpolation/export/?workflow_id=22
  // We will use selectedWorkflowId to fill the query param.
  const exportCsv = useCallback(async () => {
    if (!selectedWorkflowId) return;
    setExportErr(null);
    setExporting(true);
    try {
      const url = `${API_BASE}/api/overlay/development/data_interpolation/export/?workflow_id=${encodeURIComponent(
        String(selectedWorkflowId)
      )}`;

      const res = await fetch(url, {
        method: "GET",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        // Try to parse text error to show a useful message
        let msg = `Export failed: HTTP ${res.status}`;
        try {
          const t = await res.text();
          if (t) msg = `${msg} – ${t}`;
        } catch {}
        throw new Error(msg);
      }

      const blob = await res.blob();
      // Best-effort filename from Content-Disposition, else fallback
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
  }, [API_BASE, selectedWorkflowId, token]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white border-b">
        <div className="mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Expected Credit Loss Automation
            </h1>
            <p className="text-sm text-gray-600">
              Interpolate quarterly MEVs (Quarterly Historical Mevs) into monthly data to match default rate frequency
            </p>
          </div>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={() => setOpen(true)}
              className="cursor-pointer rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
            >
              View Process
            </button>

            {/* Refresh (GET) */}
            <button
              onClick={fetchInterpolation}
              disabled={loading || !selectedWorkflowId}
              className="cursor-pointer rounded-xl bg-gray-900 text-white px-3 py-2 text-sm font-medium hover:bg-black disabled:opacity-50"
              title={!selectedWorkflowId ? "Select a workflow on Step 1 first" : "Refresh data"}
            >
              {loading ? "Loading…" : "Run Interpolation"}
            </button>

            {/* Export CSV */}
            <button
              onClick={exportCsv}
              disabled={!exportReady || exporting || !selectedWorkflowId}
              className="cursor-pointer rounded-xl bg-white border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              title={
                !selectedWorkflowId
                  ? "Select a workflow on Step 1 first"
                  : !exportReady
                  ? "Load data first (Run Interpolation)"
                  : "Download CSV"
              }
            >
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          </div>
        </div>
      </header>

      {/* Data card */}
      <main className="mx-auto px-4 pb-8">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex items-center justify-between px-4 py-3 border-b">
            <div className="text-sm text-gray-600">
              {selectedWorkflowId ? (
                <>
                  Showing <span className="font-medium">{frequency}</span> dataset •{" "}
                  {loading ? "Loading…" : `${data.length.toLocaleString()} rows`}
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
                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                title={!selectedWorkflowId ? "Select a workflow on Step 1 first" : "Refresh data"}
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
              <button
                onClick={exportCsv}
                disabled={!exportReady || exporting || !selectedWorkflowId}
                className="cursor-pointer rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium hover:bg-gray-50 disabled:opacity-50"
                title={
                  !selectedWorkflowId
                    ? "Select a workflow on Step 1 first"
                    : !exportReady
                    ? "Load data first (Run Interpolation)"
                    : "Download CSV"
                }
              >
                {exporting ? "Exporting…" : "Export"}
              </button>
              <div className="text-xs text-gray-500">Sticky header • Scroll horizontally</div>
            </div>
          </div>

          {err && (
            <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200">
              {err}
            </div>
          )}
          {exportErr && (
            <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-200">
              {exportErr}
            </div>
          )}

          <div className="p-3">
            <ExeTable
              frequency={frequency}
              data={data}
              caption={frequency === "monthly" ? "Monthly Data" : "Quarterly Data"}
              includeQuarterInMonthly={false}
              growthSuffix="_growth_12m"
            />
          </div>
        </div>
      </main>

      <ProcessModal
        open={open}
        onClose={() => setOpen(false)}
        heading="OVERLAY MODEL DEVELOPMENT"
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