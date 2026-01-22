// pages/flowrate/steps/Step5.tsx (API-DRIVEN, DYNAMIC)
import React, { useEffect, useState } from "react";
import { PlayIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import CreditLossRateMatrix from "../../../components/asa/credit/CreditLossRateMatrix";
import { useAsaApi } from "../../../lib/asaApi";
import { useLocation, useSearchParams } from "react-router-dom";
import { useAppSelector } from "../../../redux_toolkit/hooks";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";
import { useDispatch } from "react-redux";
import { setStep5Bundle } from "../../../redux_toolkit/features/asa/flowrateStep5Slice";

/* -------- workflow id helpers (URL ?workflow_id=, route state, or localStorage) -------- */
function useWorkflowId(): number {
  const { state } = useLocation() as { state?: { workflowId?: number } };
  const [params] = useSearchParams();

  const q = Number(params.get("workflow_id"));
  if (!Number.isNaN(q) && q > 0) return q;

  if (state?.workflowId && state.workflowId > 0) return state.workflowId;

  const ls = Number(localStorage.getItem("current_workflow_id") || "");
  if (!Number.isNaN(ls) && ls > 0) return ls;

  return 1; // dev fallback
}

/* -------- helpers to safely extract array rows from unknown backend shape -------- */
function isPlainObject(v: any): v is Record<string, any> {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

export function findFirstRowArray(payload: any): any[] {
  const data = payload?.data ?? payload;

  if (Array.isArray(data)) return data;
  if (!isPlainObject(data)) return [];

  const obj: Record<string, any> = data;

  // direct candidates
  const directCandidates = [
    "flow_rate_calculation",
    "credit_loss_calculation",
    "credit_loss_rate",
    "rows",
    "data",
  ];

  for (const k of directCandidates) {
    if (Array.isArray(obj[k])) return obj[k];
  }

  // scan top-level arrays
  for (const [, v] of Object.entries(obj) as [string, any][]) {
    if (Array.isArray(v)) return v;
  }

  // scan 1 level deep (✅ fixed typing here)
  for (const [, v] of Object.entries(obj) as [string, any][]) {
    if (isPlainObject(v)) {
      for (const vv of Object.values(v)) {
        if (Array.isArray(vv)) return vv;
      }
    }
  }

  return [];
}


/**
 * Optional: derive rate sets if backend provides them.
 * If not found, returns undefined and UI won’t show the selector.
 */
function deriveRateSets(step5: any) {
  const data = step5?.data ?? step5;
  if (!isPlainObject(data)) return undefined;

  // try some likely keys
  const candidates = [
    "historical_rate_sets",
    "historicalRateSets",
    "rate_sets",
    "rateSets",
  ];

  for (const k of candidates) {
    const v = (data as any)[k];
    if (Array.isArray(v)) {
      // Expect items like { name, ...bucketKeys }
      return v
        .filter(Boolean)
        .map((item: any, idx: number) => {
          const name = String(item?.name ?? item?.label ?? `Rate Set ${idx + 1}`);
          const values: Record<string, number> = {};
          Object.keys(item || {}).forEach((kk) => {
            if (kk === "name" || kk === "label") return;
            const n = Number(String(item[kk]).replace(/,/g, "").replace("%", ""));
            values[kk] = Number.isFinite(n) ? (String(item[kk]).includes("%") ? n / 100 : n) : 0;
          });
          return { name, values };
        });
    }
  }

  return undefined;
}

/**
 * Optional distribution passthrough (if you already use it in Step6).
 * If you don’t need distribution, you can remove this entirely.
 */
function deriveDistribution(step5: any, step3: any) {
  // keep as undefined for now unless you know the shape.
  // This avoids breaking when backend changes.
  console.log(step5, step3)
  return undefined;
}

/* ---------------- page ---------------- */
const Step5: React.FC = () => {
  const dispatch = useDispatch();

  const currentPdTransitionMatrixWorkflowId = useAppSelector(
    (state: any) => state.pdTransitionMatrixWfHelper.currentPdTransitionMatrixWorkflowId
  );
  const workflowId = currentPdTransitionMatrixWorkflowId || useWorkflowId();

  const authToken = useAppSelector((s: any) => s.auth.token);
  const { getStep3Data } = useAsaApi();

  const [rows, setRows] = useState<any[] | undefined>(undefined);
  const [rateSets, setRateSets] = useState<any[] | undefined>(undefined);
  const [distribution, setDistribution] = useState<any | undefined>(undefined);

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

    Promise.allSettled([getStep3Data(workflowId), getStep3Data(workflowId)])
      .then(([s5, s3]) => {
        if (!mounted) return;

        const step5 = s5.status === "fulfilled" ? s5.value : undefined;
        const step3 = s3.status === "fulfilled" ? s3.value : undefined;

        const arr = step5 ? findFirstRowArray(step5) : [];
        const hasData = Array.isArray(arr) && arr.length > 0;

        if (hasData) {
          const rs = step5 ? deriveRateSets(step5) : undefined;
          const dist = deriveDistribution(step5, step3);

          setRows(arr);
          setRateSets(rs);
          setDistribution(dist);
          console.log(error)
          // cache for Step6 (store raw; no static types)
          dispatch(
            setStep5Bundle({
              workflowId,
              rows: arr,
              rateSets: rs,
              distribution: dist,
              fetchedAt: new Date().toISOString(),
            })
          );
        } else {
          setRows(undefined);
          setRateSets(undefined);
          setDistribution(undefined);
        }
      })
      .catch(() => {
        if (!mounted) return;
        setRows(undefined);
        setRateSets(undefined);
        setDistribution(undefined);
      })
      .finally(() => mounted && setLoading(false));

    return () => {
      mounted = false;
    };
  }, [workflowId, getStep3Data, getStep3Data, dispatch]);

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
        `http://localhost:8000/api/flowrate_approach/credit_loss_calculation`,
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

      if (result.success || result.code === 1) {
        const step5Res = await getStep3Data(workflowId);
        const step3Res = await getStep3Data(workflowId);

        const arr = findFirstRowArray(step5Res);
        const rs = deriveRateSets(step5Res);
        const dist = deriveDistribution(step5Res, step3Res);

        setRows(arr.length ? arr : undefined);
        setRateSets(rs);
        setDistribution(dist);

        dispatch(
          setStep5Bundle({
            workflowId,
            rows: arr,
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

      const contentDisposition = response.headers.get("Content-Disposition");
      let filename = "credit_loss_calculation_output.xlsx";
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?(.+)"?/);
        if (match) filename = match[1];
      }

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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
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

        <CreditLossRateMatrix
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