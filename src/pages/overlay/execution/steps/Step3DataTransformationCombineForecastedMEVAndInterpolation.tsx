// src/pages/overlay/execution/steps/Step3DataTransformationCombineForecastedMEVAndInterpolation.tsx
import { useState, useEffect, useCallback } from "react";
import { useAppSelector } from "../../../../redux_toolkit/hooks";
import {
  PlayCircleIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

type Row = Record<string, any>;

export default function Step3DataTransformationCombineForecastedMEVAndInterpolation() {
  const { currentPdTransitionMatrixWorkflowId: selectedWorkflowId } =
    useAppSelector((s) => s.pdTransitionMatrixWfHelper as any);

  const token = useAppSelector((s) => (s as any)?.auth?.token) as string | null;

  const executionInputFile = useAppSelector(
    (state) => (state as any).executionInputFile?.execution_input_file,
  ) as string | null;

  const finalModelExecutionFile = useAppSelector(
    (state) =>
      (state as any).finalModelExecutionFile?.final_model_execution_file,
  ) as boolean;

  const [busy, setBusy] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [dataRows, setDataRows] = useState<Row[]>([]);
  const [dataColumns, setDataColumns] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  // Export states
  const [exporting, setExporting] = useState(false);
  const [exportErr, setExportErr] = useState<string | null>(null);
  const [exportReady, setExportReady] = useState(false);

  const overlayExecApiBase = `${API_BASE.replace(/\/+$/, "")}/api/overlay/execution`;

  // Load data on mount - if API has data, return it
  useEffect(() => {
    const loadDataOnMount = async () => {
      if ((!selectedWorkflowId && selectedWorkflowId !== 0) || !token) {
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(
          `${overlayExecApiBase}/data_transformation/combine_monthly_mev_data_interpolation_results?workflow_id=${selectedWorkflowId}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (response.ok) {
          const result = await response.json();
          if (
            result?.success &&
            result?.data &&
            Array.isArray(result.data) &&
            result.data.length > 0
          ) {
            // Extract columns from first row
            const firstRow = result.data[0];
            const cols = Object.keys(firstRow);
            setDataColumns(cols);
            setDataRows(result.data);
            setExportReady(true);
          } else {
            // No data - don't show anything
            setDataRows([]);
            setDataColumns([]);
            setExportReady(false);
          }
        } else {
          // API returned error - don't show anything
          setDataRows([]);
          setDataColumns([]);
          setExportReady(false);
        }
      } catch (err: any) {
        // Silently fail on mount
        console.error("Failed to load data on mount:", err);
        setDataRows([]);
        setDataColumns([]);
        setExportReady(false);
      } finally {
        setLoading(false);
      }
    };

    loadDataOnMount();
  }, [selectedWorkflowId, token, overlayExecApiBase]);

  // Run button handler - POST to process_combine_monthly_mev_data_interpolation
  const onRun = useCallback(async () => {
    setErrMsg(null);
    if (!selectedWorkflowId && selectedWorkflowId !== 0) {
      setErrMsg("Please select a workflow on Step 1 before running.");
      return;
    }

    setBusy(true);
    setDataRows([]);
    setDataColumns([]);
    setExportReady(false);

    try {
      const formData = new FormData();
      formData.append("workflow_id", String(selectedWorkflowId));
      formData.append(
        "execution_input_file",
        executionInputFile || "manual_upload",
      );
      formData.append(
        "final_model_execution_file",
        String(finalModelExecutionFile),
      );

      const response = await fetch(
        `${overlayExecApiBase}/data_transformation/combine_monthly_mev_data_interpolation`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.msg ||
            errorData?.detail ||
            "Failed to combine monthly MEV data interpolation",
        );
      }

      const result = await response.json();
      if (result?.success) {
        // After successful POST, fetch the results
        setLoading(true);
        try {
          const refreshResponse = await fetch(
            `${overlayExecApiBase}/data_transformation/combine_monthly_mev_data_interpolation_results?workflow_id=${selectedWorkflowId}`,
            {
              method: "GET",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            },
          );

          if (refreshResponse.ok) {
            const refreshResult = await refreshResponse.json();
            if (
              refreshResult?.success &&
              refreshResult?.data &&
              Array.isArray(refreshResult.data) &&
              refreshResult.data.length > 0
            ) {
              const firstRow = refreshResult.data[0];
              const cols = Object.keys(firstRow);
              setDataColumns(cols);
              setDataRows(refreshResult.data);
              setExportReady(true);
              setErrMsg(null);
            }
          }
        } catch (refreshErr) {
          console.error("Failed to refresh after run:", refreshErr);
        } finally {
          setLoading(false);
        }
      } else {
        setErrMsg(
          result?.msg || "Failed to combine monthly MEV data interpolation",
        );
      }
    } catch (err: any) {
      setErrMsg(
        err?.message || "Failed to run combine monthly MEV data interpolation",
      );
    } finally {
      setBusy(false);
    }
  }, [
    selectedWorkflowId,
    token,
    executionInputFile,
    finalModelExecutionFile,
    overlayExecApiBase,
  ]);

  // Refresh button handler - GET from get_combine_monthly_mev_data_interpolation_results
  const onRefresh = useCallback(async () => {
    setErrMsg(null);
    if (!selectedWorkflowId && selectedWorkflowId !== 0) {
      setErrMsg("Please select a workflow on Step 1 before refreshing.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${overlayExecApiBase}/data_transformation/combine_monthly_mev_data_interpolation_results?workflow_id=${selectedWorkflowId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (response.ok) {
        const result = await response.json();
        if (
          result?.success &&
          result?.data &&
          Array.isArray(result.data) &&
          result.data.length > 0
        ) {
          // Extract columns from first row
          const firstRow = result.data[0];
          const cols = Object.keys(firstRow);
          setDataColumns(cols);
          setDataRows(result.data);
          setExportReady(true);
          setErrMsg(null);
        } else {
          setErrMsg(result?.msg || "No data available");
          setDataRows([]);
          setDataColumns([]);
          setExportReady(false);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        setErrMsg(
          errorData?.detail || errorData?.msg || "Failed to fetch results",
        );
        setDataRows([]);
        setDataColumns([]);
        setExportReady(false);
      }
    } catch (err: any) {
      setErrMsg(err?.message || "Failed to refresh data");
      setDataRows([]);
      setDataColumns([]);
      setExportReady(false);
    } finally {
      setLoading(false);
    }
  }, [selectedWorkflowId, token, overlayExecApiBase]);

  // Export button handler - GET from export_combine_monthly_mev_data_interpolation_results
  const exportCsv = useCallback(async () => {
    if (!selectedWorkflowId && selectedWorkflowId !== 0) return;
    if (!exportReady) return;

    setExportErr(null);
    setExporting(true);

    try {
      const response = await fetch(
        `${overlayExecApiBase}/data_transformation/combine_monthly_mev_data_interpolation_results/export?workflow_id=${selectedWorkflowId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        const blob = await response.blob();
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const contentDisposition = response.headers.get("Content-Disposition");
        const filename = contentDisposition
          ? contentDisposition.split("filename=")[1]?.replace(/"/g, "") ||
            `combined_monthly_mev_data_interpolation_${selectedWorkflowId}.csv`
          : `combined_monthly_mev_data_interpolation_${selectedWorkflowId}.csv`;
        a.href = href;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(href);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setExportErr(errorData?.detail || errorData?.msg || "Export failed");
      }
    } catch (e: any) {
      console.error(e);
      setExportErr(e?.message || "Export failed");
    } finally {
      setExporting(false);
    }
  }, [selectedWorkflowId, exportReady, overlayExecApiBase, token]);

  // Enable export only when data is present
  useEffect(() => {
    const hasData = dataRows?.length > 0;
    const hasWorkflow =
      selectedWorkflowId !== null && selectedWorkflowId !== undefined;
    setExportReady(Boolean(hasWorkflow && hasData && !busy && !loading));
  }, [dataRows, busy, loading, selectedWorkflowId]);

  // Don't render anything if no data on mount
  if (!loading && dataRows.length === 0 && dataColumns.length === 0) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-gray-50 to-white">
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-lg md:text-2xl font-semibold tracking-tight text-gray-900">
                Data Transformation Combine Forecasted MEV and Interpolation
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onRun}
                disabled={
                  busy || (!selectedWorkflowId && selectedWorkflowId !== 0)
                }
                className="cursor-pointer inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-400 px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:from-yellow-300 hover:to-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200 disabled:opacity-50"
                title={!selectedWorkflowId ? "Pick a workflow on Step 1" : ""}
              >
                <PlayCircleIcon className="h-4 w-4" />
                {busy ? "Processing…" : "Run"}
              </button>

              <button
                onClick={onRefresh}
                disabled={
                  loading || (!selectedWorkflowId && selectedWorkflowId !== 0)
                }
                className="cursor-pointer inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
                title={
                  !selectedWorkflowId
                    ? "Pick a workflow on Step 1"
                    : "Refresh data"
                }
              >
                <ArrowPathIcon
                  className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                />
                {loading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto px-4 pb-8 pt-4">
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm p-6">
            {errMsg && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                {errMsg}
              </div>
            )}
            <div className="text-center text-gray-500 py-8">
              No data available. Click "Run" to generate combined monthly MEV
              data interpolation.
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className=" bg-gradient-to-b from-gray-50 to-white">
      <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-lg md:text-2xl font-semibold tracking-tight text-gray-900">
              Data Transformation Combine Forecasted MEV and Interpolation
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onRun}
              disabled={
                busy || (!selectedWorkflowId && selectedWorkflowId !== 0)
              }
              className="cursor-pointer inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-yellow-300 to-yellow-400 px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:from-yellow-300 hover:to-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-200 disabled:opacity-50"
              title={!selectedWorkflowId ? "Pick a workflow on Step 1" : ""}
            >
              <PlayCircleIcon className="h-4 w-4" />
              {busy ? "Processing…" : "Run"}
            </button>

            <button
              onClick={onRefresh}
              disabled={
                loading || (!selectedWorkflowId && selectedWorkflowId !== 0)
              }
              className="cursor-pointer inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
              title={
                !selectedWorkflowId
                  ? "Pick a workflow on Step 1"
                  : "Refresh data"
              }
            >
              <ArrowPathIcon
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              {loading ? "Loading…" : "Refresh"}
            </button>

            <button
              onClick={exportCsv}
              disabled={
                !exportReady ||
                exporting ||
                (!selectedWorkflowId && selectedWorkflowId !== 0)
              }
              className="cursor-pointer inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-200 disabled:opacity-50"
              title={
                !selectedWorkflowId
                  ? "Pick a workflow on Step 1"
                  : !exportReady
                    ? "Load data first"
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

          {dataRows.length > 0 && dataColumns.length > 0 ? (
            <div className="overflow-y-auto h-[500px] rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-yellow-200 text-gray-900 font-semibold sticky top-0 z-10">
                  <tr>
                    {dataColumns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dataRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      {dataColumns.map((col) => (
                        <td
                          key={col}
                          className="px-4 py-3 whitespace-nowrap text-sm text-gray-900"
                        >
                          {row[col] !== null && row[col] !== undefined
                            ? String(row[col])
                            : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              {loading ? "Loading data…" : "No data available"}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
