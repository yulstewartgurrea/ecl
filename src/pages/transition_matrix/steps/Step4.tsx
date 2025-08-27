import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../redux_toolkit/store";
import { useAppSelector } from "../../../redux_toolkit/hooks";

import { usePivotedConsolidatedRows } from "../../../hooks/usePivotedConsolidatedRows";

import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import Loader from "../../../components/Loader";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { downloadValidRowsExcel } from "../../../services/documents";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";

const Step4 = () => {
  const [zoom, setZoom] = useState(0.9);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);

  const authToken = useAppSelector((state) => state.auth.token);
  const directoryPath = `/${entity}/${period}/${workflowName}`;

  const { data, error, isLoading } = usePivotedConsolidatedRows(
    directoryPath,
    authToken
  );
  useEffect(() => {
    const storageKey = "for_step_3";
    localStorage.setItem(storageKey, "false");
  }, []);
  // 🟢 Sync API status with fetch
  useEffect(() => {
    if (isLoading) {
      setStatus("loading");
      setStatusMessage("Fetching pivoted consolidated rows...");
    } else if (error) {
      setStatus("error");
      setStatusMessage("Failed to fetch pivoted consolidated data.");
    } else if (data) {
      setStatus("success");
      setStatusMessage("Pivoted data loaded successfully.");
    }
  }, [isLoading, error, data]);

  // 🔹 Download handler
  const handleDownload = async () => {
    if (!data) return;
    try {
      setStatus("loading");
      setStatusMessage("Downloading pivoted file...");
      await downloadValidRowsExcel(data, "pivoting_file");
      setStatus("success");
      setStatusMessage("Download complete.");
    } catch (err) {
      setStatus("error");
      setStatusMessage("Download failed.");
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-[1400px] mx-auto relative">
        {/* API Status Indicator */}
        <ApiStatusIndicator
          status={status}
          message={statusMessage}
          onHide={() => setStatus("idle")}
        />

        {/* Loader overlay */}
        {isLoading && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
            <div className="rounded-lg bg-white p-6 shadow-lg flex items-center gap-4">
              <Loader />
              <div>
                <div className="text-sm font-medium text-gray-700">
                  Loading default rate data
                </div>
                <div className="text-xs text-gray-500">
                  This may take a moment depending on dataset size.
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start justify-between gap-4 b-10">
          <div>
            <p className="text-sm text-gray-500 mt-1">
              Average and month-by-month transition matrices.
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
              <span className="px-2 py-1 bg-white border border-gray-200 rounded-md">
                {entity || "—"}
              </span>
              <span className="px-2 py-1 bg-white border border-gray-200 rounded-md">
                {period || "—"}
              </span>
              <span className="px-2 py-1 bg-white border border-gray-200 rounded-md">
                {workflowName || "—"}
              </span>
            </div>
          </div>

          {/* Top Buttons */}
          <div className="flex justify-end items-center gap-4  pl-4">
            <button
              onClick={handleDownload}
              className="bg-white cursor-pointer border border-gray-300 px-4 py-1 rounded-lg inline-flex items-center gap-1"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Download
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-100 text-red-700 rounded-lg mb-4">
            Failed to fetch data.
          </div>
        )}

        {/* Content */}
        {!isLoading && !error && (
          <>
            <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-2" />
            <TableTemplate1
              data={data}
              format="decimal"
              decimalPlaces={0}
              zoomLevel={zoom}
              setZoomLevel={setZoom}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Step4;
