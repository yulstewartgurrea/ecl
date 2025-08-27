import { FunnelIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../redux_toolkit/store";

// hooks
import { useValidRows } from "../../../hooks/useValidRows";

// components
import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import Loader from "../../../components/Loader";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { downloadValidRowsExcel } from "../../../services/documents";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";

const FILTER_FIELDS = [
  "Present in a per CIS/Borrower Basis (for debtor assessment)",
  "Days in Arrears",
  "Outstanding Balance",
  "Principal Amount",
  "Value of Security (collateral information)",
  "Actual Amount of Repayment",
  "Source of Repayment",
];

const Step3 = () => {
  const [zoom, setZoom] = useState(0.9);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);

  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);

  const directoryPath = `/${entity}/${period}/${workflowName}`;
  const { data, isLoading, error } = useValidRows(directoryPath);

  useEffect(() => {
    if (isLoading) {
      setStatus("loading");
      setStatusMessage("Fetching valid rows...");
    } else if (error) {
      setStatus("error");
      setStatusMessage(
        error?.response?.status === 401
          ? "Unauthorized. Please log in again."
          : "Failed to fetch data."
      );
    } else if (data) {
      setStatus("success");
      setStatusMessage("Data loaded successfully.");
    }
  }, [isLoading, error, data]);

  const handleDownload = async () => {
    if (!data) return;
    try {
      setStatus("loading");
      setStatusMessage("Downloading file...");
      await downloadValidRowsExcel(data, "valid_file");
      setStatus("success");
      setStatusMessage("Download complete.");
    } catch {
      setStatus("error");
      setStatusMessage("Download failed.");
    }
  };

  const toggleFilter = (field: string) => {
    setSelectedFilters((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
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
                  Loading valid rows data
                </div>
                <div className="text-xs text-gray-500">
                  This may take a moment depending on dataset size.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <p className="text-sm text-gray-500 mt-1">
              Average and month-by-month transition matrices.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
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

          {/* Download Button */}
          <div className="flex justify-end items-center gap-4">
            <button
              onClick={handleDownload}
              className="bg-white cursor-pointer border border-gray-300 px-4 py-1 rounded-lg inline-flex items-center gap-1"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Download
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="col-span-3 space-y-4 mb-6">
          <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <FunnelIcon className="w-4 h-4" /> Filters
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {FILTER_FIELDS.map((field) => (
                <label
                  key={field}
                  className="flex items-center gap-2 text-xs cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="accent-gray-400"
                    checked={selectedFilters.includes(field)}
                    onChange={() => toggleFilter(field)}
                  />
                  {field}
                </label>
              ))}
            </div>
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
              zoomLevel={zoom}
              setZoomLevel={setZoom}
            />
          </>
        )}
      </div>
    </div>
  );
};

export default Step3;
