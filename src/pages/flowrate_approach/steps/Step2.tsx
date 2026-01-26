// pages/flowrate/steps/Step4.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  Squares2X2Icon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  PlayIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

import PrincipalMatrixTable from "../../../components/asa/table/PrincipalMatrixTable";
import PrincipalMatrixDistributionTable from "../../../components/asa/table/PrincipalMatrixDistributionTable";
import FlowRateCalcTable from "../../../components/asa/table/FlowRateCalcTable";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAppSelector } from "../../../redux_toolkit/hooks";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";
import { getFlowRateDataGET, runFlowRatePOST, exportFlowRateFile } from "../../../services/flowrate";
import type { AnyRow } from "../../../components/asa/table/aging.types";

/* -------- workflow id helpers -------- */
function useWorkflowId(): number {
  const { state } = useLocation() as { state?: { workflowId?: number } };
  const [params] = useSearchParams();

  const q = Number(params.get("workflow_id"));
  if (!Number.isNaN(q) && q > 0) return q;

  if (state?.workflowId && state.workflowId > 0) return state.workflowId;

  return 0;
}

type ViewKey = "principal" | "distribution" | "flowrate";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export default function Step4() {
  const currentWfId = useAppSelector(
    (state: any) => state.pdTransitionMatrixWfHelper.currentPdTransitionMatrixWorkflowId
  );
  const currentWfData = useAppSelector(
    (state: any) => state.pdTransitionMatrixWfHelper.currentPdTransitionMatrixWorkflowData
  );

  const workflowId = currentWfId || currentWfData?.id || useWorkflowId();
  const authToken = useAppSelector((s: any) => s.auth.token);

  const [apiData, setApiData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [toasterStatus, setToasterStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [toasterMessage, setToasterMessage] = useState<string>("");

  const [view, setView] = useState<ViewKey>("principal");

  useEffect(() => {
    const wf = Number(workflowId);
    if (!wf || Number.isNaN(wf) || wf <= 0) {
      setApiData(null);
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);

    getFlowRateDataGET({ apiBase: API_BASE, token: authToken, workflowId: wf })
      .then((res) => {
        if (!mounted) return;
        setApiData(res);
        setLoading(false);
      })
      .catch(() => {
        if (!mounted) return;
        setApiData(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [workflowId, authToken]);

  const rowsForView = useMemo(() => {
    const data = apiData?.data ?? apiData;
    if (!data) return [] as AnyRow[];

    if (view === "principal") {
      const block = data?.["Flow of Loan Balance Principal Matrix"] ?? data?.rows ?? [];
      return Array.isArray(block) ? block : [];
    }

    if (view === "distribution") {
      const block = data?.["Flow of Loan Balance Principal Matrix (Distribution)"] ?? data?.rows ?? [];
      return Array.isArray(block) ? block : [];
    }

    if (view === "flowrate") {
      const block = data?.["Flow Rate Calculation"] ?? data?.rows ?? [];
      return Array.isArray(block) ? block : [];
    }

    return [] as AnyRow[];
  }, [apiData, view]);

  const handleRun = async () => {
    const wf = Number(workflowId);
    if (!wf || Number.isNaN(wf) || wf <= 0) {
      setError("Invalid workflow ID");
      return;
    }

    setRunning(true);
    setError(null);
    setToasterStatus("loading");
    setToasterMessage("Running flow rate calculation...");

    try {
      await runFlowRatePOST({ apiBase: API_BASE, token: authToken, workflowId: wf });

      const getResult = await getFlowRateDataGET({ apiBase: API_BASE, token: authToken, workflowId: wf });
      setApiData(getResult);
      console.log('getResult: ', getResult)
      setToasterStatus("success");
      setToasterMessage("Flow rate calculation completed successfully!");
    } catch (e: any) {
      const msg = e?.message || "Failed to run flow rate calculation.";
      setToasterStatus("error");
      setToasterMessage(msg);
      setError(msg);
    } finally {
      setRunning(false);
    }
  };

  const handleExport = async () => {
    const wf = Number(workflowId);
    if (!wf || Number.isNaN(wf) || wf <= 0) {
      setError("Invalid workflow ID");
      return;
    }

    setExporting(true);
    setError(null);
    setToasterStatus("loading");
    setToasterMessage("Exporting file...");

    try {
      const blob = await exportFlowRateFile({ apiBase: API_BASE, token: authToken, workflowId: wf });
      const filename = `flow_rate_output_${wf}.xlsx`;

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
      const msg = e?.message || "Failed to export file.";
      setToasterStatus("error");
      setToasterMessage(msg);
      setError(msg);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <ApiStatusIndicator status={toasterStatus} message={toasterMessage} onHide={() => setToasterStatus("idle")} />

      <div className="min-h-dvh p-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRun}
              disabled={running || !workflowId || Number(workflowId) <= 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
            >
              <PlayIcon className="h-5 w-5" />
              {running ? "Running..." : "Run"}
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || running || !apiData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              {exporting ? "Exporting..." : "Export"}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setView("principal")}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                view === "principal" ? "bg-white shadow-sm" : "hover:bg-white/60"
              }`}
            >
              <Squares2X2Icon className="h-4 w-4" />
              Principal Matrix
            </button>

            <button
              type="button"
              onClick={() => setView("distribution")}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                view === "distribution" ? "bg-white shadow-sm" : "hover:bg-white/60"
              }`}
            >
              <ChartBarIcon className="h-4 w-4" />
              Distribution
            </button>

            <button
              type="button"
              onClick={() => setView("flowrate")}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                view === "flowrate" ? "bg-white shadow-sm" : "hover:bg-white/60"
              }`}
            >
              <ArrowTrendingUpIcon className="h-4 w-4" />
              Flow Rate Calc
            </button>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700">Loading</div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>
        ) : (
          <>
            {view === "principal" && (
              <Card title="Principal Matrix">
                <PrincipalMatrixTable rows={rowsForView} height={420} />
              </Card>
            )}

            {view === "distribution" && (
              <Card title="Distribution">
                <PrincipalMatrixDistributionTable rows={rowsForView} height={420} />
              </Card>
            )}

            {view === "flowrate" && (
              <Card title="Flow Rate Calculation">
                <FlowRateCalcTable rows={rowsForView} height={420} />
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ------------------ Small Card wrapper ------------------ */
const Card: React.FC<React.PropsWithChildren<{ title: string; subtitle?: string }>> = ({
  title,
  subtitle,
  children,
}) => (
  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div className="flex items-center justify-between px-4 py-3  rounded-t-2xl bg-yellow-500">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-800 -mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

