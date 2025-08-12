import { useState, useEffect } from "react";
import ZoomSlider from "../../../components/ZoomSlider";
import TableTemplate2 from "../../../components/TableTemplate2";

import { useSelector } from "react-redux";
import { useAppSelector } from "../../../redux_toolkit/hooks";
import type { RootState } from "../../../redux_toolkit/store";

import { useStep9MigrationMatrix } from "../../../hooks/useStep9MigrationMatrix";
import Loader from "../../../components/Loader";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { downloadValidRowsExcel } from "../../../services/documents";

const Step9 = () => {
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

  const { data, error, isLoading } = useStep9MigrationMatrix(
    directoryPath || null,
    authToken || null
  );

  useEffect(() => {
    if (isLoading) {
      setStatus("loading");
      setStatusMessage("Loading migration matrix...");
    } else if (error) {
      setStatus("error");
      setStatusMessage("Failed to load migration matrix.");
    } else if (data) {
      setStatus("success");
      setStatusMessage("Migration matrix loaded successfully.");
    }
  }, [isLoading, error, data]);

  // Save month12_bucket4 values to localStorage on matrixByMonth change
  useEffect(() => {
    if (!data?.matrixByMonth) return;
    const month12Arr = data.matrixByMonth["Month 12"];
    if (!Array.isArray(month12Arr)) return;

    const dpd4Values = month12Arr.map((r) => r["91+ DPD_4"]);
    localStorage.setItem("month12_bucket4", JSON.stringify(dpd4Values));
  }, [data?.matrixByMonth]);

  const handleDownload = async () => {
    if (!data) return;
    try {
      setStatus("loading");
      setStatusMessage("Downloading data...");
      await downloadValidRowsExcel(data, "markov_chain");
      setStatus("success");
      setStatusMessage("Download complete.");
    } catch {
      setStatus("error");
      setStatusMessage("Download failed.");
    }
  };

  const { migrationMatrixAverage = [], matrixByMonth = {} } = data || {};

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

      {/* Download button */}
      <div className="flex justify-end items-center gap-4 mt-6 pl-4">
        <button
          onClick={handleDownload}
          disabled={isLoading}
          className={`bg-white cursor-pointer border border-gray-300 font-normal px-4 py-1 rounded-lg inline-flex items-center justify-center gap-1 ${
            isLoading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <ArrowDownTrayIcon className="w-5 h-5 font-normal" />
          Download
        </button>
      </div>

      {/* Error message */}
      {error && <p className="text-red-600 mt-4">Failed to fetch data</p>}

      {/* Data display */}
      {!isLoading && !error && data && (
        <div className="bg-[#f3f0ea] border border-gray-300 pr-4 py-4 rounded-lg mt-6 min-w-full max-w-full">
          <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-2" />
          <div className="grid grid-cols-2 gap-1 overflow-auto max-h-[750px] mt-4">
            <div className="w-full flex flex-col px-4 col-span-1">
              <h3 className="font-semibold mb-4">Average Transition Matrix</h3>
              <TableTemplate2
                data={migrationMatrixAverage}
                headersParams={[
                  "Bucket",
                  "0 DPD_0",
                  "1-30 DPD_1",
                  "31-60 DPD_2",
                  "61-90 DPD_3",
                  "91+ DPD_4",
                  "Total",
                ]}
                format="percentage"
                decimalPlaces={2}
                zoomLevel={zoom}
                setZoomLevel={setZoom}
              />
            </div>
            <div className="w-full flex flex-col px-4 col-span-1">
              <h3 className="font-semibold mb-4">Matrix Multiplication</h3>
              {Object.keys(matrixByMonth).map((monthKey) => (
                <div key={monthKey} className="mb-6">
                  <div className="flex flex-row w-full justify-between gap-2">
                    <span className="text-nowrap">{monthKey}</span>
                    <TableTemplate2
                      data={matrixByMonth[monthKey]}
                      headersParams={[
                        "Bucket",
                        "0 DPD_0",
                        "1-30 DPD_1",
                        "31-60 DPD_2",
                        "61-90 DPD_3",
                        "91+ DPD_4",
                        "Total",
                      ]}
                      format="percentage"
                      decimalPlaces={2}
                      zoomLevel={zoom}
                      setZoomLevel={setZoom}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Step9;
