// src/pages/overlay/execution/Step7.tsx
import React, {
  useState,
  useCallback,
  useEffect,
} from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import { useAppSelector } from "../../../../redux_toolkit/hooks";

import FlPitPdSummary, {
  type FlPitBucketRow,
} from "../../../../components/overlay/execution/final_model/FlPitPdSummary";

import {
  getFinalPitPd,
  type FinalPitPdApiRow,
} from "../../../../services/finalPitPd";

import {
  PlayCircleIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

const Step7: React.FC = () => {
  // read workflow_id + token
  const { currentPdTransitionMatrixWorkflowId: selectedWorkflowId } =
    useSelector((s: RootState) => s.pdTransitionMatrixWfHelper as any);

  const token = useAppSelector(
    (s) => (s as any)?.auth?.token
  ) as string | null;

  // button states
  const [posting, setPosting] = useState(false); // Run / refresh
  const [exporting, setExporting] = useState(false); // Export CSV
  const [exportReady, setExportReady] = useState(false);

  // final PiT PD rows from backend
  const [pitRows, setPitRows] = useState<FlPitBucketRow[]>([]);

  // map API rows → component rows
  const mapApiToRows = (rows: FinalPitPdApiRow[]): FlPitBucketRow[] =>
    rows.map((r) => ({
      bucket: r.Bucket,
      best: r["FL PiT PD Best"],
      base: r["FL PiT PD Base"],
      worst: r["FL PiT PD Worst"],
    }));

  const loadFinalPitPd = useCallback(async () => {
    if (!selectedWorkflowId) return;
    try {
      console.log(
        "[Step7] Loading final PiT PD for workflow",
        selectedWorkflowId
      );
      const apiRows = await getFinalPitPd(
        selectedWorkflowId,
        token ?? null
      );
      setPitRows(mapApiToRows(apiRows));
    } catch (err) {
      console.error("[Step7] Failed to load final PiT PD", err);
      alert("Failed to load final PiT PD.");
    }
  }, [selectedWorkflowId, token]);

  // initial load when workflow is selected
  useEffect(() => {
    setExportReady(!!selectedWorkflowId);
    if (selectedWorkflowId) {
      void loadFinalPitPd();
    }
  }, [selectedWorkflowId, loadFinalPitPd]);

  // ---- Export CSV ----
  const exportCsv = useCallback(() => {
    if (!selectedWorkflowId) return;

    setExporting(true);
    try {
      const headers = ["bucket", "best", "base", "worst"];

      const rows = pitRows.map((r) => ({
        bucket: r.bucket,
        best: r.best,
        base: r.base,
        worst: r.worst,
      }));

      const escape = (val: unknown) => {
        if (val === null || val === undefined) return "";
        const s = String(val);
        if (s.includes('"') || s.includes(",") || s.includes("\n")) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const csv = [
        headers.join(","),
        ...rows.map((row) =>
          headers.map((h) => escape((row as any)[h])).join(",")
        ),
      ].join("\n");

      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fl_pit_pds_${selectedWorkflowId ?? "export"}.csv`;
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
  }, [selectedWorkflowId, pitRows]);

  // ---- Run PiT PD (manual refresh) ----
  const runPDCalibration = useCallback(async () => {
    if (!selectedWorkflowId) return;
    setPosting(true);
    try {
      // here we just reload the final PiT PD from backend
      await loadFinalPitPd();
    } catch (err) {
      console.error(err);
      alert("Run PiT PD failed.");
    } finally {
      setPosting(false);
    }
  }, [selectedWorkflowId, loadFinalPitPd]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white">
        <div className="mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">FL PiT PDs</h3>
            <p className="text-sm text-gray-600">
              The results of PD calibration are the Forward-Looking
              Point-in-Time PDs by bucket and scenario.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {/* Run / Refresh */}
            <button
              onClick={runPDCalibration}
              disabled={posting || !selectedWorkflowId}
              className="cursor-pointer rounded-xl bg-gray-900 text-white px-3 py-2 text-sm font-medium hover:bg-black disabled:opacity-50 flex items-center gap-1.5"
              title={
                !selectedWorkflowId
                  ? "Select a workflow on Step 1 first"
                  : "Refresh PiT PD"
              }
            >
              <PlayCircleIcon className="h-4 w-4" />
              <span>{posting ? "Running…" : "Run PiT PD"}</span>
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

      {/* Main content */}
      <main className="mx-auto px-0 md:px-0 pb-8">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-5 md:px-6 md:py-6">
          <FlPitPdSummary rows={pitRows} />
        </div>
      </main>
    </div>
  );
};

export default Step7;