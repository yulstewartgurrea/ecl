// ==========================
// pages/flowrate/steps/Step5.tsx (API-DRIVEN)
// ==========================
import React, { useEffect, useState } from "react";
import { PlayIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import CreditLossRateMatrix, {
  type AgingCategory,
  type MonthRow,
  type RatesColumnSet,
  type DistributionBy,
} from "../../../components/asa/credit/CreditLossRateMatrix";
import { useAsaApi } from "../../../lib/asaApi";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAppSelector } from "../../../redux_toolkit/hooks";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";
import { useDispatch } from "react-redux";
import { setStep5Bundle } from "../../../redux_toolkit/features/asa/flowrateStep5Slice";
import {
  CATS,
  coerceRowsFromStep5,
  coerceRateSets,
  coerceDistribution,
} from "../../../lib/flowrateCoercers";

/* -------- workflow id helpers (URL ?workflow_id=, route state, or localStorage) -------- */
function useWorkflowId(): number {
  const { state } = useLocation() as { state?: { workflowId?: number } };
  const [params] = useSearchParams();

  const q = Number(params.get("workflow_id"));
  if (!Number.isNaN(q) && q > 0) return q;

  if (state?.workflowId && state.workflowId > 0) return state.workflowId;

  const ls = Number(localStorage.getItem("current_workflow_id") || "");
  if (!Number.isNaN(ls) && ls > 0) return ls;

  return 1; // sensible dev fallback
}

/* ---------------- page ---------------- */
const Step5: React.FC = () => {
  const dispatch = useDispatch();
  // Get workflow ID from Redux (fallback to URL/localStorage helper)
  const currentPdTransitionMatrixWorkflowId = useAppSelector(
    (state: any) => state.pdTransitionMatrixWfHelper.currentPdTransitionMatrixWorkflowId
  );
  const workflowId = currentPdTransitionMatrixWorkflowId || useWorkflowId();
  const authToken = useAppSelector((s) => s.auth.token);
  const { getStep5Data, getStep3Data } = useAsaApi();

  const [categories, setCategories] = useState<AgingCategory[] | undefined>(undefined);
  const [rows, setRows] = useState<MonthRow[] | undefined>(undefined);
  const [rateSets, setRateSets] = useState<RatesColumnSet[] | undefined>(undefined);
  const [distribution, setDistribution] = useState<DistributionBy | undefined>(undefined);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toasterStatus, setToasterStatus] =
    useState<"idle" | "loading" | "success" | "error">("idle");
  const [toasterMessage, setToasterMessage] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.allSettled([getStep5Data(workflowId), getStep3Data(workflowId)])
      .then(([s5, s3]) => {
        if (!mounted) return;

        const step5 = s5.status === "fulfilled" ? s5.value : undefined;
        const step3 = s3.status === "fulfilled" ? s3.value : undefined;

        // Check if data exists in the response
        const data = step5?.data;
        const hasData =
          data &&
          ((Array.isArray(data) && data.length > 0) ||
            (typeof data === "object" &&
              (data.flow_rate_calculation || data["flow_rate_calculation"])));

        if (hasData) {
          const r = step5 ? coerceRowsFromStep5(step5) : [];
          const rs = coerceRateSets(step5, r);
          const dist = coerceDistribution(step5, step3);

          setCategories(CATS);
          setRows(r.length ? r : undefined);
          setRateSets(rs.length ? rs : undefined);
          setDistribution(dist);

          // 🔐 cache for Step6
          dispatch(
            setStep5Bundle({
              workflowId,
              rows: r,
              rateSets: rs,
              distribution: dist,
              fetchedAt: new Date().toISOString(),
            })
          );
        } else {
          // No data exists, don't set defaults
          setCategories(undefined);
          setRows(undefined);
          setRateSets(undefined);
          setDistribution(undefined);
        }
      })
      .catch(() => {
        if (!mounted) return;
        // Silent: no existing data
        setCategories(undefined);
        setRows(undefined);
        setRateSets(undefined);
        setDistribution(undefined);
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [workflowId, getStep5Data, getStep3Data, dispatch]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setToasterStatus("loading");
    setToasterMessage("Running credit loss calculation...");

    try {
      const formData = new FormData();
      formData.append("workflow_id", String(workflowId));

      const headers: Record<string, string> = {};
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

      const response = await fetch(
        `http://localhost:8000/api/flowrate_approach/credit_loss_calculation/`,
        {
          method: "POST",
          headers,
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();

      // If successful, fetch the updated data using the API helper
      if (result.success || result.code === 1) {
        const getResult = await getStep5Data(workflowId);
        const step3Result = await getStep3Data(workflowId);

        const r = getResult ? coerceRowsFromStep5(getResult) : [];
        const rs = coerceRateSets(getResult, r);
        const dist = coerceDistribution(getResult, step3Result);

        setCategories(CATS);
        setRows(r.length ? r : undefined);
        setRateSets(rs.length ? rs : undefined);
        setDistribution(dist);

        // cache for Step6
        dispatch(
          setStep5Bundle({
            workflowId,
            rows: r,
            rateSets: rs,
            distribution: dist,
            fetchedAt: new Date().toISOString(),
          })
        );

        setToasterStatus("success");
        setToasterMessage("Credit loss calculation completed successfully!");
      } else {
        const errorMsg = result.msg || "Credit loss calculation failed.";
        setToasterStatus("error");
        setToasterMessage(errorMsg);
        setError(errorMsg);
      }
    } catch (e: any) {
      const errorMsg = e?.message || "Failed to run credit loss calculation.";
      setToasterStatus("error");
      setToasterMessage(errorMsg);
      setError(errorMsg);
    } finally {
      setRunning(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    setToasterStatus("loading");
    setToasterMessage("Exporting file...");

    try {
      const headers: Record<string, string> = {};
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

      const response = await fetch(
        `http://localhost:8000/api/flowrate_approach/credit_loss_calculation/export?workflow_id=${workflowId}`,
        {
          method: "GET",
          headers,
        }
      );

      if (!response.ok) {
        let errorMsg = `API error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.msg || errorMsg;
        } catch {
          /* ignore */
        }
        throw new Error(errorMsg);
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "credit_loss_calculation_output.xlsx";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match) filename = match[1];
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setToasterStatus("success");
      setToasterMessage("File exported successfully!");
    } catch (e: any) {
      const errorMsg = e?.message || "Failed to export file.";
      setToasterStatus("error");
      setToasterMessage(errorMsg);
      setError(errorMsg);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh p-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700">
          Loading…
        </div>
      </div>
    );
  }

  return (
    <>
      <ApiStatusIndicator
        status={toasterStatus}
        message={toasterMessage}
        onHide={() => setToasterStatus("idle")}
      />

      <div className="min-h-dvh p-6 space-y-6">
        {/* Top heading + Run/Export */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Credit Loss Rate
            </h2>
            <p className="text-xs text-gray-700">
              Explore credit loss rate calculations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
            >
              <PlayIcon className="h-5 w-5" />
              {running ? "Running..." : "Run"}
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || running || !rows}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              {exporting ? "Exporting..." : "Export"}
            </button>
          </div>
        </div>

        {/* Matrix */}
        <CreditLossRateMatrix
          categories={categories}
          rows={rows}
          historicalRateSets={rateSets}
          distribution={distribution}
          showNotes
        />
      </div>
    </>
  );
};

export default Step5;
