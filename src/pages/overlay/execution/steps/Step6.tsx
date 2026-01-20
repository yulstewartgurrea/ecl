// src/pages/overlay/execution/Step6.tsx
import React, {
  useState,
  useCallback,
  useEffect,
} from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../redux_toolkit/store";
import { useAppSelector } from "../../../../redux_toolkit/hooks";

import PdCalibrationSummary, {
  type PdCalibrationRow,
} from "../../../../components/overlay/execution/final_model/PdCalibrationSummary";

import {
  postPdCalibration,
  getPdCalibration,
  type GetPdCalibrationRow,
} from "../../../../services/pdCalibration";

import {
  PlayCircleIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

const mapPdRows = (apiRows: GetPdCalibrationRow[]): PdCalibrationRow[] => {
  return apiRows.map((r) => ({
    bucket: r.Bucket ?? "",
    obligors:
      typeof r.Obligors === "number"
        ? r.Obligors
        : r.Obligors == null
        ? null
        : Number(r.Obligors) || null,
    ttcPd: r.ttc_pd != null ? String(r.ttc_pd) : "",
    flPitBest: r["FL PiT PD Best"],
    flPitBase: r["FL PiT PD Base"],
    flPitWorst: r["FL PiT PD Worst"],
  }));
};

const Step6: React.FC = () => {
  // read workflow_id + token
  const { currentPdTransitionMatrixWorkflowId: selectedWorkflowId } =
    useSelector((s: RootState) => s.pdTransitionMatrixWfHelper as any);
  const token = useAppSelector(
    (s) => (s as any)?.auth?.token
  ) as string | null;

  // button states
  const [posting, setPosting] = useState(false); // Run
  const [exporting, setExporting] = useState(false); // Export CSV
  const [exportReady, setExportReady] = useState(false);

  // PD calibration rows from GET
  const [rows, setRows] = useState<PdCalibrationRow[]>([]);

  // export is allowed once a workflow is selected AND we have data
  useEffect(() => {
    setExportReady(!!selectedWorkflowId && rows.length > 0);
  }, [selectedWorkflowId, rows]);

  // -------- Initial load logic: POST then GET automatically --------
  useEffect(() => {
    if (!selectedWorkflowId || !token) return;

    let cancelled = false;

    const autoRun = async () => {
      try {
        const postResp = await postPdCalibration(
          selectedWorkflowId,
          token
        );

        if (
          postResp &&
          postResp.code === 1 &&
          postResp.success === true &&
          postResp.msg === "Success"
        ) {
          const getResp = await getPdCalibration(
            selectedWorkflowId,
            token
          );

          if (!getResp || getResp.success !== true) return;

          const payload = getResp.data;
          const arr: GetPdCalibrationRow[] = Array.isArray(payload)
            ? payload
            : [payload];

          if (!cancelled) {
            setRows(mapPdRows(arr));
          }
        } else {
          console.log(
            "PD calibration auto POST did not return success; waiting for manual run."
          );
        }
      } catch (err) {
        console.error("Auto PD calibration failed:", err);
      }
    };

    autoRun();

    return () => {
      cancelled = true;
    };
  }, [selectedWorkflowId, token]);

  // -------- Export CSV (from current rows) --------
  const exportCsv = useCallback(() => {
    if (!selectedWorkflowId || rows.length === 0) return;

    setExporting(true);
    try {
      const headers = [
        "bucket",
        "obligors",
        "ttc_pd",
        "fl_pit_pd_best",
        "fl_pit_pd_base",
        "fl_pit_pd_worst",
      ];

      const escape = (val: string) => {
        if (val === "") return "";
        if (val.includes('"') || val.includes(",") || val.includes("\n")) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      };

      const csvRows = rows.map((r) => [
        r.bucket,
        r.obligors != null ? String(r.obligors) : "",
        r.ttcPd,
        r.flPitBest != null ? String(r.flPitBest) : "",
        r.flPitBase != null ? String(r.flPitBase) : "",
        r.flPitWorst != null ? String(r.flPitWorst) : "",
      ]);

      const csv = [
        headers.join(","),
        ...csvRows.map((row) => row.map(escape).join(",")),
      ].join("\n");

      const blob = new Blob([csv], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `pd_calibration_${selectedWorkflowId}.csv`;
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
  }, [selectedWorkflowId, rows]);

  // -------- Manual Run PD Calibration (button) --------
  const runPDCalibration = useCallback(async () => {
    if (!selectedWorkflowId) {
      alert("Select a workflow on Step 1 first.");
      return;
    }
    if (!token) {
      alert("Missing auth token.");
      return;
    }

    setPosting(true);
    try {
      const postResp = await postPdCalibration(
        selectedWorkflowId,
        token
      );

      if (
        !postResp ||
        postResp.code !== 1 ||
        postResp.success !== true ||
        postResp.msg !== "Success"
      ) {
        alert("PD Calibration POST did not return success.");
        return;
      }

      const getResp = await getPdCalibration(
        selectedWorkflowId,
        token
      );

      if (!getResp || getResp.success !== true) {
        alert("PD Calibration GET failed.");
        return;
      }

      const payload = getResp.data;
      const arr: GetPdCalibrationRow[] = Array.isArray(payload)
        ? payload
        : [payload];

      setRows(mapPdRows(arr));
    } catch (err) {
      console.error(err);
      alert("Run PD Calibration failed.");
    } finally {
      setPosting(false);
    }
  }, [selectedWorkflowId, token]);

  return (
    <div className="min-h-dvh bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="backdrop-blur supports-[backdrop-filter]:bg-white/70 bg-white">
        <div className="mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              PD Calibration
            </h3>
            <p className="text-sm text-gray-600">
              Calibrate TTC PD into forward-looking point-in-time PD per bucket
              and scenario.
            </p>
          </div>

          <div className="hidden md:flex items-center gap-3">
            {/* Run */}
            <button
              onClick={runPDCalibration}
              disabled={posting || !selectedWorkflowId}
              className="cursor-pointer rounded-xl bg-gray-100 text-gray-900 px-3 py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1.5"
              title={
                !selectedWorkflowId
                  ? "Select a workflow on Step 1 first"
                  : "Run PD Calibration"
              }
            >
              <PlayCircleIcon className="h-4 w-4" />
              <span>{posting ? "Runningâ€¦" : "Run PD Calibration"}</span>
            </button>

            {/* Export CSV */}
            <button
              onClick={exportCsv}
              disabled={!exportReady || exporting || !selectedWorkflowId}
              className="cursor-pointer rounded-xl bg-white border border-gray-300 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              <span>{exporting ? "Exportingâ€¦" : "Export CSV"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto px-0 md:px-0 pb-8">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-5 md:px-6 md:py-6">
          {rows.length > 0 ? (
            <PdCalibrationSummary rows={rows} />
          ) : (
            <p className="text-sm text-gray-500">
              Results will appear here after PD calibration runs.
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default Step6;
