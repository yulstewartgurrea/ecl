// Step8.tsx (replace your existing Step8 with this)
import React, { useEffect, useState } from "react";
import { TmMatrixConstructionAbout } from "../../../components/about/TransitionMatrixAbout";
import clsx from "clsx";
import { ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import ZoomSlider from "../../../components/ZoomSlider";
import TransitionMatrixPercentageCountTable from "../../../components/transition_matrix_components/TransitionMatrixPercentageCountTable";
import TableTemplate2 from "../../../components/TableTemplate2";

import { useSelector } from "react-redux";
import { useAppSelector } from "../../../redux_toolkit/hooks";
import type { RootState } from "../../../redux_toolkit/store";

import { useStep8MigrationData } from "../../../hooks/useStep8MigrationData";
import ApiStatusIndicator from "../../../components/ApiStatusIndicators";
import { downloadValidRowsExcelv2 } from "../../../services/documents";
import SkeletonTable from "../../../components/SkeletonTable";

const Step8: React.FC = () => {
  const [zoom, setZoom] = useState(0.8);
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");
  // NEW: which matrix type is selected (0 = Count, 1 = Percentage, 2 = Average), null = show all
  const [selectedMatrixType, setSelectedMatrixType] = useState<number | null>(
    null
  );

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
      await downloadValidRowsExcelv2(data, "matrix_construction", authToken);
      setStatus("success");
      setStatusMessage("Download complete.");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setStatusMessage("Download failed.");
    }
  };

  const {
    migrationMatrixData = [],
    migrationMatrixPercentage = [],
    migrationMatrixAverage = [],
  } = data || {};

  const matrixTitles = [
    "Transition Matrix - Count",
    "Transition Matrix - Percentage",
    "Average Transition Matrix",
  ];

  // helper to toggle selection
  const toggleMatrixType = (index: number) => {
    setSelectedMatrixType((prev) => (prev === index ? null : index));
  };

  return (
    <div className="w-full min-h-screen bg-gray-50 px-6 py-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-3">
              <TmMatrixConstructionAbout countBlocks={migrationMatrixData} percentBlocks={migrationMatrixPercentage} />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Review migration matrices for the selected entity and reporting
              period.
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
                "inline-flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm font-medium transition cursor-pointer",
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

        {/* Container */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left column - overview & controls */}
          <aside className="space-y-4">
            <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">
                    Display Controls
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Zoom & view options for the matrices
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-full" />
              </div>

              <div className="mt-4 flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Zoom</span>
                  <span className="font-medium text-gray-700">
                    {Math.round(zoom * 100)}%
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 flex-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gray-300"
                      style={{
                        width: `${Math.min(
                          Math.max((zoom - 0.5) / 1.5, 0) * 100,
                          100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* CLICKABLE Data Summary */}
            <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-700">
                Data Summary
              </h4>

              <div className="mt-3 grid grid-cols-3 gap-3">
                {/* Count groups (index 0) */}
                <button
                  type="button"
                  onClick={() => toggleMatrixType(0)}
                  onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") && toggleMatrixType(0)
                  }
                  aria-pressed={selectedMatrixType === 0}
                  className={clsx(
                    "p-3 rounded border text-center focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer",
                    selectedMatrixType === 0
                      ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300"
                      : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                  )}
                >
                  <div className="text-xs text-gray-500">Count groups</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {migrationMatrixData?.length ?? 0}
                  </div>
                </button>

                {/* Percentage groups (index 1) */}
                <button
                  type="button"
                  onClick={() => toggleMatrixType(1)}
                  onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") && toggleMatrixType(1)
                  }
                  aria-pressed={selectedMatrixType === 1}
                  className={clsx(
                    "p-3 rounded border text-center focus:outline-none focus:ring-2 focus:ring-offset-1  cursor-pointer",
                    selectedMatrixType === 1
                      ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300"
                      : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                  )}
                >
                  <div className="text-xs text-gray-500">Percentage groups</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {migrationMatrixPercentage?.length ?? 0}
                  </div>
                </button>

                {/* Average rows (index 2) */}
                <button
                  type="button"
                  onClick={() => toggleMatrixType(2)}
                  onKeyDown={(e) =>
                    (e.key === "Enter" || e.key === " ") && toggleMatrixType(2)
                  }
                  aria-pressed={selectedMatrixType === 2}
                  className={clsx(
                    "p-3 rounded border text-center focus:outline-none focus:ring-2 focus:ring-offset-1  cursor-pointer",
                    selectedMatrixType === 2
                      ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-300"
                      : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                  )}
                >
                  <div className="text-xs text-gray-500">Average rows</div>
                  <div className="text-lg font-semibold text-gray-800">
                    {migrationMatrixAverage?.length ?? 0}
                  </div>
                </button>
              </div>

              <div className="mt-3 text-xs text-gray-500">
                Tip: click a card to focus that matrix. Click again to show all.
              </div>
            </div>

            <div className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm">
              <h4 className="text-sm font-semibold text-gray-700">Notes</h4>
              <ul className="text-xs text-gray-500 mt-2 list-disc list-inside space-y-1">
                <li>
                  You can click the cards in the{" "}
                  <span className="font-medium">Data Summary</span> to view the
                  related table.
                </li>
                <li>
                  Use <span className="font-medium">Ctrl + Mouse Wheel</span> to
                  zoom in or out of the tables.
                </li>
                <li>
                  <span className="font-medium">Aging Bucket</span> refers to
                  groups of accounts categorized by the number of days past due
                  (e.g., 0 days = Current, 1–30 days = Bucket 1, 31–60 days =
                  Bucket 2, etc.).
                </li>
              </ul>
            </div>
          </aside>

          {/* Right column - matrices */}
          <main className="space-y-4">
            <div className="space-y-6">
              {matrixTitles.map((title, typeIndex) => {
                // If the user selected a specific matrix type, only render that one
                if (
                  selectedMatrixType !== null &&
                  selectedMatrixType !== typeIndex
                ) {
                  return null;
                }

                return (
                  <section
                    key={typeIndex}
                    className="rounded-lg bg-white border border-gray-200 p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-semibold">
                          {typeIndex + 1}
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800">
                          {title}
                        </h3>
                      </div>
                      <div className="text-sm text-gray-500">
                        {(typeIndex === 0
                          ? migrationMatrixData?.length
                          : typeIndex === 1
                          ? migrationMatrixPercentage?.length
                          : migrationMatrixAverage?.length) ?? 0}{" "}
                        blocks
                      </div>
                    </div>

                    <div className="mt-4 space-y-4">
                      {typeIndex === 0 ? (
                          migrationMatrixData.map((d: number[][], monthIndex: number) => (
                          <div
                            key={`count-${monthIndex}`}
                            className="p-3 bg-white border border-gray-100 rounded"
                          >
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
                          <TransitionMatrixPercentageCountTable
                              data={d}
                              format="number"
                              decimalPlaces={0}
                              zoomLevel={zoom}
                              setZoomLevel={setZoom}
                            />
                          )}
                          </div>
                        ))
                      ) : typeIndex === 1 ? (
                         migrationMatrixPercentage.map((d: number[][], monthIndex: number) => (
                            <div
                              key={`pct-${monthIndex}`}
                              className="p-3 bg-white border border-gray-100 rounded"
                            >
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
                          <TransitionMatrixPercentageCountTable
                                data={d}
                                format="percentage"
                                decimalPlaces={2}
                                zoomLevel={zoom}
                                setZoomLevel={setZoom}
                              />
                          )}
                              
                            </div>
                          )
                        )
                      ) : (
                        <div className="p-3 bg-white border border-gray-100 rounded">
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
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </main>
        </div>

        {/* Loader overlay */}
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

export default Step8;
