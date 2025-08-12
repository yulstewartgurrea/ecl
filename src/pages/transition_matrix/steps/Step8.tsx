import { useState, useEffect } from "react";
import ZoomSlider from "../../../components/ZoomSlider";
import TransitionMatrixPercentageCountTable from "../../../components/transition_matrix_components/TransitionMatrixPercentageCountTable";
import TableTemplate2 from "../../../components/TableTemplate2";

import { useSelector } from "react-redux";
import { useAppSelector } from "../../../redux_toolkit/hooks";
import type { RootState } from "../../../redux_toolkit/store";

import { useStep8MigrationData } from "../../../hooks/useStep8MigrationData";
import Loader from "../../../components/Loader";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { downloadValidRowsExcelv2 } from "../../../services/documents";

const Step8 = () => {
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

  const { data, error, isLoading } = useStep8MigrationData(
    directoryPath || null,
    authToken || null
  );

  useEffect(() => {
    if (isLoading) {
      setStatus("loading");
      setStatusMessage("Loading migration data...");
    } else if (error) {
      setStatus("error");
      setStatusMessage("Failed to load migration data.");
    } else if (data) {
      setStatus("success");
      setStatusMessage("Migration data loaded successfully.");
    }
  }, [isLoading, error, data]);

  const handleDownload = async () => {
    if (!data) return;
    try {
      setStatus("loading");
      setStatusMessage("Downloading data...");
      await downloadValidRowsExcelv2(data, "matrix_construction");
      setStatus("success");
      setStatusMessage("Download complete.");
    } catch {
      setStatus("error");
      setStatusMessage("Download failed.");
    }
  };

  const {
    migrationMatrixData = [],
    migrationMatrixPercentage = [],
    migrationMatrixAverage = [],
  } = data || {};

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
      {error && (
        <p className="text-red-600 mt-4">Failed to fetch migration data</p>
      )}

      {/* Data display */}
      {!isLoading && !error && data && (
        <div className="flex flex-col w-full mt-6">
          <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-1" />
          <div className="px-4 py-1 min-w-full min-h-full overflow-auto">
            <div className="w-full flex flex-row space-x-16">
              {[
                "Transition Matrix - Count",
                "Transition Matrix - Percentage",
                "Average Transition Matrix",
              ].map((title, typeIndex) => (
                <div key={typeIndex}>
                  <div className="w-full flex flex-row justify-start items-center space-x-12">
                    <h1 className="text-xl font-bold mb-4">{typeIndex + 1}</h1>
                    <h1 className="text-xl font-bold mb-4">{title}</h1>
                  </div>
                  <div className="w-full flex flex-col space-y-4">
                    {typeIndex === 0 ? (
                      migrationMatrixData.map((data: any, monthIndex: any) => (
                        <TransitionMatrixPercentageCountTable
                          key={`${typeIndex}-${monthIndex}`}
                          data={data}
                          format="number"
                          decimalPlaces={0}
                          zoomLevel={zoom}
                          setZoomLevel={setZoom}
                        />
                      ))
                    ) : typeIndex === 1 ? (
                      migrationMatrixPercentage.map(
                        (data: any, monthIndex: any) => (
                          <TransitionMatrixPercentageCountTable
                            key={`${typeIndex}-${monthIndex}`}
                            data={data}
                            format="percentage"
                            decimalPlaces={2}
                            zoomLevel={zoom}
                            setZoomLevel={setZoom}
                          />
                        )
                      )
                    ) : (
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
                    )}
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

export default Step8;
