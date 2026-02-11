// src/pages/overlay/execution/Step5.tsx
import React, {
  useState,
  useCallback,
  useEffect,
} from "react";
import { useAppSelector } from "../../../../redux_toolkit/hooks";

import OverlayMultiplierSummary, {
  type OverlayMultiplierRow,
} from "../../../../components/overlay/execution/final_model/OverlayMultiplierSummary";

import {
  postOverlayMultiplier,
  getOverlayMultiplier,
  type OverlayMultiplierApiRow,
} from "../../../../services/overlayMultiplier";

import {
  PlayCircleIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

const Step5: React.FC = () => {
  // read workflow_id + token
  const {
    currentPdTransitionMatrixWorkflowId: selectedWorkflowId
  } = useAppSelector((s) => s.pdTransitionMatrixWfHelper as any);
  const token = useAppSelector(
    (s) => (s as any)?.auth?.token
  ) as string | null;

  const historicalWeightedCreditLossRateFile = useAppSelector(
    (state) => (state as any).historicalWeightedCreditLossRateFile?.historical_weighted_credit_loss_rate_file
  ) as boolean;

  // button & data states
  const [posting, setPosting] = useState(false); // Run
  const [exporting, setExporting] = useState(false); // Export CSV
  const [exportReady, setExportReady] = useState(false);

  // all rows from GET API
  const [rows, setRows] = useState<OverlayMultiplierRow[]>([]);

  // flag so useEffect runs POST+GET after click
  const [shouldRun, setShouldRun] = useState(false);

  // export ready only when we have data + workflow
  useEffect(() => {
    setExportReady(!!selectedWorkflowId && rows.length > 0);
  }, [selectedWorkflowId, rows]);

  useEffect(() => {
    if (!selectedWorkflowId || !token) {
      setPosting(false);
      setShouldRun(false);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        // 1) POST
        const postResp = await postOverlayMultiplier(
          selectedWorkflowId,
          historicalWeightedCreditLossRateFile,
          token
        );

        console.log("POST overlay_multiplier response:", postResp);

        if (
          !postResp ||
          postResp.code !== 1 ||
          postResp.success !== true ||
          postResp.msg !== "Success"
        ) {
          if (!cancelled) {
            alert("Overlay multiplier POST did not return success.");
          }
          return;
        }

        // 2) GET (only when POST succeeded)
        const getResp = await getOverlayMultiplier(
          selectedWorkflowId,
          token
        );

        console.log("GET overlay_multiplier response:", getResp);

        if (!getResp || getResp.success !== true) {
          if (!cancelled) {
            alert("Overlay multiplier GET failed.");
          }
          return;
        }

        if (cancelled) return;

        const payload = getResp.data;
        const arr: OverlayMultiplierApiRow[] = Array.isArray(payload)
          ? payload
          : [payload];

        const mapped: OverlayMultiplierRow[] = arr.map((r) => {
          const reportDate =
            r.report_date ||
            r.reportDate ||
            r.Period ||
            "";

          const odrPercent =
            r.odr_percent ??
            r.ODR ??
            r.odr ??
            0;

          const upsideVal =
            r.upside ?? r.Upside ?? r.best ?? r.Best ?? 0;
          const baseVal =
            r.base ?? r.Base ?? 0;
          const downsideVal =
            r.downside ?? r.Downside ?? r.worst ?? r.Worst ?? 0;

          return {
            reportDate,
            odrPercent,
            upside: upsideVal,
            base: baseVal,
            downside: downsideVal,
          };
        });

        setRows(mapped);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          alert("Run overlay multiplier failed.");
        }
      } finally {
        if (!cancelled) {
          setPosting(false);
          setShouldRun(false);
        }
      }
    };

    run();
  }, []); // š ï¸ kept as-is, same logic you had

  useEffect(() => {
    if (!shouldRun) return;
    if (!selectedWorkflowId || !token) {
      setPosting(false);
      setShouldRun(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        // 1) POST
        const postResp = await postOverlayMultiplier(
          selectedWorkflowId,
          historicalWeightedCreditLossRateFile,
          token
        );

        console.log("POST overlay_multiplier response:", postResp);

        if (
          !postResp ||
          postResp.code !== 1 ||
          postResp.success !== true ||
          postResp.msg !== "Success"
        ) {
          if (!cancelled) {
            alert("Overlay multiplier POST did not return success.");
          }
          return;
        }

        // 2) GET (only when POST succeeded)
        const getResp = await getOverlayMultiplier(
          selectedWorkflowId,
          token
        );

        console.log("GET overlay_multiplier response:", getResp);

        if (!getResp || getResp.success !== true) {
          if (!cancelled) {
            alert("Overlay multiplier GET failed.");
          }
          return;
        }

        if (cancelled) return;

        const payload = getResp.data;
        const arr: OverlayMultiplierApiRow[] = Array.isArray(payload)
          ? payload
          : [payload];

        const mapped: OverlayMultiplierRow[] = arr.map((r) => {
          const reportDate =
            r.report_date ||
            r.reportDate ||
            r.Period ||
            "";

          const odrPercent =
            r.odr_percent ??
            r.ODR ??
            r.odr ??
            0;

          const upsideVal =
            r.upside ?? r.Upside ?? r.best ?? r.Best ?? 0;
          const baseVal =
            r.base ?? r.Base ?? 0;
          const downsideVal =
            r.downside ?? r.Downside ?? r.worst ?? r.Worst ?? 0;

          return {
            reportDate,
            odrPercent,
            upside: upsideVal,
            base: baseVal,
            downside: downsideVal,
          };
        });

        setRows(mapped);
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          alert("Run overlay multiplier failed.");
        }
      } finally {
        if (!cancelled) {
          setPosting(false);
          setShouldRun(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [shouldRun, selectedWorkflowId, token]);

  // -----------------------------
  // Export CSV (all rows)
  // -----------------------------
  const exportCsv = useCallback(() => {
    if (!selectedWorkflowId || rows.length === 0) return;

    setExporting(true);
    try {
      const headers = [
        "report_date",
        "odr_percent",
        "multiplier_upside",
        "multiplier_base",
        "multiplier_downside",
      ];

      const escape = (val: unknown) => {
        if (val === null || val === undefined) return "";
        const s = String(val);
        if (s.includes('"') || s.includes(",") || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const csvRows = rows.map((row) => [
        row.reportDate,
        row.odrPercent,
        row.upside,
        row.base,
        row.downside,
      ]);

      const csv = [
        headers.join(","),
        ...csvRows.map((row) => row.map((v) => escape(v)).join(",")),
      ].join("\n");

      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `overlay_multiplier_${selectedWorkflowId}.csv`;
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
  }, [rows, selectedWorkflowId]);

  // -----------------------------
  // Button handler  just triggers the effect
  // -----------------------------
  const runOverlayMultiplier = useCallback(() => {
    if (!selectedWorkflowId) {
      alert("Select a workflow on Step 1 first.");
      return;
    }
    if (!token) {
      alert("Missing auth token.");
      return;
    }
    setPosting(true);
    setShouldRun(true);
  }, [selectedWorkflowId, token]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white">
        <div className="mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              Overlay Multiplier Calculate
            </h3>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {/* Run */}
            <button
              onClick={runOverlayMultiplier}
              disabled={posting || !selectedWorkflowId}
              className="cursor-pointer rounded-xl bg-gray-100 text-gray-900 border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1.5"
              title={
                !selectedWorkflowId
                  ? "Select a workflow on Step 1 first"
                  : "Run overlay multiplier calculation"
              }
            >
              <PlayCircleIcon className="h-4 w-4" />
              <span>{posting ? "Running" : "Run Overlay Multiplier"}</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={exportCsv}
              disabled={!exportReady || exporting || !selectedWorkflowId}
              className="cursor-pointer rounded-xl bg-white border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span>{exporting ? "Exporting" : "Export CSV"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto px-0 md:px-0 pb-8">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-5 md:px-6 md:py-6">
          {rows.length > 0 ? (
            <OverlayMultiplierSummary rows={rows} />
          ) : (
            <p className="text-sm text-gray-500">
              Click{" "}
              <span className="font-semibold">Run Overlay Multiplier</span>{" "}
              to calculate and display the results.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default Step5;
