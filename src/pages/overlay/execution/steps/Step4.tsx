// src/pages/overlay/execution/Step4.tsx
import React, { useState, useCallback, useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import { useAppSelector } from "../../../../redux_toolkit/hooks";

import ForecastedPdSummary, {
  type FinalModelRow,
  type ScenarioRow,
} from "../../../../components/overlay/execution/final_model/ForecastedPdSummary";

import {
  getForecastedPdInput,
  getForecastedPdCalc,
  runForecastedPdCalc,
} from "../../../../services/forecastedPd";

import {
  PlayCircleIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

const Step4: React.FC = () => {
  const { currentPdTransitionMatrixWorkflowId: selectedWorkflowId } =
    useSelector((s: RootState) => s.pdTransitionMatrixWfHelper as any);

  const token = useAppSelector(
    (s) => (s as any)?.auth?.token
  ) as string | null;

  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportReady, setExportReady] = useState(false);
  const [posting, setPosting] = useState(false);

  const [finalModel, setFinalModel] = useState<FinalModelRow[]>([]);
  const [mlrRows, setMlrRows] = useState<ScenarioRow[]>([]);
  const [forecastedPdRows, setForecastedPdRows] = useState<ScenarioRow[]>([]);

  const formatDate = (period: string): string => {
    // "2024-10-31" -> "10/31/2024"
    if (/^\d{4}-\d{2}-\d{2}$/.test(period)) {
      const [yyyy, mm, dd] = period.split("-");
      return `${Number(mm)}/${Number(dd)}/${yyyy}`;
    }
    return period;
  };

  const mapCalcData = useCallback(
    (data: any) => {
      const mlr = (data?.multiple_linear_regression ?? []) as any[];
      const fpd = (data?.forecasted_pd ?? []) as any[];

      const mapScenario = (r: any): ScenarioRow => ({
        date: formatDate(String(r.Period)),
        upside: Number(r.Upside ?? 0),
        base: Number(r.Base ?? 0),
        downside: Number(r.Downside ?? 0),
      });

      const mlrMapped = mlr.map(mapScenario);
      const fpdMapped = fpd.map(mapScenario);

      setMlrRows(mlrMapped);
      setForecastedPdRows(fpdMapped);

      const hasData =
        mlrMapped.length > 0 || fpdMapped.length > 0 || finalModel.length > 0;
      setExportReady(hasData);
    },
    [finalModel.length]
  );

  // Load calc results first every time page is visited
  useEffect(() => {
    if (!selectedWorkflowId) {
      setMlrRows([]);
      setForecastedPdRows([]);
      setExportReady(false);
      return;
    }

    const loadCalcData = async () => {
      try {
        // Always check for existing calc results first when visiting the page
        const calcData = await getForecastedPdCalc(
          selectedWorkflowId,
          token
        ).catch(() => ({}));
        mapCalcData(calcData);
      } catch (err) {
        console.error("Failed to load forecasted PD calc data:", err);
      }
    };

    void loadCalcData();
  }, [selectedWorkflowId, token, mapCalcData]);

  // Load final model coefficients
  useEffect(() => {
    if (!selectedWorkflowId) {
      setFinalModel([]);
      return;
    }

    const loadFinalModel = async () => {
      try {
        setLoading(true);
        const inputData = await getForecastedPdInput(selectedWorkflowId, token);
        const fm: FinalModelRow[] = Object.entries(inputData).map(
          ([key, value]) => ({
            variable:
              key === "intercept"
                ? "Intercept"
                : key, // keep original name for others
            coefficient: Number(value),
          })
        );
        setFinalModel(fm);
      } catch (err) {
        console.error("Failed to load forecasted PD input data:", err);
        alert("Failed to load forecasted PD data.");
        setFinalModel([]);
      } finally {
        setLoading(false);
      }
    };

    void loadFinalModel();
  }, [selectedWorkflowId, token]);

  // reload only calc results after POST
  const reloadCalc = useCallback(async () => {
    if (!selectedWorkflowId) return;
    try {
      const calcData = await getForecastedPdCalc(selectedWorkflowId, token);
      mapCalcData(calcData);
    } catch (err) {
      console.error(err);
      alert("Failed to reload forecasted PD results.");
    }
  }, [selectedWorkflowId, token, mapCalcData]);

  // Run button -> POST then re-GET
  const runInterpolation = useCallback(async () => {
    if (!selectedWorkflowId) return;
    setPosting(true);
    try {
      await runForecastedPdCalc(selectedWorkflowId, token);
      await reloadCalc();
    } catch (err) {
      console.error(err);
      alert("Run Forecasted PD failed.");
    } finally {
      setPosting(false);
    }
  }, [selectedWorkflowId, token, reloadCalc]);

  // Export everything that is displayed
  const exportCsv = useCallback(() => {
    if (!selectedWorkflowId) {
      alert("Select a workflow on Step 1 first.");
      return;
    }

    setExporting(true);
    try {
      const escape = (val: unknown) => {
        if (val === null || val === undefined) return "";
        const s = String(val);
        if (s.includes('"') || s.includes(",") || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const lines: string[] = [];

      // Final Overlay Model
      lines.push("Final Overlay Model");
      lines.push("Variable,Coefficient");
      finalModel.forEach((row) => {
        lines.push(
          [escape(row.variable), escape(row.coefficient)].join(",")
        );
      });

      lines.push("");

      // Multiple Linear Regression (all rows)
      lines.push("Multiple Linear Regression (MLR)");
      lines.push("Date,Upside,Base,Downside");
      mlrRows.forEach((row) => {
        lines.push(
          [
            escape(row.date),
            escape(row.upside),
            escape(row.base),
            escape(row.downside),
          ].join(",")
        );
      });

      lines.push("");

      // Forecasted PDs (all rows)
      lines.push("Forecasted PDs");
      lines.push("Date,Upside,Base,Downside");
      forecastedPdRows.forEach((row) => {
        lines.push(
          [
            escape(row.date),
            escape(row.upside),
            escape(row.base),
            escape(row.downside),
          ].join(",")
        );
      });

      const csv = lines.join("\n");
      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `forecasted_pd_summary_${selectedWorkflowId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Export failed.");
    } finally {
      setExporting(false);
    }
  }, [selectedWorkflowId, finalModel, mlrRows, forecastedPdRows]);

  console.log("forecastedPdRows: ", forecastedPdRows);
  return (
    <div className="min-h-dvh bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white">
        <div className="mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">
              Forecasted PD Calculations
            </h1>
            <p className="text-sm text-gray-600">
              This step uses the final overlay model, MLR output, and
              forecasted PDs to summarize the one-year PDs by scenario for
              every month.
            </p>
            {loading && (
              <p className="mt-1 text-xs text-gray-500">
                Loading forecasted PD data…
              </p>
            )}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {/* Run */}
            <button
              onClick={runInterpolation}
              disabled={posting || !selectedWorkflowId}
              className="cursor-pointer rounded-xl bg-gray-900 text-white px-3 py-2 text-sm font-medium hover:bg-black disabled:opacity-50 flex items-center gap-1.5"
              title={
                !selectedWorkflowId
                  ? "Select a workflow on Step 1 first"
                  : "Run Forecasted PD calculation"
              }
            >
              <PlayCircleIcon className="h-4 w-4" />
              <span>{posting ? "Running…" : "Run Forecasted PD"}</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={exportCsv}
              disabled={!exportReady || exporting || !selectedWorkflowId}
              className="cursor-pointer rounded-xl bg-white border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span>{exporting ? "Exporting…" : "Export CSV"}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto px-0 md:px-0 pb-8">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-5 md:px-6 md:py-6">
          <ForecastedPdSummary
            finalModel={finalModel}
            mlrRows={mlrRows}
            forecastedPdRows={forecastedPdRows}
          />
        </div>
      </main>
    </div>
  );
};

export default Step4;