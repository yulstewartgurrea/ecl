import { useEffect, useState, useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../redux_toolkit/store";
import { useAppSelector } from "../../../redux_toolkit/hooks";

// components
import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import DpdTable from "../../../components/DpdTable";
import Loader from "../../../components/Loader";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";

// hooks & services
import { useProcessedRowsStep6 } from "../../../hooks/useProcessedRowsStep6";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { downloadValidRowsExcel } from "../../../services/documents";

const Step6 = () => {
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

  const { data, error, isLoading } = useProcessedRowsStep6(
    directoryPath || null,
    authToken || null
  );

  // Function to check if a string is a date in yyyy-mm-dd format
  const isDateFormat = (str: string): boolean => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return dateRegex.test(str);
  };

  // Function to check if a string is a date with "dpd" suffix (with space or underscore)
  const isDateWithDpd = (str: string): boolean => {
    const dateWithDpdRegex = /^\d{4}-\d{2}-\d{2}\s*dpd$/i;
    return dateWithDpdRegex.test(str);
  };

  // Transform data headers from yyyy-mm-dd to yyyy-mm-dd_dpd
  const transformedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return data;

    return data.map((row: any) => {
      const transformedRow: any = {};
      
      Object.keys(row).forEach((key) => {
        if (isDateFormat(key)) {
          // Transform date headers to include _dpd suffix
          transformedRow[`${key}-dpd`] = row[key];
        } else if (isDateWithDpd(key)) {
          // Fix existing date headers that have "dpd" with space to use underscore
          const datePart = key.replace(/\s*dpd$/i, '');
          transformedRow[`${datePart}-dpd`] = row[key];
        } else {
          // Keep non-date headers as is
          transformedRow[key] = row[key];
        }
      });
      
      return transformedRow;
    });
  }, [data]);

  
  useEffect(() => {
    if (isLoading) {
      setStatus("loading");
      setStatusMessage("Fetching processed rows...");
    } else if (error) {
      setStatus("error");
      setStatusMessage("Failed to fetch data.");
    } else if (data) {
      setStatus("success");
      setStatusMessage("Data loaded successfully.");
    }
  }, [isLoading, error, data]);

  const handleDownload = async () => {
    if (!data) return;
    try {
      setStatus("loading");
      setStatusMessage("Downloading everbad file...");
      await downloadValidRowsExcel(data, "everbad");
      setStatus("success");
      setStatusMessage("Download complete.");
    } catch {
      setStatus("error");
      console.log(transformedData)
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
            {/* Zoom + Main Table */}
            <div className="bg-white p-2 mt-2 rounded-lg shadow-md">
              <div className="justify-start">
                <DpdTable />
                <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/5" />
              </div>
              <TableTemplate1
                data={data}
                format="decimal"
                decimalPlaces={0}
                zoomLevel={zoom}
                setZoomLevel={setZoom}
                enablePagination={true}
                itemsPerPage={100}
                showPaginationInfo={true}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Step6;
