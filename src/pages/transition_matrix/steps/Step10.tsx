// Step10.tsx (notes moved beneath TTC Table)
import React, { useState } from "react";
import { TmTtcPdAbout } from "../../../components/about/TransitionMatrixAbout";
import {
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline";

import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import LineGraph from "../../../components/visuals/LineGraph";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";

import { useMonth12Bucket4 } from "../../../hooks/useMonth12Bucket4";

type DpdRow = {
  "Aging bucket": string;
  "TTC PD": number;
};

const Step10: React.FC = () => {
  const [zoom, setZoom] = useState(0.9);
  const ttcData: DpdRow[] = useMonth12Bucket4();

  // local UI status for save / download feedback
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // prepare chart data for LineGraph (kept like your original)
  const prepareChartDataForLineGraph = (data: DpdRow[]) => {
    const xValues = data.map((item) => item["Aging bucket"]);
    const yValues = [
      {
        label: "TTC PD",
        data: data.map((item) => item["TTC PD"]),
        borderColor: "rgba(255, 204, 0, 1)",
        backgroundColor: "rgba(255, 204, 0, 0.5)",
        fill: false,
        tension: 0.1,
      },
    ];
    return { xValues, yValues };
  };

  const { xValues, yValues } = prepareChartDataForLineGraph(ttcData);

  // Save progress locally (non-destructive)
  // const handleSaveProgress = () => {
  //   try {
  //     setStatus("loading");
  //     setStatusMessage("Saving progress...");
  //     setStatus("success");
  //     setStatusMessage("Progress saved locally.");
  //     setTimeout(() => {
  //       setStatus("idle");
  //       setStatusMessage("");
  //     }, 1400);
  //   } catch (err) {
  //     console.error(err);
  //     setStatus("error");
  //     setStatusMessage("Failed to save progress.");
  //     setTimeout(() => {
  //       setStatus("idle");
  //       setStatusMessage("");
  //     }, 2200);
  //   }
  // };

  // Download CSV helper — client side only
  const downloadCSV = (rows: DpdRow[], filename = "ttc_pd.csv") => {
    try {
      setStatus("loading");
      setStatusMessage("Preparing download...");
      const headers = ["Aging bucket", "TTC PD"];
      const csv = [
        headers.join(","),
        ...rows.map((r) =>
          [
            `"${String(r["Aging bucket"]).replace(/"/g, '""')}"`,
            typeof r["TTC PD"] === "number"
              ? r["TTC PD"]
              : `"${String(r["TTC PD"]).replace(/"/g, '""')}"`,
          ].join(",")
        ),
      ].join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.setAttribute("download", filename);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setStatus("success");
      setStatusMessage("Download ready.");
      setTimeout(() => {
        setStatus("idle");
        setStatusMessage("");
      }, 1400);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setStatusMessage("Download failed.");
      setTimeout(() => {
        setStatus("idle");
        setStatusMessage("");
      }, 1800);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 px-6 py-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header + status */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3">
              <TmTtcPdAbout />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Visualize TTC PD for Month 12 bucket-4 and export or save locally.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <ApiStatusIndicator
              status={status}
              message={statusMessage}
              onHide={() => {
                setStatus("idle");
                setStatusMessage("");
              }}
            />

            <button
              type="button"
              onClick={() => downloadCSV(ttcData, "ttc_pd.csv")}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm font-medium bg-white border border-gray-300 hover:bg-gray-50 transition focus:outline-none focus:ring-2 focus:ring-offset-1  cursor-pointer"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              <span className="text-sm">Download</span>
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="w-1/3">
            <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-full" />
          </div>
          <div className="text-sm text-gray-600">
            Zoom: <span className="font-medium">{Math.round(zoom * 100)}%</span>
          </div>
        </div>

        {/* Main layout */}
        <div className="w-full grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Table (left) */}
          <div className="col-span-2 flex items-start justify-center">
            <div className="w-full space-y-4">
              <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-gray-700">
                    TTC Table
                  </div>
                  <div className="text-xs text-gray-500">
                    {ttcData?.length ?? 0} rows
                  </div>
                </div>

                <TableTemplate1
                  data={ttcData}
                  format="percentage"
                  decimalPlaces={2}
                  additionalCss={{ firstColColor: "bg-gray-100" }}
                  zoomLevel={zoom}
                  setZoomLevel={setZoom}
                />
              </div>

              {/* Notes moved below the TTC Table */}
              <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
                <h4 className="text-sm font-semibold text-gray-700">Notes</h4>

                <p className="text-xs text-gray-500 mt-2">
                  Use{" "}
                  <span className="font-medium">Ctrl + mouse wheel</span> to
                  adjust zoom.
                </p>

                <details
                  className="mt-3 bg-gray-50 p-3 rounded border border-gray-100 text-xs"
                  role="region"
                  aria-label="Aging bucket definition"
                >
                  <summary className="font-medium cursor-pointer">
                    What is an “Aging bucket”?
                  </summary>

                  <div className="mt-2 text-gray-700">
                    <ul className="list-disc pl-5 space-y-1">
                      <li>
                        <strong>Bucket</strong>: groups accounts by Days Past
                        Due (DPD).
                      </li>
                      <li>
                        <strong>0 DPD</strong> — current (no past due).
                      </li>
                      <li>
                        <strong>1–30 DPD</strong> — 1 to 30 days past due.
                      </li>
                      <li>
                        <strong>31–60 DPD</strong> — 31 to 60 days past due.
                      </li>
                      <li>
                        <strong>61–90 DPD</strong> — 61 to 90 days past due.
                      </li>
                      <li>
                        <strong>91+ DPD</strong> — 91 days or more past due
                        (typically considered default / bucket 4).
                      </li>
                    </ul>

                    <p className="mt-2 text-gray-600">
                      Column labels like <code>1-30 DPD_1</code> pair the human
                      label with an internal id. When you see references such as{" "}
                      <em>“Month 12 — Bucket 4”</em>, that means the 12th month
                      snapshot for the <strong>91+ DPD</strong> bucket.
                    </p>
                  </div>
                </details>
              </div>
            </div>
          </div>

          {/* Chart (right) */}
          <div className="col-span-3">
            <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium text-gray-700">
                  TTC PD Chart
                </div>
                <div className="text-xs text-gray-500">Aging buckets</div>
              </div>

              <div className="w-full h-[460px]">
                <LineGraph
                  xValues={xValues}
                  yValues={yValues}
                  dataLabel="TTC PD"
                  xAxisLabel="Aging Bucket"
                  yAxisLabel="TTC PD"
                  title="TTC PD by Aging Bucket"
                  showYLabels
                  yAxisLabelFormat="percent"
                  format="percent"
                  showPointLabels
                  chartAreaBackgroundColor="#f9fafb"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Tip: use <span className="font-medium">Ctrl + mouse wheel</span> to
          change zoom.
        </div>
      </div>
    </div>
  );
};

export default Step10;
