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
    <div className="w-full min-h-screen bg-[#f3f0ea] border border-gray-300 rounded-b-md border-t-0 px-6 py-4 relative">
      {/* API Status Indicator */}
      <ApiStatusIndicator
        status={status}
        message={statusMessage}
        onHide={() => setStatus("idle")}
      />

      {/* Loader overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#f3f0ea]/50 z-10">
          <Loader />
        </div>
      )}

      <div className="flex justify-end items-center gap-4 mt-6 pl-4">
        <button
          onClick={handleDownload}
          className="bg-white cursor-pointer border border-gray-300 font-normal px-4 py-1 rounded-lg inline-flex items-center justify-center gap-1"
        >
          <ArrowDownTrayIcon className="w-5 h-5 font-normal" />
          Download
        </button>
      </div>

      {error && <p>Failed to fetch data</p>}

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
  );
};

export default Step4;
