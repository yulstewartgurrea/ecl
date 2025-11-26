// ==========================
// pages/flowrate/steps/Step4.tsx (API-DRIVEN, FIXED FLOWRATE VIEW)
// ==========================
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
import type { AgingRow } from "../../../components/asa/table/aging.types";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAppSelector } from "../../../redux_toolkit/hooks";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";
import {
  getFlowRateDataGET,
  runFlowRatePOST,
  exportFlowRateFile,
} from "../../../services/flowrate";

/* -------- workflow id helpers (URL ?workflow_id=, route state, or localStorage) -------- */
function useWorkflowId(): number {
  const { state } = useLocation() as { state?: { workflowId?: number } };
  const [params] = useSearchParams();

  const q = Number(params.get("workflow_id"));
  console.log("Step4 - URL workflow_id:", q);

  if (!Number.isNaN(q) && q > 0) {
    console.log("Step4 - Using URL workflow_id:", q);
    return q;
  }

  console.log("Step4 - Route state workflowId:", state?.workflowId);
  if (state?.workflowId && state.workflowId > 0) {
    console.log("Step4 - Using state workflowId:", state.workflowId);
    return state.workflowId;
  }

  const ls = Number(localStorage.getItem("current_workflow_id") || "");
  console.log("Step4 - LocalStorage workflow_id:", ls);

  if (!Number.isNaN(ls) && ls > 0) {
    console.log("Step4 - Using localStorage workflow_id:", ls);
    return ls;
  }

  console.log("Step4 - No valid workflow_id found, falling back to default: 0");
  return 0;
}

/* ---------- helpers (same style as Step 3) ---------- */
const clean = (s: string) => s?.toLowerCase().replace(/\s+/g, "") ?? "";

function pick(o: any, candidates: string[]) {
  for (const k of candidates) {
    if (o && Object.prototype.hasOwnProperty.call(o, k)) return o[k];
    const found = Object.keys(o || {}).find((kk) => clean(kk) === clean(k));
    if (found) return o[found];
  }
  return undefined;
}

/** Accept numbers with commas, and treat "-", "", null, "#N/A" as missing. */
function numOrNA(v: any): number | "#N/A" {
  if (
    v === "" ||
    v == null ||
    String(v).trim() === "-" ||
    String(v).toUpperCase() === "#N/A"
  ) {
    return "#N/A";
  }
  const s = String(v).replace(/,/g, "").trim();
  const n = Number(s);
  return Number.isFinite(n) ? n : "#N/A";
}

/** Coerce backend data -> AgingRow[] used by principal + distribution tables */
function coercePrincipalMatrix(payload: any, view: ViewKey): AgingRow[] {
  const data = payload?.data ?? payload;

  // Get the correct block based on view
  let block: any[] = [];
  if (view === "principal") {
    block = data?.["Flow of Loan Balance Principal Matrix"] ?? data?.rows ?? [];
  } else if (view === "distribution") {
    block =
      data?.["Flow of Loan Balance Principal Matrix (Distribution)"] ??
      data?.rows ??
      [];
  } else {
    // for safety; real flowrate handled separately
    block = data?.rows ?? [];
  }

  const arr: any[] = Array.isArray(block) ? block : [];

  const out: AgingRow[] = arr.map((r) => {
    const product = (pick(r, ["Product", "product"]) ?? "").toString();
    const date = (pick(r, ["Date", "date"]) ?? "").toString();

    const tlb = pick(r, [
      "Total Loan Balance with C/P",
      "Total Loan Balance with CP",
      "Loan Balance w/ CP",
      "total loan balance with c/p",
      "total_loan_balance_with_cp",
    ]);

    const d0 = pick(r, ["0 day", "0 Day", "d0"]);
    const par1 = pick(r, [
      "PAR 1 (1 & 30 days)",
      "PAR 1  (1 & 30 days)",
      "par 1 (1 & 30 days)",
      "par 1  (1 & 30 days)",
      "par1",
    ]);
    const par30 = pick(r, [
      "PAR 30 (31 & 60 days)",
      "PAR 30  (31 & 60 days)",
      "par 30 (31 & 60 days)",
      "par 30  (31 & 60 days)",
      "par30",
    ]);
    const par60 = pick(r, [
      "PAR 60 (61 & 90 days)",
      "PAR 60  (61 & 90 days)",
      "par 60 (61 & 90 days)",
      "par 60  (61 & 90 days)",
      "par60",
    ]);
    const par90 = pick(r, [
      "PAR 90 (91 & 120 days)",
      "PAR 90  (91 & 120 days)",
      "par 90 (91 & 120 days)",
      "par 90  (91 & 120 days)",
      "par90",
    ]);
    const par120 = pick(r, [
      "PAR 120 (121 & 180 days)",
      "PAR 120  (121 & 180 days)",
      "par 120 (121 & 180 days)",
      "par 120  (121 & 180 days)",
      "par120",
    ]);
    const par180 = pick(r, [
      "PAR 180 (181 & 240 days)",
      "PAR 180  (181 & 240 days)",
      "par 180 (181 & 240 days)",
      "par 180  (181 & 240 days)",
      "par180",
    ]);
    const par240 = pick(r, [
      "PAR 240 (241 & 360 days)",
      "PAR 240  (241 & 360 days)",
      "par 240 (241 & 360 days)",
      "par 240  (241 & 360 days)",
      "par240",
    ]);
    const par360 = pick(r, [
      "PAR 360 (361 & Up days)",
      "PAR 360  (361 & Up days)",
      "par 360 (361 & up days)",
      "par 360  (361 & up days)",
      "par360",
    ]);

    const row: AgingRow = {
      product,
      date,
      total_loan_balance_with_cp: numOrNA(tlb),
      d0: numOrNA(d0),
      par1: numOrNA(par1),
      par30: numOrNA(par30),
      par60: numOrNA(par60),
      par90: numOrNA(par90),
      par120: numOrNA(par120),
      par180: numOrNA(par180),
      par240: numOrNA(par240),
      par360: numOrNA(par360),
    };

    return row;
  });

  return out;
}

/* ------------------ Page ------------------ */
type ViewKey = "principal" | "distribution" | "flowrate";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export default function Step4() {
  const currentPdTransitionMatrixWorkflowId = useAppSelector(
    (state: any) =>
      state.pdTransitionMatrixWfHelper.currentPdTransitionMatrixWorkflowId
  );
  const currentPdTransitionMatrixWorkflowData = useAppSelector(
    (state: any) =>
      state.pdTransitionMatrixWfHelper.currentPdTransitionMatrixWorkflowData
  );
  
  // Try to get workflowId from multiple sources:
  // 1. Direct workflowId from Redux
  // 2. From workflowData.id
  // 3. From useWorkflowId() hook (URL params, state, localStorage)
  const workflowIdFromData = currentPdTransitionMatrixWorkflowData?.id;
  const workflowId = 
    currentPdTransitionMatrixWorkflowId || 
    workflowIdFromData || 
    useWorkflowId();
  
  const authToken = useAppSelector((s) => s.auth.token);

  // Debug: Log workflowId value
  useEffect(() => {
    console.log("Step4 - Current workflowId:", workflowId, "Type:", typeof workflowId);
    console.log("Step4 - Redux workflowId:", currentPdTransitionMatrixWorkflowId);
    console.log("Step4 - WorkflowData ID:", workflowIdFromData);
    console.log("Step4 - WorkflowData:", currentPdTransitionMatrixWorkflowData);
  }, [workflowId, currentPdTransitionMatrixWorkflowId, workflowIdFromData, currentPdTransitionMatrixWorkflowData]);

  const [apiData, setApiData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toasterStatus, setToasterStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [toasterMessage, setToasterMessage] = useState<string>("");

  // default view = principal
  const [view, setView] = useState<ViewKey>("principal");
  const [productFilter, setProductFilter] = useState<string | null>(null);

  // Check if data already exists on page load
  useEffect(() => {
    if (!workflowId || workflowId === 0) {
      setApiData(null);
      setLoading(false);
      return;
    }

    const workflowIdNum = Number(workflowId);
    if (isNaN(workflowIdNum) || workflowIdNum <= 0) {
      setApiData(null);
      setLoading(false);
      return;
    }

    console.log("Step4 - Fetching flow rate data with workflowId:", workflowIdNum);
    let mounted = true;
    setLoading(true);
    setError(null);

    getFlowRateDataGET({
      apiBase: API_BASE,
      token: authToken,
      workflowId: workflowIdNum,
    })
      .then((res) => {
        if (!mounted) return;
        const data = res?.data ?? res;
        if (
          data &&
          (data["Flow of Loan Balance Principal Matrix"] ||
            data["Flow of Loan Balance Principal Matrix (Distribution)"] ||
            data["Flow Rate Calculation"])
        ) {
          setApiData(res);
        } else {
          setApiData(null);
        }
        setLoading(false);
      })
      .catch((e: any) => {
        if (!mounted) return;
        console.log("No existing data found for Step 4:", e?.message);
        setApiData(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [workflowId, authToken]);

  // Derive rows per view
  const rowsForView = useMemo(() => {
    if (!apiData) return [] as any[];
    const data = apiData?.data ?? apiData;

    if (view === "principal") {
      return coercePrincipalMatrix(apiData, "principal");
    }
    if (view === "distribution") {
      return coercePrincipalMatrix(apiData, "distribution");
    }
    if (view === "flowrate") {
      const block =
        data?.["Flow Rate Calculation"] ??
        data?.["Flowrate Calculation"] ??
        data?.rows ??
        [];
      return Array.isArray(block) ? block : [];
    }
    return [] as any[];
  }, [apiData, view]);

  // products from whatever rows we are showing
  const products = useMemo(() => {
    return Array.from(
      new Set(
        rowsForView
          .map((r: any) => r.product ?? r.Product ?? "")
          .filter(Boolean)
      )
    )
      .sort()
      .filter(Boolean);
  }, [rowsForView]);

  const filteredRows = useMemo(() => {
    if (!productFilter) return rowsForView;
    return rowsForView.filter(
      (r: any) =>
        (r.product ?? r.Product ?? "").toString() === productFilter
    );
  }, [rowsForView, productFilter]);

  const handleRun = async () => {
    if (!workflowId || workflowId === 0) {
      setError("Please select a workflow first");
      return;
    }
    
    const workflowIdNum = Number(workflowId);
    if (isNaN(workflowIdNum) || workflowIdNum <= 0) {
      setError("Invalid workflow ID");
      return;
    }
    
    console.log("Step4 - Running flow rate with workflowId:", workflowIdNum);
    setRunning(true);
    setError(null);
    setToasterStatus("loading");
    setToasterMessage("Running flow rate calculation...");

    try {
      await runFlowRatePOST({
        apiBase: API_BASE,
        token: authToken,
        workflowId: workflowIdNum,
      });

      // After POST, fetch updated data
      const getResult = await getFlowRateDataGET({
        apiBase: API_BASE,
        token: authToken,
        workflowId: workflowIdNum,
      });

      console.log("Updated data:", getResult);
      setApiData(getResult);
      setToasterStatus("success");
      setToasterMessage("Flow rate calculation completed successfully!");
    } catch (e: any) {
      console.error("Run error:", e);
      const errorMsg = e?.message || "Failed to run flow rate calculation.";
      setToasterStatus("error");
      setToasterMessage(errorMsg);
      setError(errorMsg);
    } finally {
      setRunning(false);
    }
  };

  const handleExport = async () => {
    if (!workflowId || workflowId === 0) {
      setError("Please select a workflow first");
      return;
    }
    
    const workflowIdNum = Number(workflowId);
    if (isNaN(workflowIdNum) || workflowIdNum <= 0) {
      setError("Invalid workflow ID");
      return;
    }
    
    console.log("Step4 - Exporting flow rate with workflowId:", workflowIdNum);
    setExporting(true);
    setError(null);
    setToasterStatus("loading");
    setToasterMessage("Exporting file...");

    try {
      const blob = await exportFlowRateFile({
        apiBase: API_BASE,
        token: authToken,
        workflowId: workflowIdNum,
      });

      // Get filename from blob or use default
      const filename = `flow_rate_output_${workflowIdNum}.xlsx`;

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
      console.error("Export error:", e);
      const errorMsg = e?.message || "Failed to export file.";
      setToasterStatus("error");
      setToasterMessage(errorMsg);
      setError(errorMsg);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <ApiStatusIndicator
        status={toasterStatus}
        message={toasterMessage}
        onHide={() => setToasterStatus("idle")}
      />
      <div className="min-h-dvh p-6 space-y-6">
        {/* Top heading + Run + Export */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Flowrate Approach
            </h2>
            <p className="text-xs text-gray-700">
              Explore principal matrices, their distributions, and flow rate
              calculations.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRun}
              disabled={running || !workflowId || workflowId === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 disabled:bg-yellow-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
              title={
                !workflowId || workflowId === 0
                  ? "Select a workflow first"
                  : "Run flow rate calculation"
              }
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

        {/* Segmented View Switch */}
        <div className="flex items-center justify-between">
          <div className="inline-flex rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setView("principal")}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
                ${
                  view === "principal" ? "bg-white shadow-sm" : "hover:bg-white/60"
                }
              `}
              aria-pressed={view === "principal"}
            >
              <Squares2X2Icon className="h-4 w-4" />
              Principal Matrix
            </button>
            <button
              type="button"
              onClick={() => setView("distribution")}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
                ${
                  view === "distribution"
                    ? "bg-white shadow-sm"
                    : "hover:bg-white/60"
                }
              `}
              aria-pressed={view === "distribution"}
            >
              <ChartBarIcon className="h-4 w-4" />
              Distribution
            </button>
            <button
              type="button"
              onClick={() => setView("flowrate")}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition
                ${
                  view === "flowrate"
                    ? "bg-white shadow-sm"
                    : "hover:bg-white/60"
                }
              `}
              aria-pressed={view === "flowrate"}
            >
              <ArrowTrendingUpIcon className="h-4 w-4" />
              Flow Rate Calc
            </button>
          </div>

          {/* simple product filter (optional) */}
          {products.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-700">Filter by product:</span>
              <select
                value={productFilter ?? ""}
                onChange={(e) =>
                  setProductFilter(e.target.value || null)
                }
                className="h-9 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-2 focus:ring-yellow-300"
              >
                <option value="">All</option>
                {products.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Loading / Error / Content */}
        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700">
            Loading…
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        ) : (
          <>
            {view === "principal" && (
              <Card
                title="Flow of Loan Balance Principal Matrix"
                subtitle="Raw principal balances by PAR bucket."
              >
                <PrincipalMatrixTable rows={filteredRows as AgingRow[]} height={420} />
              </Card>
            )}

            {view === "distribution" && (
              <Card
                title="Flow of Loan Balance Principal Matrix — Distribution"
                subtitle="Bucket shares (percent of total) per row."
              >
                <PrincipalMatrixDistributionTable
                  rows={filteredRows as AgingRow[]}
                  height={420}
                />
              </Card>
            )}

            {view === "flowrate" && (
              <Card
                title="Flow Rate Calculation"
                subtitle="Calculated from successive periods per product."
              >
                {/* now gets raw 'Flow Rate Calculation' rows from backend */}
                <FlowRateCalcTable rows={filteredRows} height={420} />
              </Card>
            )}
          </>
        )}
      </div>
    </>
  );
}

/* ------------------ Small Card wrapper ------------------ */
const Card: React.FC<
  React.PropsWithChildren<{ title: string; subtitle?: string }>
> = ({ title, subtitle, children }) => (
  <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div className="flex items-center justify-between px-4 py-3 border-b rounded-t-2xl bg-yellow-500">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        {subtitle && (
          <p className="text-xs text-gray-800 -mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
    <div className="p-4">{children}</div>
  </div>
);