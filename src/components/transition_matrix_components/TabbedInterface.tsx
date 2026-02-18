import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../redux_toolkit/store";
import { useTabbedInterfaceData } from "../../hooks/useTabbedInterfaceData";
import clsx from "clsx";
import { useDocumentVersions } from "../../hooks/useDocumentVersions";
import TableWithErrorIndicators from "./TableWithErrorIndicators";
import Loader from "../Loader";
import ApiStatusIndicator from "../ApiStatusIndicators";
import {
  ClockIcon,
  ChevronDownIcon,
  EllipsisHorizontalIcon,
} from "@heroicons/react/24/outline";
import { useAppDispatch, useAppSelector } from "../../redux_toolkit/hooks";
import { updateModuleData } from "../../redux_toolkit/features/workflow/workflowSlice";
import { useDocumentById } from "../../hooks/useDocumentById";

const TabbedInterface = () => {
  const dispatch = useAppDispatch();
  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);

  const [filteredData, setFilteredData] = useState<any[]>([]);
  const authToken = useAppSelector((state) => state.auth.token);
  const directoryPath = `/${entity}/${period}/${workflowName}`;

  const {
    containerRef,
    activeTab,
    setActiveTab,
    visibleTabs,
    overflowTabs,
    dataTypes,
    isLoading,
    error,
    groupIds,
    orgFilename,
    onChildRefresh,
  } = useTabbedInterfaceData(directoryPath);

  const [selectedVersions, setSelectedVersions] = useState<
    Record<number, number>
  >({});
  const selectedVersion = selectedVersions[activeTab];

  const { document } = useDocumentById(selectedVersion, authToken);

  useEffect(() => {
    dispatch(
      updateModuleData({
        moduleId: "transitionMatrix",
        data: { forStep3: true },
      }),
    );
  }, [dispatch]);

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
  const activeFile = orgFilename[activeTab];
  const [activeStatusFilter, setActiveStatusFilter] = useState("All");

  const { versions, mutate } = useDocumentVersions(
    directoryPath,
    activeFile,
    authToken,
  );

  useEffect(() => {
    if (versions && versions.length > 0) {
      setSelectedVersions((prev) => {
        if (prev[activeTab]) return prev;
        return { ...prev, [activeTab]: versions[0].id };
      });
    }
  }, [activeTab, versions]);

  const handleVersionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newVersion = Number(e.target.value);
    setSelectedVersions((prev) => ({
      ...prev,
      [activeTab]: newVersion,
    }));
  };

  const filterDocumentData = (statusLabel: string) => {
    if (!document?.json_data) return [];
    if (statusLabel === "All") return document.json_data;
    return document.json_data.filter(
      (row: any) => row.status?.toLowerCase() === statusLabel.toLowerCase(),
    );
  };

  useEffect(() => {
    if (!document?.json_data) return;
    const filtered = filterDocumentData(activeStatusFilter);
    setFilteredData(filtered);
  }, [document, activeStatusFilter]);

  const metrics = useMemo(() => {
    if (!filteredData || filteredData.length === 0)
      return { valid: 0, error: 0, missing: 0, duplicate: 0 };

    const total = filteredData.length;
    const counts = { valid: 0, error: 0, missing: 0, duplicate: 0 };
    filteredData.forEach((row: any) => {
      const status = row.status?.toLowerCase();
      if (status === "valid") counts.valid += 1;
      else if (status === "error") counts.error += 1;
      else if (status === "missing") counts.missing += 1;
      else if (status === "duplicate") counts.duplicate += 1;
    });

    return {
      valid: Math.round((counts.valid / total) * 100),
      error: Math.round((counts.error / total) * 100),
      missing: Math.round((counts.missing / total) * 100),
      duplicate: Math.round((counts.duplicate / total) * 100),
    };
  }, [filteredData]);

  const filteredColumnCount = useMemo(() => {
    if (!filteredData || filteredData.length === 0) return 0;
    return Object.keys(filteredData[0]).length;
  }, [filteredData]);

  const filteredRowCount = filteredData.length;

  // UI helpers
  const statusPills: Array<{ key: string; label: string; emoji: string }> = [
    { key: "All", label: "All", emoji: "📄" },
    { key: "Valid", label: "Valid", emoji: "✅" },
    { key: "Error", label: "Error", emoji: "⚠️" },
    { key: "Missing", label: "Missing", emoji: "❓" },
    { key: "Duplicate", label: "Duplicate", emoji: "🟡" },
  ];

  return (
    <div className="w-full min-h-screen relative">
      <ApiStatusIndicator
        status={status}
        message={statusMessage}
        onHide={() => setStatus("idle")}
      />

      {/* Loader overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-xl bg-white p-6 shadow-2xl flex items-center gap-4">
            <Loader />
            <div>
              <div className="text-sm font-medium text-gray-800">
                Loading migration data
              </div>
              <div className="text-xs text-gray-500">
                This may take a moment depending on the dataset size.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 my-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to fetch migration data.
        </div>
      )}

      {/* Tabs Header */}
      <div className="px-4 pt-4">
        <div
          ref={containerRef}
          className="relative flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm"
        >
          {/* Visible tabs */}
          <div className="flex flex-1 overflow-x-auto no-scrollbar gap-2">
            {visibleTabs.map((tab, index) => (
              <button
                key={index}
                onClick={() => setActiveTab(index)}
                title={tab}
                disabled={isLoading}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                  activeTab === index
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                  isLoading && "cursor-not-allowed opacity-50",
                )}
              >
                <span className="truncate">{tab}</span>
              </button>
            ))}
          </div>

          {/* Overflow */}
          {overflowTabs.length > 0 && (
            <div className="relative">
              <button
                disabled={isLoading}
                className={clsx(
                  "h-9 w-9 inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
                  isLoading && "cursor-not-allowed opacity-50",
                )}
              >
                <EllipsisHorizontalIcon className="h-5 w-5" />
              </button>
              {/* menu on hover */}
              <div className="absolute right-0 mt-2 hidden min-w-[180px] max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white p-1 shadow-lg group-hover:block peer-hover:block">
                {overflowTabs.map((tab, i) => {
                  const realIndex = visibleTabs.length + i;
                  return (
                    <div
                      key={realIndex}
                      onClick={() => !isLoading && setActiveTab(realIndex)}
                      className={clsx(
                        "cursor-pointer rounded-md px-3 py-2 text-sm hover:bg-gray-100",
                        activeTab === realIndex &&
                          "bg-amber-50 text-amber-700 font-medium",
                        isLoading && "cursor-not-allowed opacity-50",
                      )}
                    >
                      <span className="truncate">{tab}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="mx-4 my-4 rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
        {/* Toolbar */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          {/* Left: Status filter pills */}
          <div className="flex flex-wrap items-center gap-2">
            {statusPills.map(({ key, label, emoji }) => (
              <button
                key={key}
                onClick={() => setActiveStatusFilter(key)}
                disabled={isLoading}
                title={label}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  activeStatusFilter === key
                    ? "bg-amber-500 text-white shadow"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200",
                  isLoading && "cursor-not-allowed opacity-50",
                )}
              >
                <span className="text-base leading-none">{emoji}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Right: Version select */}
          <div className="flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-gray-600 -scale-x-100" />
            <span className="text-sm font-medium text-gray-700">Version</span>
            <div className="relative">
              <select
                value={selectedVersion}
                onChange={handleVersionChange}
                disabled={isLoading || versions.length === 0}
                className="appearance-none rounded-lg border border-gray-300 bg-white px-3 py-2 pr-9 text-sm text-gray-800 shadow-sm outline-none transition focus:border-amber-500"
              >
                {versions.map((v: any) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex flex-col gap-2">
          {/* Stacked bar */}
          <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200 flex">
            <div
              className="h-full bg-green-500 flex-none"
              style={{
                width: `${metrics.valid}%`,
                minWidth: metrics.valid > 0 ? 2 : 0,
              }}
              title={`Valid ${metrics.valid}%`}
            />
            <div
              className="h-full bg-orange-400 flex-none"
              style={{
                width: `${metrics.error}%`,
                minWidth: metrics.error > 0 ? 2 : 0,
              }}
              title={`Error ${metrics.error}%`}
            />
            <div
              className="h-full bg-gray-600 flex-none"
              style={{
                width: `${metrics.missing}%`,
                minWidth: metrics.missing > 0 ? 2 : 0,
              }}
              title={`Missing ${metrics.missing}%`}
            />
            <div
              className="h-full bg-yellow-700 flex-none"
              style={{
                width: `${metrics.duplicate}%`,
                minWidth: metrics.duplicate > 0 ? 2 : 0,
              }}
              title={`Duplicate ${metrics.duplicate}%`}
            />
          </div>

          {/* Legend + counts */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-700">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-green-500" />
                {metrics.valid}% Valid
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-orange-400" />
                {metrics.error}% Error
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-gray-600" />
                {metrics.missing}% Missing
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-yellow-700" />
                {metrics.duplicate}% Duplicate
              </span>
            </div>
            <div className="flex items-center gap-4 text-gray-600">
              <span>{filteredColumnCount} Columns</span>
              <span>{filteredRowCount} Rows</span>
              <span>{dataTypes.size} Data Types</span>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="mt-6">
          <TableWithErrorIndicators
            orgData={document?.json_data || []}
            baseDataForSave={
              filteredData && filteredData.length
                ? filteredData
                : document?.json_data || []
            }
            groupIds={activeId}
            directoryPath={directoryPath}
            data={filteredData || []}
            inputFile={orgFilename[activeTab]}
            onRefresh={onChildRefresh}
            onSaveSuccess={() => mutate()}
            enablePagination={true}
            itemsPerpage={100}
            showPaginationInfo={true}
          />
        </div>

        {/* Inline error (extra) */}
        {error && (
          <p className="mt-4 text-sm text-red-600">Failed to fetch data</p>
        )}
      </div>
    </div>
  );
};

export default TabbedInterface;
