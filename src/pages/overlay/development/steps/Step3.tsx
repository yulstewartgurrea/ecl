// src/pages/overlay/development/.../OverlayDevelpmentPage3.tsx
import { useState, useEffect, useCallback } from "react";
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
  XCircleIcon,
} from "@heroicons/react/24/outline";
import {
  runDataTransformation,
  postDataTransformation,
  getDataTransformationStatus,
  getDataTransformationResults,
  cancelDataTransformation,
  shapeTransformationResults,
  type DataTransformationStatus,
} from "../../../../services/dataTransformation";

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

  // Status states
  const [status, setStatus] = useState<DataTransformationStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // ---- Core loader (POST or GET-only) ----
  const loadTransformation = useCallback(
    async (params: { skipPost: boolean }) => {
      const { skipPost } = params;
      setErrMsg(null);
      if (!selectedWorkflowId && selectedWorkflowId !== 0) {
        setErrMsg(
          "Please select a workflow on Step 1 before running the transformation."
        );
        return;
      }

      // If starting a new job (POST), clear table data immediately
      if (!skipPost) {
        setMevRows([]);
        setDefRows([]);
        setMevCols([]);
        setDefCols([]);
      }

      setBusy(true);
      try {
        // POST to start new job
        if (!skipPost) {
          await postDataTransformation({
            apiBase: API_BASE,
            token,
            workflowId: Number(selectedWorkflowId),
          });
          
          // After starting job, check status instead of fetching results
          const statusResponse = await getDataTransformationStatus({
            apiBase: API_BASE,
            token,
            workflowId: Number(selectedWorkflowId),
          });

          if (statusResponse?.success && statusResponse?.data) {
            setStatus(statusResponse.data);
            // Job will be pending/processing, so show status message
            if (statusResponse.data.status === "processing" || statusResponse.data.status === "pending") {
              setErrMsg(
                `Job is ${statusResponse.data.status}. Progress: ${statusResponse.data.progress}% - ${statusResponse.data.message || "Processing..."}`
              );
            }
          }
        } else {
          // GET-only: fetch results (this path is for refresh)
          const shaped = await runDataTransformation({
            apiBase: API_BASE,
            token,
            workflowId: Number(selectedWorkflowId),
            skipPost: true,
            includeAllIndependent: false,
          });

          setMevRows(shaped.independentRows);
          setDefRows(shaped.dependentRows);
          setMevCols(shaped.independentColumns);
          setDefCols(shaped.dependentColumns);
        }
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

  const onRun = () => loadTransformation({ skipPost: false }); // POST

  // Refresh with status check
  const onRefresh = useCallback(async () => {
    setErrMsg(null);
    if (!selectedWorkflowId && selectedWorkflowId !== 0) {
      setErrMsg(
        "Please select a workflow on Step 1 before refreshing."
      );
      return;
    }

    setStatusLoading(true);
    setBusy(true);
    try {
      // First, check the job status
      const statusResponse = await getDataTransformationStatus({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
      });

      if (statusResponse?.success && statusResponse?.data) {
        setStatus(statusResponse.data);
        
        // If job is still processing, show status but clear table data
        if (statusResponse.data.status === "processing" || statusResponse.data.status === "pending") {
          setErrMsg(
            `Job is ${statusResponse.data.status}. Progress: ${statusResponse.data.progress}% - ${statusResponse.data.message || "Processing..."}`
          );
          // Clear table data when job is not completed
          setMevRows([]);
          setDefRows([]);
          setMevCols([]);
          setDefCols([]);
          setBusy(false);
          setStatusLoading(false);
          return;
        }

        // If job failed, show error and clear table data
        if (statusResponse.data.status === "failed") {
          setErrMsg(
            `Job failed: ${statusResponse.data.error_message || statusResponse.data.message || "Unknown error"}`
          );
          // Clear table data when job is not completed
          setMevRows([]);
          setDefRows([]);
          setMevCols([]);
          setDefCols([]);
          setBusy(false);
          setStatusLoading(false);
          return;
        }

        // If job is cancelled, show message and clear table data
        if (statusResponse.data.status === "cancelled") {
          setErrMsg("Job was cancelled.");
          // Clear table data when job is not completed
          setMevRows([]);
          setDefRows([]);
          setMevCols([]);
          setDefCols([]);
          setBusy(false);
          setStatusLoading(false);
          return;
        }

        // If job is completed, fetch the results
        if (statusResponse.data.status === "completed") {
          const resultsResponse = await getDataTransformationResults({
            apiBase: API_BASE,
            token,
            workflowId: Number(selectedWorkflowId),
          });

          if (resultsResponse?.success && resultsResponse?.data) {
            const shaped = shapeTransformationResults(resultsResponse.data, {
              includeAllIndependent: false,
            });
            shaped.meta.workflowId = Number(selectedWorkflowId);

            setMevRows(shaped.independentRows);
            setDefRows(shaped.dependentRows);
            setMevCols(shaped.independentColumns);
            setDefCols(shaped.dependentColumns);
            setErrMsg(null); // Clear any previous errors
          } else {
            setErrMsg(resultsResponse?.msg || "Failed to retrieve transformation results");
          }
        }
      } else {
        // If status check fails, clear table data (only show data when status is completed)
        setErrMsg(statusResponse?.msg || "Failed to check job status");
        setMevRows([]);
        setDefRows([]);
        setMevCols([]);
        setDefCols([]);
      }
    } catch (err: any) {
      setErrMsg(err?.message || "Failed to refresh data transformation");
      setMevRows([]);
      setDefRows([]);
      setMevCols([]);
      setDefCols([]);
    } finally {
      setBusy(false);
      setStatusLoading(false);
    }
  }, [API_BASE, token, selectedWorkflowId]);

  // Cancel data transformation
  const onCancel = useCallback(async () => {
    if (!selectedWorkflowId && selectedWorkflowId !== 0) {
      setErrMsg("Please select a workflow on Step 1 before cancelling.");
      return;
    }

    setCancelling(true);
    setErrMsg(null);
    try {
      const cancelResponse = await cancelDataTransformation({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
      });

      if (cancelResponse?.success) {
        setErrMsg("Job cancellation requested. The process will stop at the next checkpoint.");
        // Refresh status to update UI
        await onRefresh();
      } else {
        setErrMsg(cancelResponse?.msg || "Failed to cancel data transformation");
      }
    } catch (err: any) {
      setErrMsg(err?.message || "Failed to cancel data transformation");
    } finally {
      setCancelling(false);
    }
  }, [API_BASE, token, selectedWorkflowId, onRefresh]);

  // ---- Enable export ONLY after GET data is present ----
  useEffect(() => {
    const hasData =
      (mevRows?.length ?? 0) > 0 || (defRows?.length ?? 0) > 0;
    const hasWorkflow =
      selectedWorkflowId !== null && selectedWorkflowId !== undefined;
    setExportReady(Boolean(hasWorkflow && hasData && !busy));
  }, [mevRows, defRows, busy, selectedWorkflowId]);

  // ---- Load data and check status on page load ----
  useEffect(() => {
    const loadDataOnMount = async () => {
      // Only run if we have a workflow selected and token
      if ((!selectedWorkflowId && selectedWorkflowId !== 0) || !token) {
        return;
      }

      setStatusLoading(true);
      setBusy(true);
      try {
        // First, check the job status
        const statusResponse = await getDataTransformationStatus({
          apiBase: API_BASE,
          token,
          workflowId: Number(selectedWorkflowId),
        });

        if (statusResponse?.success && statusResponse?.data) {
          setStatus(statusResponse.data);
          
          // If job is still processing, show status but clear table data
          if (statusResponse.data.status === "processing" || statusResponse.data.status === "pending") {
            setErrMsg(
              `Job is ${statusResponse.data.status}. Progress: ${statusResponse.data.progress}% - ${statusResponse.data.message || "Processing..."}`
            );
            // Clear table data when job is not completed
            setMevRows([]);
            setDefRows([]);
            setMevCols([]);
            setDefCols([]);
            setBusy(false);
            setStatusLoading(false);
            return;
          }

          // If job failed, show error and clear table data
          if (statusResponse.data.status === "failed") {
            setErrMsg(
              `Job failed: ${statusResponse.data.error_message || statusResponse.data.message || "Unknown error"}`
            );
            // Clear table data when job is not completed
            setMevRows([]);
            setDefRows([]);
            setMevCols([]);
            setDefCols([]);
            setBusy(false);
            setStatusLoading(false);
            return;
          }

          // If job is cancelled, show message and clear table data
          if (statusResponse.data.status === "cancelled") {
            setErrMsg("Job was cancelled.");
            // Clear table data when job is not completed
            setMevRows([]);
            setDefRows([]);
            setMevCols([]);
            setDefCols([]);
            setBusy(false);
            setStatusLoading(false);
            return;
          }

          // If job is completed, fetch the results
          if (statusResponse.data.status === "completed") {
            const resultsResponse = await getDataTransformationResults({
              apiBase: API_BASE,
              token,
              workflowId: Number(selectedWorkflowId),
            });

            if (resultsResponse?.success && resultsResponse?.data) {
              const shaped = shapeTransformationResults(resultsResponse.data, {
                includeAllIndependent: false,
              });
              shaped.meta.workflowId = Number(selectedWorkflowId);

              setMevRows(shaped.independentRows);
              setDefRows(shaped.dependentRows);
              setMevCols(shaped.independentColumns);
              setDefCols(shaped.dependentColumns);
              setErrMsg(null); // Clear any previous errors
            } else {
              setErrMsg(resultsResponse?.msg || "Failed to retrieve transformation results");
            }
          }
        } else {
          // If status check fails, clear table data (only show data when status is completed)
          setMevRows([]);
          setDefRows([]);
          setMevCols([]);
          setDefCols([]);
          // Don't set error on mount - silently fail
        }
      } catch (err: any) {
        // Silently fail on mount - user can manually refresh if needed
        console.error("Failed to load data on mount:", err);
      } finally {
        setBusy(false);
        setStatusLoading(false);
      }
    };

    loadDataOnMount();
  }, [selectedWorkflowId, token, API_BASE]);

  // ---- Export CSV handler (client-side, from current table state) ----
  const exportCsv = useCallback(() => {
    if (!selectedWorkflowId && selectedWorkflowId !== 0) return;
    if (!exportReady) return;

    setExportErr(null);
    setExporting(true);

    try {
      // Build column definitions (leaf columns) from ColumnNode[]
      const mevLeafCols = flattenColumnNodes(mevCols);
      const defLeafCols = flattenColumnNodes(defCols);

      // Fallback: if no column defs, derive from row keys
      const buildColsFromRows = (rows: Row[]) => {
        const first = rows[0] ?? {};
        return Object.keys(first).map((key) => ({
          header: key,
          accessor: key,
        }));
      };

      const finalMevCols =
        mevLeafCols.length === 0 && mevRows.length > 0
          ? buildColsFromRows(mevRows)
          : mevLeafCols;
      const finalDefCols =
        defLeafCols.length === 0 && defRows.length > 0
          ? buildColsFromRows(defRows)
          : defLeafCols;

      const sections: string[] = [];

      if (mevRows.length && finalMevCols.length) {
        sections.push(
          buildCsvSection("MEV Data", finalMevCols, mevRows)
        );
      }

      if (defRows.length && finalDefCols.length) {
        sections.push(
          buildCsvSection("Default Rate Data", finalDefCols, defRows)
        );
      }

      if (sections.length === 0) {
        throw new Error("No table data to export.");
      }

      const csvContent = sections.join("\n\n");
      const blob = new Blob([csvContent], {
        type: "text/csv;charset=utf-8;",
      });

      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const filename = `data_transformation_results_${selectedWorkflowId}.csv`;
      a.href = href;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);
    } catch (e: any) {
      console.error(e);
      setExportErr(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }, [
    selectedWorkflowId,
    exportReady,
    mevCols,
    defCols,
    mevRows,
    defRows,
  ]);

  const caption =
    view === "consolidated" ? "Consolidated monthly MEVs" : undefined;

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
            {/* Run (POST) */}
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

            {/* Refresh (with status check) */}
            <button
              onClick={onRefresh}
              disabled={
                statusLoading ||
                (!selectedWorkflowId && selectedWorkflowId !== 0)
              }
              className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
              title={
                !selectedWorkflowId
                  ? "Pick a workflow on Step 1"
                  : "Check status and fetch latest results"
              }
            >
              <ArrowPathIcon
                className={`h-4 w-4 ${statusLoading ? "animate-spin" : ""}`}
              />
              {statusLoading ? "Checking…" : "Refresh"}
            </button>

            {/* Cancel (only show when job is pending or processing) */}
            {status && (status.status === "pending" || status.status === "processing") && (
              <button
                onClick={onCancel}
                disabled={
                  cancelling ||
                  (!selectedWorkflowId && selectedWorkflowId !== 0)
                }
                className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
                title={
                  !selectedWorkflowId
                    ? "Pick a workflow on Step 1"
                    : "Cancel the running data transformation job"
                }
              >
                <XCircleIcon
                  className={`h-4 w-4 ${cancelling ? "animate-spin" : ""}`}
                />
                {cancelling ? "Cancelling…" : "Cancel"}
              </button>
            )}

            {/* Export CSV – now pure frontend */}
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
          {status && (status.status === "processing" || status.status === "pending") && (
            <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="text-sm font-medium text-blue-900">
                    Job Status: {status.status.charAt(0).toUpperCase() + status.status.slice(1)}
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    {status.message || "Processing..."}
                  </div>
                  {status.progress !== null && status.progress !== undefined && (
                    <div className="mt-2">
                      <div className="w-full bg-blue-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${status.progress}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-blue-600 mt-1">
                        {status.progress}% complete
                      </div>
                    </div>
                  )}
                  {status.running_time_seconds !== null && (
                    <div className="text-xs text-blue-600 mt-1">
                      Running time: {Math.floor(status.running_time_seconds / 60)}m {status.running_time_seconds % 60}s
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {status && status.status === "completed" && (
            <div className="mb-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
              ✓ Job completed successfully
              {status.running_time_seconds !== null && (
                <span className="ml-2 text-xs">
                  (Completed in {Math.floor(status.running_time_seconds / 60)}m {status.running_time_seconds % 60}s)
                </span>
              )}
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

/* ----------------- Helpers for CSV export ----------------- */

// Try to mirror the visible columns by flattening ColumnNode tree into leaf columns
function flattenColumnNodes(cols: ColumnNode[]): { header: string; accessor: string }[] {
  const out: { header: string; accessor: string }[] = [];

  const visit = (col: any) => {
    if (!col) return;

    if (Array.isArray(col.children) && col.children.length > 0) {
      col.children.forEach(visit);
      return;
    }

    // Try common access key names used in column configs
    const accessor =
      col.accessorKey ||
      col.key ||
      col.id ||
      col.field ||
      col.columnKey ||
      col.dataIndex;

    if (!accessor) return;

    const header =
      col.header ||
      col.title ||
      col.label ||
      col.name ||
      accessor;

    out.push({
      header: String(header),
      accessor: String(accessor),
    });
  };

  (cols || []).forEach(visit);
  return out;
}

function escapeCsvValue(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildCsvSection(
  title: string,
  cols: { header: string; accessor: string }[],
  rows: Row[]
): string {
  const lines: string[] = [];

  // Section title
  lines.push(`# ${title}`);

  // Header row
  lines.push(cols.map((c) => escapeCsvValue(c.header)).join(","));

  // Data rows
  for (const row of rows) {
    const line = cols
      .map((c) => escapeCsvValue(row[c.accessor]))
      .join(",");
    lines.push(line);
  }

  return lines.join("\n");
}
