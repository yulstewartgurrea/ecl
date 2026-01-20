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
  Cog6ToothIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import ScenarioConfigModalTable, {
  type ScenarioRow,
} from "../../../../components/overlay/execution/mev/ConfigModal";
import {
  postDataTransformationExecution,
  getDataTransformationStatusExecution,
  getDataTransformationResultsExecution,
  cancelDataTransformationExecution,
  exportDataTransformationExecution,
  shapeTransformationResults,
  type DataTransformationStatus,
} from "../../../../services/dataTransformation";
import {
  overrideGetForcasted,
  overrideGetInput,
  overridePostForecastedMevs,
} from "../../../../services/overlayExecution";

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

  const executionInputFile = useAppSelector(
    (state) => (state as any).executionInputFile?.execution_input_file
  ) as string | null;

  const finalModelExecutionFile = useAppSelector(
    (state) => (state as any).finalModelExecutionFile?.final_model_execution_file
  ) as boolean;
  
  const historicalWeightedCreditLossRateFile = useAppSelector(
    (state) => (state as any).historicalWeightedCreditLossRateFile?.historical_weighted_credit_loss_rate_file
  ) as boolean;

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

  // Configuration states
  const [showConfig, setShowConfig] = useState(false);
  const [numCombinations, setNumCombinations] = useState<number>(2);
  const [mevConfigOpen, setMevConfigOpen] = useState(false);
  const [mevPeriods, setMevPeriods] = useState<string[]>([]);
  const [mevVariables, setMevVariables] = useState<string[]>([]);
  const [mevPrefillRows, setMevPrefillRows] = useState<ScenarioRow[] | null>(null);
  const [mevLoadingCfg, setMevLoadingCfg] = useState(false);

  const normalizePeriodOut = (p: string) => {
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(p)) {
      const [mm, dd, yyyy] = p.split("/");
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
    return p;
  };

  // Load MEV config shape (periods/variables)
  useEffect(() => {
    const boot = async () => {
      if (!selectedWorkflowId) return;
      setMevLoadingCfg(true);
      try {
        const { periods, variables } = await overrideGetInput(
          selectedWorkflowId,
          token
        );
        setMevPeriods(periods);
        const cached = localStorage.getItem("overlay_execution_mev_variables");
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) {
              setMevVariables(parsed);
            } else {
              setMevVariables(variables);
            }
          } catch {
            setMevVariables(variables);
          }
        } else {
          setMevVariables(variables);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setMevLoadingCfg(false);
      }
    };
    boot();
  }, [selectedWorkflowId, token]);

  // Prefill MEV override rows (if any)
  useEffect(() => {
    const boot = async () => {
      if (!selectedWorkflowId) return;
      try {
        const { rows } = await overrideGetForcasted(selectedWorkflowId, token);
        setMevPrefillRows(rows ?? null);
      } catch (err) {
        console.error(err);
      }
    };
    boot();
  }, [selectedWorkflowId, token]);

  const handleOpenMevConfig = () => {
    if (!selectedWorkflowId && selectedWorkflowId !== 0) return;
    if (!mevPeriods.length || !mevVariables.length) {
      alert("No periods/variables returned by the server.");
      return;
    }
    setMevConfigOpen(true);
  };


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
          await postDataTransformationExecution({
            apiBase: API_BASE,
            token,
            workflowId: Number(selectedWorkflowId),
            numCombinations: numCombinations,
            executionInputFile: executionInputFile,
            finalModelExecutionFile: finalModelExecutionFile,
            historicalWeightedCreditLossRateFile: historicalWeightedCreditLossRateFile,
          });
          
          // After starting job, check status instead of fetching results
          const statusResponse = await getDataTransformationStatusExecution({
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
          const resultsResponse = await getDataTransformationResultsExecution({
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
          } else {
            setErrMsg(resultsResponse?.msg || "Failed to retrieve transformation results");
          }
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
    [API_BASE, token, selectedWorkflowId, numCombinations, executionInputFile]
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
      const statusResponse = await getDataTransformationStatusExecution({
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
          const resultsResponse = await getDataTransformationResultsExecution({
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
      const cancelResponse = await cancelDataTransformationExecution({
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
        const statusResponse = await getDataTransformationStatusExecution({
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
            const resultsResponse = await getDataTransformationResultsExecution({
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

  // ---- Export handler (server-side export) ----
  const exportCsv = useCallback(async () => {
    if (!selectedWorkflowId && selectedWorkflowId !== 0) return;
    if (!exportReady) return;

    setExportErr(null);
    setExporting(true);

    try {
      const blob = await exportDataTransformationExecution({
        apiBase: API_BASE,
        token,
        workflowId: Number(selectedWorkflowId),
        fileType: "both",
      });

      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const filename = `data_transformation_results_${selectedWorkflowId}.zip`;
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
    API_BASE,
    token,
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
            {/* MEV Configuration Button */}
            <button
              onClick={handleOpenMevConfig}
              disabled={mevLoadingCfg || (!selectedWorkflowId && selectedWorkflowId !== 0)}
              className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
              title="Configure MEV overrides"
            >
              <Cog6ToothIcon className="h-4 w-4" />
              MEV Config
            </button>

            {/* Configuration Button */}
            <button
              onClick={() => setShowConfig(true)}
              disabled={busy || (!selectedWorkflowId && selectedWorkflowId !== 0)}
              className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 disabled:opacity-50"
              title="Configure data transformation settings"
            >
              <Cog6ToothIcon className="h-4 w-4" />
              Config
            </button>

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

      {/* Configuration Modal */}
      {showConfig && (
        <div className="fixed inset-0 z-50">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowConfig(false)} />
          
          {/* Dialog */}
          <div className="absolute left-1/2 top-1/2 w-[min(100vw-2rem,500px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white shadow-2xl ring-1 ring-black/5 max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b p-4">
              <div>
                <h3 className="text-lg font-semibold">Configuration</h3>
                <p className="text-xs text-neutral-600">
                  Configure the number of combinations for data transformation.
                </p>
              </div>
              <button
                onClick={() => setShowConfig(false)}
                className="rounded-md p-2 hover:bg-neutral-100"
                title="Close"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            
            {/* Body */}
            <div className="flex-1 overflow-auto p-4">
              <div className="space-y-4">
                <div>
                  <label htmlFor="numCombinations" className="block text-sm font-medium text-gray-700 mb-2">
                    Number of combinations
                  </label>
                  <input
                    id="numCombinations"
                    type="number"
                    min="1"
                    step="1"
                    value={numCombinations}
                    onChange={(e) => {
                      const value = e.target.value;
                      // Only allow positive integers
                      if (value === "" || (Number.isInteger(Number(value)) && Number(value) > 0)) {
                        setNumCombinations(value === "" ? 2 : Number(value));
                      }
                    }}
                    onKeyDown={(e) => {
                      // Prevent decimal point, negative sign, and 'e' key
                      if (e.key === '.' || e.key === '-' || e.key === 'e' || e.key === 'E') {
                        e.preventDefault();
                      }
                    }}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    placeholder="Enter number of combinations"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Must be a positive integer (default: 2)
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t p-4">
              <button
                onClick={() => setShowConfig(false)}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm hover:bg-neutral-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (numCombinations > 0 && Number.isInteger(numCombinations)) {
                    setShowConfig(false);
                  }
                }}
                disabled={!Number.isInteger(numCombinations) || numCombinations <= 0}
                className="rounded-md bg-yellow-500 px-4 py-2 text-sm font-medium text-white hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <ScenarioConfigModalTable
        open={mevConfigOpen}
        onClose={() => setMevConfigOpen(false)}
        periods={mevPeriods}
        variables={mevVariables}
        initialRows={mevPrefillRows ?? undefined}
        onSave={async (rows, nextVariables) => {
          const payload = rows.map((r) => ({
            period: normalizePeriodOut(r.period),
            upside: r.upside,
            base: r.base,
            downside: r.downside,
          }));

          if (!selectedWorkflowId) return;

          try {
            await overridePostForecastedMevs(selectedWorkflowId, payload, token);
            setMevVariables(nextVariables);
            localStorage.setItem(
              "overlay_execution_mev_variables",
              JSON.stringify(nextVariables)
            );
            setMevConfigOpen(false);

            const { rows: latest } = await overrideGetForcasted(
              selectedWorkflowId,
              token
            );
            setMevPrefillRows(latest ?? null);
          } catch (err) {
            console.error(err);
          }
        }}
      />

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

