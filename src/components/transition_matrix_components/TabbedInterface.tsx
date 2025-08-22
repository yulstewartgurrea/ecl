// src/components/transition_matrix_components/TabbedInterface.tsx
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../redux_toolkit/store";
import { useTabbedInterfaceData } from "../../hooks/useTabbedInterfaceData";
import clsx from "clsx";

import TableWithErrorIndicators from "./TableWithErrorIndicators";
import Loader from "../Loader";
import ApiStatusIndicator from "../ApiStatusIndicators";

const TabbedInterface = () => {
  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);

  const directoryPath = `/${entity}/${period}/${workflowName}`;
  const {
    containerRef,
    inputFiles,
    activeTab,
    setActiveTab,
    filter,
    setFilter,
    visibleTabs,
    overflowTabs,
    filteredData,
    currentMetrics,
    columnCount,
    rowCount,
    dataTypes,
    isLoading,
    error,
    groupIds,
    orgFilename,
    orgData,
    onChildRefresh,
  } = useTabbedInterfaceData(directoryPath);

  // Manage API status
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    if (isLoading) {
      setStatus("loading");
      setStatusMessage("Loading tabbed interface data...");
    } else if (error) {
      setStatus("error");
      setStatusMessage("Failed to load data.");
    } else {
      setStatus("success");
      setStatusMessage("Data loaded successfully.");
    }
  }, [isLoading, error]);
  const activeId = groupIds[activeTab];

  return (
    <div className="w-full min-h-screen  relative">
      <ApiStatusIndicator
        status={status}
        message={statusMessage}
        onHide={() => setStatus("idle")}
      />

      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#f3f0ea]/50 z-10">
          <Loader />
        </div>
      )}

      <div className="flex mt-4 relative" ref={containerRef}>
        {visibleTabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            disabled={isLoading}
            className={clsx(
              "mr-1 py-2 px-4 rounded-t-md w-[160px] truncate text-ellipsis whitespace-nowrap",
              activeTab === index
                ? "bg-[#ad8a49] text-white"
                : "border-x border-t border-gray-300 text-gray-500 bg-gray-50",
              isLoading && "cursor-not-allowed opacity-50"
            )}
          >
            {tab}
          </button>
        ))}
        {overflowTabs.length > 0 && (
          <div className="relative group">
            <button
              disabled={isLoading}
              className={clsx(
                "w-10 h-[42px] rounded-t-md border-x border-t border-gray-300 text-gray-500 bg-gray-50 flex items-center justify-center",
                isLoading && "cursor-not-allowed opacity-50"
              )}
            >
              ▼
            </button>
            <div className="absolute top-full left-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 hidden group-hover:block">
              {overflowTabs.map((tab, i) => {
                const realIndex = visibleTabs.length + i;
                return (
                  <div
                    key={realIndex}
                    onClick={() => !isLoading && setActiveTab(realIndex)}
                    className={clsx(
                      "px-4 py-2 cursor-pointer hover:bg-gray-100 truncate w-[140px]",
                      activeTab === realIndex && "bg-[#ad8a49] text-white",
                      isLoading && "cursor-not-allowed opacity-50"
                    )}
                  >
                    {tab}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 bg-[#f3f0ea] w-full min-h-screen  border border-gray-300 rounded-b-md border-t-0 px-6 py-4 relative">
        <div className="flex gap-2 my-4 flex-wrap">
          {[
            { label: "All", color: "bg-gray-200", icon: "📄" },
            { label: "Valid", color: "bg-gray-200", icon: "✅" },
            { label: "Error", color: "bg-gray-200", icon: "⚠️" },
            { label: "Missing", color: "bg-gray-200", icon: "❓" },
            { label: "Duplicate", color: "bg-gray-200", icon: "🟡" }, // Added Duplicate
          ].map(({ label, color, icon }) => (
            <button
              key={label}
              onClick={() => setFilter(label as any)}
              disabled={isLoading}
              className={clsx(
                "px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1",
                filter === label
                  ? "bg-[#ad8a49] text-white"
                  : `${color} text-gray-800`,
                isLoading && "cursor-not-allowed opacity-50"
              )}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {/* Metrics bar */}
        <div className="w-full flex flex-row items-center gap-4">
          <div className="h-10 w-7/12 bg-gray-200 overflow-hidden flex rounded">
            <div
              className="bg-green-500 h-full"
              style={{ width: `${currentMetrics.valid}%` }}
            />
            <div
              className="bg-orange-400 h-full"
              style={{ width: `${currentMetrics.error}%` }}
            />
            <div
              className="bg-gray-700 h-full"
              style={{ width: `${currentMetrics.missing}%` }}
            />
            <div
              className="bg-yellow-700 h-full"
              style={{ width: `${currentMetrics.duplicate}%` }}
            />
          </div>
          <div className="flex flex-grow gap-2 justify-between text-sm">
            <span>{columnCount} Columns</span>
            <span>{rowCount} Rows</span>
            <span>{dataTypes.size} Data Types</span>
          </div>
        </div>

        {/* Metrics labels */}
        <div className="flex gap-6 mt-2 text-sm items-center">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-green-500 rounded-sm" />
            <span>{currentMetrics.valid}% Valid</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-orange-400 rounded-sm" />
            <span>{currentMetrics.error}% Error</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-gray-700 rounded-sm" />
            <span>{currentMetrics.missing}% Missing</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-yellow-700 rounded-sm" />
            <span>{currentMetrics.duplicate}% Duplicate</span>
          </div>
        </div>

        {/* Table */}
        <div className="mt-6">
          <TableWithErrorIndicators
            orgData={orgData}
            groupIds={activeId}
            directoryPath={directoryPath}
            data={filteredData}
            inputFile={orgFilename[activeTab]}
            onRefresh={onChildRefresh}
          />
        </div>

        {/* Show error message */}
        {error && <p className="text-red-600 mt-4">Failed to fetch data</p>}
      </div>
    </div>
  );
};

export default TabbedInterface;
