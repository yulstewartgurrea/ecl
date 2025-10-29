// ==========================
// pages/flowrate/steps/Step5.tsx (API-DRIVEN)
// ==========================
import React, { useEffect, useMemo, useState } from "react";
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

/* ---------------- helpers ---------------- */
const clean = (s: string) => (s ?? "").toLowerCase().replace(/\s+/g, "");

function pick(o: any, candidates: string[]) {
  for (const k of candidates) {
    if (o && Object.prototype.hasOwnProperty.call(o, k)) return o[k];
    const found = Object.keys(o || {}).find((kk) => clean(kk) === clean(k));
    if (found) return o[found];
  }
  return undefined;
}

/** "331.31%" -> 3.3131 ; "" / "-" / "#N/A" -> 0 */
function pctToDecimal(v: any): number {
  if (v == null) return 0;
  const raw = String(v).trim();
  if (!raw || raw === "-" || raw.toUpperCase() === "#N/A") return 0;
  const s = raw.replace(/,/g, "").replace(/\s+/g, "");
  if (s.endsWith("%")) {
    const n = Number(s.slice(0, -1));
    return Number.isFinite(n) ? n / 100 : 0;
    // NOTE: this keeps "331.31%" => 3.3131 (as requested)
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** yyy-mm-dd max selector */
function latestByDate<T extends { Date?: string; date?: string }>(arr: T[]): T | undefined {
  if (!arr || arr.length === 0) return undefined;
  const get = (r: any) => (r?.Date ?? r?.date ?? "").toString();
  const sorted = arr.slice().sort((a, b) => get(b).localeCompare(get(a))); // desc
  return sorted[0]; // no .at()
}


/* ---- category map ---- */
const CATS: AgingCategory[] = [
  { key: "d0", label: "0 day to PAR 1" },
  { key: "par1_30", label: "PAR 1 to PAR 30" },
  { key: "par30_60", label: "PAR 30 to PAR 60" },
  { key: "par60_90", label: "PAR 60 to PAR 90" },
  { key: "par90_120", label: "PAR 90 to PAR 120" },
  { key: "par120_180", label: "PAR 120 to PAR 180" },
  { key: "par180_240", label: "PAR 180 to PAR 240" },
  { key: "par240_360", label: "PAR 240 to PAR 360" },
  { key: "par360p", label: "PAR 360 above" },
];

type KeyMap = Record<
  AgingCategory["key"],
  string[] // candidate labels in backend payload
>;

const FLOW_KEYS: KeyMap = {
  d0: ["0 Day to PAR 1", "0 day to PAR 1", "0 day→PAR 1", "d0topar1"],
  par1_30: ["PAR 1 to PAR 30", "par 1 to par 30", "par1topar30"],
  par30_60: ["PAR 30 to PAR 60", "par 30 to par 60", "par30topar60"],
  par60_90: ["PAR 60 to PAR 90", "par 60 to par 90", "par60topar90"],
  par90_120: ["PAR 90 to PAR 120", "par 90 to par 120", "par90topar120"],
  par120_180: ["PAR 120 to PAR 180", "par 120 to par 180", "par120topar180"],
  par180_240: ["PAR 180 to PAR 240", "par 180 to par 240", "par180topar240"],
  par240_360: ["PAR 240 to PAR 360", "par 240 to par 360", "par240topar360"],
  par360p: ["PAR 360 above", "par 360 above", "par360+"],
};

/* -------- coercers -------- */

/** Step5 rows from credit_loss_calculation.flow_rate_calculation */
function coerceRowsFromStep5(payload: any): MonthRow[] {
  const block =
    payload?.data?.flow_rate_calculation ??
    payload?.data?.["flow_rate_calculation"] ??
    payload?.data ??  // Direct data array from credit loss calculation
    payload?.rows ??
    payload;
  const arr: any[] = Array.isArray(block) ? block : [];
  return arr.map((r) => {
    const date = (pick(r, ["Date", "Report Date", "date", "report_date"]) ?? "").toString();
    const cols: MonthRow["cols"] = {
      d0: pctToDecimal(pick(r, FLOW_KEYS.d0)),
      par1_30: pctToDecimal(pick(r, FLOW_KEYS.par1_30)),
      par30_60: pctToDecimal(pick(r, FLOW_KEYS.par30_60)),
      par60_90: pctToDecimal(pick(r, FLOW_KEYS.par60_90)),
      par90_120: pctToDecimal(pick(r, FLOW_KEYS.par90_120)),
      par120_180: pctToDecimal(pick(r, FLOW_KEYS.par120_180)),
      par180_240: pctToDecimal(pick(r, FLOW_KEYS.par180_240)),
      par240_360: pctToDecimal(pick(r, FLOW_KEYS.par240_360)),
      par360p: pctToDecimal(pick(r, FLOW_KEYS.par360p)),
    };
    
    // Extract Monotonic? and Weighted Credit Loss Rate per Month from API
    const monotonicStr = pick(r, ["Monotonic?", "Monotonic", "monotonic"]);
    // Handle various formats: "Yes"/"yes"/true → true, "No"/"no"/false → false
    let monotonic: boolean | undefined = undefined;
    if (monotonicStr !== undefined && monotonicStr !== null && monotonicStr !== "") {
      const str = String(monotonicStr).toLowerCase().trim();
      monotonic = str === "yes" || monotonicStr === true;
    }
    
    const weightedRate = pick(r, ["Weighted Credit Loss Rate per Month", "Weighted credit loss rate / month", "weighted_credit_loss_rate"]);
    const weighted = weightedRate != null && weightedRate !== "" ? pctToDecimal(weightedRate) : undefined;
    
    return { date, cols, monotonic, weighted };
  });
}

/** Rate set(s) – prefer explicit block; fallback to average of rows */
function coerceRateSets(payload: any, rows: MonthRow[]): RatesColumnSet[] {
  // Try to find a named block with historical rates
  const explicit =
    payload?.data?.historical_credit_loss_rate ??
    payload?.data?.historical_rates ??
    payload?.data?.["Historical Credit Loss Rate"] ??
    null;

  // Single object like { "0 Day to PAR 1": "0.12%", ... }
  if (explicit && !Array.isArray(explicit) && typeof explicit === "object") {
    const values = {
      d0: pctToDecimal(pick(explicit, FLOW_KEYS.d0)),
      par1_30: pctToDecimal(pick(explicit, FLOW_KEYS.par1_30)),
      par30_60: pctToDecimal(pick(explicit, FLOW_KEYS.par30_60)),
      par60_90: pctToDecimal(pick(explicit, FLOW_KEYS.par60_90)),
      par90_120: pctToDecimal(pick(explicit, FLOW_KEYS.par90_120)),
      par120_180: pctToDecimal(pick(explicit, FLOW_KEYS.par120_180)),
      par180_240: pctToDecimal(pick(explicit, FLOW_KEYS.par180_240)),
      par240_360: pctToDecimal(pick(explicit, FLOW_KEYS.par240_360)),
      par360p: pctToDecimal(pick(explicit, FLOW_KEYS.par360p)),
    };
    return [{ name: "Historical Credit Loss Rate", values }];
  }

  // Array of sets? [{name, ...fields}] – try to map each entry
  if (Array.isArray(explicit)) {
    const sets: RatesColumnSet[] = explicit.map((obj: any, i: number) => ({
      name: obj?.name ?? `Rate Set ${i + 1}`,
      values: {
        d0: pctToDecimal(pick(obj, FLOW_KEYS.d0)),
        par1_30: pctToDecimal(pick(obj, FLOW_KEYS.par1_30)),
        par30_60: pctToDecimal(pick(obj, FLOW_KEYS.par30_60)),
        par60_90: pctToDecimal(pick(obj, FLOW_KEYS.par60_90)),
        par90_120: pctToDecimal(pick(obj, FLOW_KEYS.par90_120)),
        par120_180: pctToDecimal(pick(obj, FLOW_KEYS.par120_180)),
        par180_240: pctToDecimal(pick(obj, FLOW_KEYS.par180_240)),
        par240_360: pctToDecimal(pick(obj, FLOW_KEYS.par240_360)),
        par360p: pctToDecimal(pick(obj, FLOW_KEYS.par360p)),
      },
    }));
    if (sets.length) return sets;
  }

  // Fallback – average across months (simple arithmetic mean)
  if (!rows.length) return [];
  const keys = CATS.map((c) => c.key);
  const sums: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  rows.forEach((r) => keys.forEach((k) => (sums[k] += r.cols[k as keyof MonthRow["cols"]] || 0)));
  const avg: Record<any, number> = Object.fromEntries(
    keys.map((k) => [k, (sums[k] || 0) / rows.length])
  );
  return [{ name: "Historical (avg of months)", values: avg as any }];
}

/** Distribution – prefer step5; fallback to step3 distribution latest row */
function coerceDistribution(step5: any, step3?: any): DistributionBy | undefined {
  // Step 5 explicit?
  const d1 =
    step5?.data?.distribution ??
    step5?.data?.["distribution"] ??
    step5?.data?.["Distribution"] ??
    null;
  if (d1 && typeof d1 === "object" && !Array.isArray(d1)) {
    const asOf = d1?.asOfLabel ?? d1?.asOf ?? "";
    const values = {
      d0: pctToDecimal(pick(d1, FLOW_KEYS.d0)),
      par1_30: pctToDecimal(pick(d1, FLOW_KEYS.par1_30)),
      par30_60: pctToDecimal(pick(d1, FLOW_KEYS.par30_60)),
      par60_90: pctToDecimal(pick(d1, FLOW_KEYS.par60_90)),
      par90_120: pctToDecimal(pick(d1, FLOW_KEYS.par90_120)),
      par120_180: pctToDecimal(pick(d1, FLOW_KEYS.par120_180)),
      par180_240: pctToDecimal(pick(d1, FLOW_KEYS.par180_240)),
      par240_360: pctToDecimal(pick(d1, FLOW_KEYS.par240_360)),
      par360p: pctToDecimal(pick(d1, FLOW_KEYS.par360p)),
    };
    return { type: "asOf", asOfLabel: asOf || "", values };
  }

  // Fallback to Step 3 distribution block
  const distBlock =
    step3?.data?.["flow_of_balance_principal_matrix (distribution)"] ??
    step3?.data?.flow_of_balance_principal_matrix_distribution ??
    null;

  if (Array.isArray(distBlock) && distBlock.length) {
    const latest = latestByDate(distBlock as any[]);
    const date =
      (latest?.Date ?? latest?.date ?? latest?.["Report Date"] ?? "").toString();
    const values = {
      d0: pctToDecimal(pick(latest, ["0 day", "0 Day"])),
      par1_30: pctToDecimal(pick(latest, ["PAR 1  (1 & 30 days)", "PAR 1 (1 & 30 days)"])),
      par30_60: pctToDecimal(pick(latest, ["PAR 30  (31 & 60 days)", "PAR 30 (31 & 60 days)"])),
      par60_90: pctToDecimal(pick(latest, ["PAR 60  (61 & 90 days)", "PAR 60 (61 & 90 days)"])),
      par90_120: pctToDecimal(pick(latest, ["PAR 90  (91 & 120 days)", "PAR 90 (91 & 120 days)"])),
      par120_180: pctToDecimal(pick(latest, ["PAR 120  (121 & 180 days)", "PAR 120 (121 & 180 days)"])),
      par180_240: pctToDecimal(pick(latest, ["PAR 180  (181 & 240 days)", "PAR 180 (181 & 240 days)"])),
      par240_360: pctToDecimal(pick(latest, ["PAR 240  (241 & 360 days)", "PAR 240 (241 & 360 days)"])),
      par360p: pctToDecimal(pick(latest, ["PAR 360  (361 & Up days)", "PAR 360 (361 & Up days)"])),
    };
    return { type: "asOf", asOfLabel: `as of ${date}`, values };
  }

  return undefined;
}

/* ---------------- page ---------------- */
const Step5: React.FC = () => {
  // Get workflow ID from Redux
  const currentPdTransitionMatrixWorkflowId = useAppSelector((state: any) => state.pdTransitionMatrixWfHelper.currentPdTransitionMatrixWorkflowId);
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
  const [toasterStatus, setToasterStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
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
        const hasData = data && (
          (Array.isArray(data) && data.length > 0) ||  // Direct array format from credit loss calculation
          (typeof data === 'object' && (data.flow_rate_calculation || data['flow_rate_calculation']))
        );

        if (hasData) {
          const r = step5 ? coerceRowsFromStep5(step5) : [];
          const rs = coerceRateSets(step5, r);
          const dist = coerceDistribution(step5, step3);

          setCategories(CATS);
          setRows(r.length ? r : undefined);
          setRateSets(rs.length ? rs : undefined);
          setDistribution(dist);
        } else {
          // No data exists, don't set defaults
          setCategories(undefined);
          setRows(undefined);
          setRateSets(undefined);
          setDistribution(undefined);
        }
      })
      .catch((e: any) => {
        if (!mounted) return;
        // Don't show error, just set no data
        console.log("No existing data found for Step5");
        setCategories(undefined);
        setRows(undefined);
        setRateSets(undefined);
        setDistribution(undefined);
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [workflowId, getStep5Data, getStep3Data]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setToasterStatus("loading");
    setToasterMessage("Running credit loss calculation...");
    
    try {
      const formData = new FormData();
      formData.append('workflow_id', String(workflowId));

      const headers: Record<string, string> = {};
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch('http://localhost:8000/api/flowrate_approach/credit_loss_calculation/', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      console.log('Run result:', result);
      
      // If successful, fetch the updated data using the API helper
      if (result.success || result.code === 1) {
        const getResult = await getStep5Data(workflowId);
        console.log('Updated data:', getResult);

        // Update state with new data
        const step5 = getResult;
        const step3Result = await getStep3Data(workflowId);
        const step3 = step3Result;

        const r = step5 ? coerceRowsFromStep5(step5) : [];
        const rs = coerceRateSets(step5, r);
        const dist = coerceDistribution(step5, step3);

        setCategories(CATS);
        setRows(r.length ? r : undefined);
        setRateSets(rs.length ? rs : undefined);
        setDistribution(dist);

        // Show success toaster
        setToasterStatus("success");
        setToasterMessage("Credit loss calculation completed successfully!");
      } else {
        // Show error if result is not successful
        const errorMsg = result.msg || 'Credit loss calculation failed.';
        setToasterStatus("error");
        setToasterMessage(errorMsg);
        setError(errorMsg);
      }
    } catch (e: any) {
      console.error('Run error:', e);
      const errorMsg = e?.message || 'Failed to run credit loss calculation.';
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
      
      if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
      }

      const response = await fetch(`http://localhost:8000/api/flowrate_approach/credit_loss_calculation/export?workflow_id=${workflowId}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        // Try to parse error response
        let errorMsg = `API error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          errorMsg = errorData.msg || errorMsg;
        } catch {
          // If response is not JSON, use default message
        }
        throw new Error(errorMsg);
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'credit_loss_calculation_output.xlsx';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Show success toaster
      setToasterStatus("success");
      setToasterMessage("File exported successfully!");
    } catch (e: any) {
      console.error('Export error:', e);
      const errorMsg = e?.message || 'Failed to export file.';
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
        {/* Top heading + Run button */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Credit Loss Rate — Step 3</h2>
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
              {running ? 'Running...' : 'Run'}
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || running || !rows}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium rounded-lg transition"
            >
              <ArrowDownTrayIcon className="h-5 w-5" />
              {exporting ? 'Exporting...' : 'Export'}
            </button>
          </div>
        </div>

      {loading ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700">
          Loading…
        </div>
      ) : (
        <CreditLossRateMatrix
          categories={categories}
          rows={rows}
          historicalRateSets={rateSets}
          distribution={distribution}
          showNotes
        />
      )}
    </div>
    </>
  );
};

export default Step5;
