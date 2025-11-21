import React, { useEffect, useMemo, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLocation, useSearchParams } from "react-router-dom";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";
import { useAppSelector } from "../../../redux_toolkit/hooks";
import { useAsaApi } from "../../../lib/asaApi";

import CreditLossRateCharts, {
  type CreditLossRateRow,
} from "../../../components/asa/graph/CreditLossRateCharts";

import {
  selectStep5ByWorkflow,
  setStep5Bundle,
} from "../../../redux_toolkit/features/asa/flowrateStep5Slice";

import {
  coerceRowsFromStep5,
  coerceRateSets,
  coerceDistribution,
  toChartRows,
} from "../../../lib/flowrateCoercers";

export default function Step6() {
  const dispatch = useDispatch();
  const { getStep5Data } = useAsaApi(); // Step5 only

  // Resolve workflowId
  const reduxId = useAppSelector(
    (s: any) => s.pdTransitionMatrixWfHelper?.currentPdTransitionMatrixWorkflowId
  );
  const { state } = useLocation() as { state?: { workflowId?: number } };
  const [params] = useSearchParams();

  const idFromQuery = Number(params.get("workflow_id"));
  const idFromState = state?.workflowId;
  const idFromLocal = Number(localStorage.getItem("current_workflow_id") || "");

  const cacheMap = useSelector((s: any) => s.flowrateStep5?.byWorkflowId ?? {});
  const firstCachedKey = useMemo(() => {
    const keys = Object.keys(cacheMap)
      .map(Number)
      .filter((n) => Number.isFinite(n) && n > 0);
    return keys.length ? keys[keys.length - 1] : undefined;
  }, [cacheMap]);

  const workflowId =
    (Number(reduxId) > 0 && Number(reduxId)) ||
    (Number(idFromQuery) > 0 && Number(idFromQuery)) ||
    (Number(idFromState) > 0 && Number(idFromState)) ||
    (Number(idFromLocal) > 0 && Number(idFromLocal)) ||
    (Number(firstCachedKey) > 0 && Number(firstCachedKey)) ||
    0;

  // Cached bundle (if reducer is mounted at flowrateStep5)
  const cached = useSelector((s) => selectStep5ByWorkflow(s, workflowId));

  // 🔑 Local fallback to guarantee rendering
  const [rowsLocal, setRowsLocal] = useState<any[] | undefined>(undefined);
  const [rateSetsLocal, setRateSetsLocal] = useState<any[] | undefined>(undefined);

  const [loading, setLoading] = useState(!cached?.rows && !rowsLocal);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    let mounted = true;
    if (!workflowId) {
      setLoading(false);
      return;
    }
    if (cached?.rows?.length || rowsLocal?.length) return;

    setLoading(true);
    setStatus("loading");
    setMsg("Loading credit loss results…");

    (async () => {
      try {
        const s5 = await getStep5Data(workflowId);
        // console.log("s5", s5);

        const r = coerceRowsFromStep5(s5);
        const rs = coerceRateSets(s5, r);
        const dist = coerceDistribution(s5); // ok if undefined

        if (!mounted) return;

        // feed Redux (if reducer is mounted)
        dispatch(
          setStep5Bundle({
            workflowId,
            rows: r,
            rateSets: rs,
            distribution: dist,
            fetchedAt: new Date().toISOString(),
          })
        );

        // local mirror for rendering even without Redux
        setRowsLocal(r);
        setRateSetsLocal(rs);

        setStatus("success");
        setMsg("Loaded.");
      } catch (e: any) {
        if (!mounted) return;
        setStatus("error");
        setMsg(e?.message || "Failed to load results.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [workflowId, cached?.rows, rowsLocal, getStep5Data, dispatch]);

  const sourceRows = cached?.rows ?? rowsLocal ?? [];
  const chartRows: CreditLossRateRow[] = useMemo(
    () => toChartRows(sourceRows),
    [sourceRows]
  );
  const rateSetNames = (cached?.rateSets ?? rateSetsLocal ?? []).map((s: any) => s.name);

  // Debug if needed:
  // console.log("workflowId", workflowId, "sourceRows", sourceRows.length, "chartRows", chartRows.length);

  return (
    <>
      <ApiStatusIndicator status={status} message={msg} onHide={() => setStatus("idle")} />

      <div className="min-h-dvh p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Credit Loss Rate — (Charts)</h2>
          <p className="text-xs text-gray-700">
            Visualize the flow-rate credit loss output from Step 3.
          </p>
        </div>

        {!workflowId ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700">
            No workflow selected. Open Step 5 and run a calculation first.
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700">
            Loading…
          </div>
        ) : chartRows.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-700">
            No data for workflow #{workflowId}. Run Step 5 first.
          </div>
        ) : (
          <CreditLossRateCharts
            data={chartRows}
            rateSets={rateSetNames.length ? rateSetNames : ["Historical (avg of months)"]}
            title="Credit Loss Rate Approach – Visuals"
            enableExport={false}
          />
        )}
      </div>
    </>
  );
}
