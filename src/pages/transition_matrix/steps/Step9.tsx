import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import ZoomSlider from "../../../components/ZoomSlider";
import TableTemplate2 from "../../../components/TableTemplate2";

import { useSelector } from "react-redux";
import { useAppDispatch, useAppSelector } from "../../../redux_toolkit/hooks";
import { updateModuleData } from "../../../redux_toolkit/features/workflow/workflowSlice";
import type { RootState } from "../../../redux_toolkit/store";

import { useStep9MigrationMatrix } from "../../../hooks/useStep9MigrationMatrix";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";
import { downloadValidRowsExcel } from "../../../services/documents";
import SkeletonTable from "../../../components/SkeletonTable";

const Step9: React.FC = () => {
  const dispatch = useAppDispatch();
  const [zoom, setZoom] = useState(0.9);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // multi-select months (Set for O(1) add/remove checks)
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  // average matrix toggle
  const [showAverage, setShowAverage] = useState<boolean>(true);

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

  // Save month12_bucket4 values in Redux on matrixByMonth change
  useEffect(() => {
    if (!data?.matrixByMonth) return;
    const month12Arr = data.matrixByMonth["Month 12"];
    if (!Array.isArray(month12Arr)) return;
    const dpd4Values = month12Arr.map((r) => r["91+ DPD_4"]);
    dispatch(
      updateModuleData({
        moduleId: "transitionMatrix",
        data: { month12Bucket4: dpd4Values },
      })
    );
  }, [data?.matrixByMonth, dispatch]);

  const handleDownload = async () => {
    if (!data) return;
    try {
      setStatus("loading");
      setStatusMessage("Downloading data...");
      await downloadValidRowsExcel(data, "markov_chain");
      setStatus("success");
      setStatusMessage("Download complete.");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setStatusMessage("Download failed.");
    }
  };

  const { migrationMatrixAverage = [], matrixByMonth = {} } = data || {};

  // month keys sorted for consistent UI
  const monthKeys = React.useMemo(
    () => Object.keys(matrixByMonth || {}),
    [matrixByMonth]
  );

  // refs so we can scroll/focus selected months
  const monthRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const setMonthRef = (key: string) => (el: HTMLDivElement | null) => {
    monthRefs.current[key] = el;
  };

  // when selectedMonths changes, scroll to the first selected month (if any)
  useEffect(() => {
    if (selectedMonths.size === 0) return;
    const first = Array.from(selectedMonths)[0];
    const el = monthRefs.current[first];
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [selectedMonths]);

  const toggleMonth = (key: string) => {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearMonths = () => setSelectedMonths(new Set());
  const selectAllMonths = () => setSelectedMonths(new Set(monthKeys));

  return (
    <div className="w-full min-h-screen bg-gray-50 px-6 py-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
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

          <div className="flex items-center gap-3">
            <ApiStatusIndicator
              status={status}
              message={statusMessage}
              onHide={() => setStatus("idle")}
            />
            <button
              onClick={handleDownload}
              disabled={isLoading}
              className={clsx(
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm font-medium transition",
                isLoading
                  ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                  : "bg-white border border-gray-300 hover:bg-gray-50"
              )}
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              <span>Download</span>
            </button>
          </div>
        </div>

        {/* Main grid */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left controls */}
          <aside className="space-y-4">
            <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">
                    Display Controls
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Zoom & focus options
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-full" />
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-gray-600">Zoom</span>
                <span className="font-medium text-gray-700">
                  {Math.round(zoom * 100)}%
                </span>
              </div>
            </div>

            {/* Clickable summary / filters */}
            <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-700">
                Data Summary (multi-select months)
              </h4>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowAverage((s) => !s)}
                  aria-pressed={showAverage}
                  className={clsx(
                    "p-3 rounded border text-left focus:outline-none focus:ring-2 focus:ring-offset-1",
                    showAverage
                      ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300"
                      : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                  )}
                >
                  <div className="text-xs text-gray-500">Average Matrix</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {migrationMatrixAverage?.length ?? 0} rows
                  </div>
                </button>

                <div className="p-3 rounded border bg-gray-50 border-gray-100">
                  <div className="text-xs text-gray-500">Matrix Months</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {monthKeys.length} months
                  </div>
                </div>
              </div>

              {/* month controls */}
              {monthKeys.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"
                      onClick={selectAllMonths}
                      className="text-xs px-2 py-1 rounded-md border bg-white border-gray-100 hover:bg-gray-50"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={clearMonths}
                      className="text-xs px-2 py-1 rounded-md border bg-white border-gray-100 hover:bg-gray-50"
                    >
                      Clear
                    </button>
                    <div className="text-xs text-gray-500 ml-auto">
                      Selected: {selectedMonths.size}
                    </div>
                  </div>

                  <div className="space-y-2 max-h-40 overflow-auto">
                    <div className="flex flex-wrap gap-2">
                      {monthKeys.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => toggleMonth(m)}
                          className={clsx(
                            "text-xs px-2 py-1 rounded-md border focus:outline-none focus:ring-2 focus:ring-offset-1",
                            selectedMonths.has(m)
                              ? "bg-indigo-600 text-white border-indigo-600"
                              : "bg-white border-gray-100 hover:bg-gray-50"
                          )}
                          aria-pressed={selectedMonths.has(m)}
                          title={`Toggle ${m}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-3 text-xs text-gray-500">
                Tip: select multiple months to display several matrices at once.
                Use <span className="font-medium">Select all</span> to quickly
                show everything.
              </div>
            </div>

            <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-700">Notes</h4>
              <p className="text-xs text-gray-500 mt-2">
                No changes were made to the matrix calculations. Zoom uses{" "}
                <span className="font-medium">Ctrl + mouse wheel</span>.
              </p>
            </div>
          </aside>

          {/* Right content */}
          <main className="space-y-4">
            {/* Average matrix card */}
            {showAverage && (
              <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800">
                    Average Transition Matrix
                  </h3>
                  <div className="text-sm text-gray-500">
                    {migrationMatrixAverage?.length ?? 0} rows
                  </div>
                </div>

                <div className="mt-4">
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
            )}

            {/* Matrix by month section - render either all months (if none selected) or selectedMonths */}
            <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-800">
                  Matrix Multiplication
                </h3>
                <div className="text-sm text-gray-500">
                  {monthKeys.length} months
                </div>
              </div>

              <div className="mt-4 space-y-6">
                {(selectedMonths.size === 0
                  ? monthKeys
                  : Array.from(selectedMonths)
                ).map((monthKey) => {
                  const monthData = matrixByMonth[monthKey] ?? [];
                  return (
                    <div
                      key={monthKey}
                      ref={setMonthRef(monthKey)}
                      className={clsx(
                        "p-2 rounded-md border border-gray-100",
                        selectedMonths.has(monthKey)
                          ? "ring-1 ring-indigo-200"
                          : ""
                      )}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-sm">{monthKey}</div>
                        <div className="text-xs text-gray-500">
                          {monthData.length} rows
                        </div>
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
                           <TableTemplate2
                        data={monthData}
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
                  );
                })}
              </div>
            </div>
          </main>
        </div>

        {/* Loading overlay */}
        {/* {isLoading && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
            <div className="rounded-lg bg-white p-6 shadow-lg flex items-center gap-4">
              <Loader />
              <div>
                <div className="text-sm font-medium text-gray-700">
                  Loading migration data
                </div>
                <div className="text-xs text-gray-500">
                  This may take a moment depending on the dataset size.
                </div>
              </div>
            </div>
          </div>
        )} */}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 mt-4">
            Failed to fetch migration data
          </p>
        )}
      </div>
    </div>
  );
};

export default Step9;
