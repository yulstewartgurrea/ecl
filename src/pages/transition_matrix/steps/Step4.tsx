import { useEffect, useState, useMemo } from "react";
import { TmPivotingAbout } from "../../../components/about/TransitionMatrixAbout";
import { useSelector } from "react-redux";
import type { RootState } from "../../../redux_toolkit/store";
import { useAppDispatch, useAppSelector } from "../../../redux_toolkit/hooks";
import { updateModuleData } from "../../../redux_toolkit/features/workflow/workflowSlice";

import { usePivotedConsolidatedRows } from "../../../hooks/usePivotedConsolidatedRows";

import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import { downloadValidRowsExcel } from "../../../services/documents";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";
import SkeletonTable from "../../../components/SkeletonTable";

const Step4 = () => {
  const dispatch = useAppDispatch();
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

  // Transform data headers from yyyy-mm-dd to yyyy-mm-dd_dpd and sort ascending
  const transformedData = useMemo(() => {
    if (!data || !Array.isArray(data)) return data;

    // Step 1: Normalize headers per row
    const normalized = data.map((row: any) => {
      const transformedRow: any = {};

      Object.keys(row).forEach((key) => {
        if (isDateFormat(key)) {
          transformedRow[`${key}-dpd`] = row[key];
        } else if (isDateWithDpd(key)) {
          const datePart = key.replace(/\s*dpd$/i, "");
          transformedRow[`${datePart}-dpd`] = row[key];
        } else {
          transformedRow[key] = row[key];
        }
      });

      return transformedRow;
    });

    if (normalized.length === 0) return normalized;

    // Step 2: Extract all keys
    const allKeys = Object.keys(normalized[0]);

    // Step 3: Separate date headers and sort them (ascending)
    const dateKeys = allKeys
      .filter((key) => /^\d{4}-\d{2}-\d{2}-dpd$/.test(key))
      .sort((a, b) => new Date(a.replace("-dpd", "")).getTime() - new Date(b.replace("-dpd", "")).getTime());

    // Step 4: Non-date keys stay in their order
    const nonDateKeys = allKeys.filter((key) => !/^\d{4}-\d{2}-\d{2}-dpd$/.test(key));

    const sortedKeys = [...nonDateKeys, ...dateKeys];

    // Step 5: Rebuild rows with sorted keys
    return normalized.map((row) => {
      const sortedRow: any = {};
      sortedKeys.forEach((key) => {
        sortedRow[key] = row[key];
      });
      return sortedRow;
    });
  }, [data]);

  
  useEffect(() => {
    dispatch(
      updateModuleData({
        moduleId: "transitionMatrix",
        data: { forStep3: false },
      })
    );
  }, [dispatch]);
  // 🟢 Sync API status with fetch
  useEffect(() => {
    console.log(data)
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
        {/* {isLoading && (
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
        )} */}

        <div className="flex items-start justify-between gap-4 b-10">
          <div>
            <div className="mb-3">
              <TmPivotingAbout />
            </div>
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
       { !error && (
          <>
            {/* Zoom + Main Table */}
            <div className="bg-white p-6 rounded-lg shadow-md">
              <div className="flex justify-end mb-4">
                <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/5" />
              </div>
              {isLoading ? (
                <SkeletonTable
                  title="Loading Results"
                  rows={10}
                  cols={7}
                  showHeader
                  showIndexCol
                  heightClass="max-h-[70vh]"
                />
              ) : (
              <TableTemplate1
                data={transformedData}
                format="decimal"
                decimalPlaces={0}
                zoomLevel={zoom}
                setZoomLevel={setZoom}
                enablePagination={true}
                itemsPerPage={100}
                showPaginationInfo={true}
              />
              )}

            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default Step4;
