// src/pages/overlay/development/.../OverlayDevelpmentPage3.tsx
import { useState, useRef, useEffect, useCallback } from "react";
import ExeTable from "../../../../components/overlay/development/data_transformation/table/ExeTable";
import type {
  Frequency,
  ViewMode,
} from "../../../../components/overlay/development/data_transformation/table/columns";
import type { ColumnNode } from "../../../../components/overlay/development/data_transformation/table/MacroTable";
import { useAppSelector } from "../../../../redux_toolkit/hooks";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import {
  PlayCircleIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";
import {
  runDataTransformation,
  type ApiEnvelope,
  type DataTransformationResults,
} from "../../../../services/dataTransformation";

// 👉 Add this import (adjust relative path if needed)
import { PollIsendNotifier } from "../../../../components/PollIsendNotifier";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

type Row = Record<string, any>;

export default function OverlayDevelpmentPage3() {
  const [frequency] = useState<Frequency>("monthly");
  const [view] = useState<ViewMode>("transformations");

  const { currentPdTransitionMatrixWorkflowId: selectedWorkflowId } =
    useSelector(
      (s: RootState) => (s.pdTransitionMatrixWfHelper as any)
    );

  const token = useAppSelector(
    (s) => (s as any)?.auth?.token
  ) as string | null;

  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const [mevRows, setMevRows] = useState<Row[]>([]);
  const [defRows, setDefRows] = useState<Row[]>([]);
  const [mevCols, setMevCols] = useState<ColumnNode[]>([]);
  const [defCols, setDefCols] = useState<ColumnNode[]>([]);

  // Export states
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exportReady, setExportReady] = useState(false); // enabled after GET success

  const abortRef = useRef<AbortController | null>(null);

  // ---- Core loader (POST+poll or GET-only) ----
  const loadTransformation = useCallback(
    async (params: { poll: boolean; skipPost: boolean }) => {
      const { poll, skipPost } = params;
      setErrMsg(null);
      if (!selectedWorkflowId && selectedWorkflowId !== 0) {
        setErrMsg(
          "Please select a workflow on Step 1 before running the transformation."
        );
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setBusy(true);
      try {
        const shaped = await runDataTransformation({
          apiBase: API_BASE,
          token,
          workflowId: Number(selectedWorkflowId),
          poll, // controls poll vs single GET
          skipPost, // explicit
          includeAllIndependent: false,
          signal: abortRef.current.signal,
        });

        setMevRows(shaped.independentRows);
        setDefRows(shaped.dependentRows);
        setMevCols(shaped.independentColumns);
        setDefCols(shaped.dependentColumns);
      } catch (err: any) {
        setErrMsg(err?.message || "Failed to run data transformation");
        setMevRows([]);
        setDefRows([]);
        setMevCols([]);
        setDefCols([]);
      } finally {
        setBusy(false);
      }
    },
    [API_BASE, token, selectedWorkflowId]
  );

  const onRun = () => loadTransformation({ poll: true, skipPost: false }); // POST + poll
  const onRefresh = () => loadTransformation({ poll: false, skipPost: true }); // GET-only

  // ---- Enable export ONLY after GET data is present ----
  useEffect(() => {
    const hasData =
      (mevRows?.length ?? 0) > 0 || (defRows?.length ?? 0) > 0;
    const hasWorkflow =
      selectedWorkflowId !== null && selectedWorkflowId !== undefined;
    setExportReady(Boolean(hasWorkflow && hasData && !busy));
  }, [mevRows, defRows, busy, selectedWorkflowId]);

  // ---- Export CSV handler ----
  // Endpoint: /api/overlay/development/data_transformation_results/export/?workflow_id=<id>
  const exportCsv = useCallback(async () => {
    if (!selectedWorkflowId && selectedWorkflowId !== 0) return;

    setExportErr(null);
    setExporting(true);
    try {
      const url = `${API_BASE}/api/overlay/development/data_transformation_results/export/?workflow_id=${encodeURIComponent(
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
          if (t) msg = `${msg} – ${t}`;
        } catch {}
        throw new Error(msg);
      }

      const blob = await res.blob();

      // Attempt to derive filename from Content-Disposition
      const cd = res.headers.get("content-disposition") || "";
      const match =
        cd.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i) ||
        cd.match(/filename=["']?([^"']+)["']?/i);
      const fallback = `data_transformation_results_${selectedWorkflowId}.csv`;
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

  const caption =
    view === "consolidated" ? "Consolidated monthly MEVs" : undefined;

  // ---- GET-only status URL for the polling notifier ----
  const statusUrl =
    selectedWorkflowId || selectedWorkflowId === 0
      ? `${API_BASE}/api/overlay/development/data_transformation_results?workflow_id=${encodeURIComponent(
          String(selectedWorkflowId)
        )}`
      : "";

  return (
    <div className="min-h-dvh bg-gradient-to-b from-gray-50 to-white">
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white border-b">
        <div className="mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Consolidate all monthly MEVs
            </h1>
            <p className="text-sm text-gray-600">
              Apply lag/log/diff transformations to MEVs and take log of default
              rate data
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Run (POST + internal poll) */}
            <button
              onClick={onRun}
              disabled={
                busy ||
                (!selectedWorkflowId && selectedWorkflowId !== 0)
              }
              className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 disabled:opacity-50"
              title={
                !selectedWorkflowId
                  ? "Pick a workflow on Step 1"
                  : ""
              }
            >
              <PlayCircleIcon className="h-4 w-4" />
              {busy ? "Processing…" : "Run Data Transform"}
            </button>

            {/* Refresh (GET-only) */}
            <button
              onClick={onRefresh}
              disabled={
                busy ||
                (!selectedWorkflowId && selectedWorkflowId !== 0)
              }
              className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
              title={
                !selectedWorkflowId
                  ? "Pick a workflow on Step 1"
                  : "Fetch latest results once"
              }
            >
              <ArrowPathIcon
                className={`h-4 w-4 ${busy ? "animate-spin" : ""}`}
              />
              {busy ? "Refreshing…" : "Refresh"}
            </button>

            {/* Export CSV */}
            <button
              onClick={exportCsv}
              disabled={
                !exportReady ||
                exporting ||
                (!selectedWorkflowId && selectedWorkflowId !== 0)
              }
              className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
              title={
                !selectedWorkflowId
                  ? "Pick a workflow on Step 1"
                  : !exportReady
                  ? "Load data first (Run or Refresh)"
                  : "Download CSV"
              }
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              {exporting ? "Exporting…" : "Export CSV"}
            </button>

            {/* Auto-checker (GET-only, every 10 mins) */}
            {(selectedWorkflowId || selectedWorkflowId === 0) && (
              <PollIsendNotifier<ApiEnvelope<DataTransformationResults>>
                url={statusUrl}
                everyMinutes={10}
                requestInit={{
                  headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    Accept: "application/json",
                  },
                }}
                // Consider it done when backend marks success and any rows exist.
                parseDone={(env) =>
                  Boolean(
                    env?.success &&
                      ((env?.data?.independent_data?.length ?? 0) > 0 ||
                        (env?.data?.dependent_data?.length ?? 0) > 0)
                  )
                }
                // When done, immediately load the data into the table.
                onDone={() => onRefresh()}
              />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 pb-8">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-3">
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

          <ExeTable
            frequency={frequency}
            view="transformations"
            data={[]} // not used in this view
            mevData={mevRows}
            defaultData={defRows}
            mevColumns={mevCols}
            defaultColumns={defCols}
            caption={caption}
          />
        </div>
      </main>
    </div>
  );
}