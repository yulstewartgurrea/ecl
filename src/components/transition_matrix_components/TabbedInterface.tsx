import { useState, useRef, useEffect, useMemo } from "react";
import clsx from "clsx";
import TableWithErrorIndicators from "./TableWithErrorIndicators";
import { useSelector } from "react-redux";
import type { RootState } from "../../redux_toolkit/store";
type Metrics = {
  valid: number;
  error: number;
  missing: number;
};

const TabbedInterface = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);
  const directoryPath = `/${entity}/${period}/${workflowName}`;
  const [metricsMap, setMetricsMap] = useState<Record<string, Metrics>>({});
  const [inputFiles, setInputFiles] = useState<string[]>([]);
  const [fileDataMap, setFileDataMap] = useState<Record<string, any[]>>({});
  const [activeTab, setActiveTab] = useState(0);
  const [filter, setFilter] = useState<"All" | "Valid" | "Error" | "Missing">(
    "All"
  );

  const [visibleCount, setVisibleCount] = useState(inputFiles.length);
  const TAB_WIDTH = 140;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(
          `http://localhost:8000/documents/read-excel?workflow_path=${directoryPath}`
        );
        if (!response.ok) throw new Error("Network response was not ok");

        const data = await response.json();

        const metrics: Record<string, Metrics> = {};
        const fileNames: string[] = [];
        const fileData: Record<string, any[]> = {};

        data.forEach((fileEntry: any) => {
          const baseName = fileEntry.filename.replace(/\.[^/.]+$/, "");
          const key = baseName.replace(/\s+/g, "_");

          metrics[key] = {
            valid: fileEntry.valid,
            missing: fileEntry.missing,
            error: fileEntry.error,
          };

          fileNames.push(key);
          fileData[key] = fileEntry.rows;
        });

        setMetricsMap(metrics);
        setInputFiles(fileNames);
        setFileDataMap(fileData);
      } catch (error) {
        console.error("Fetch error:", error);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const calculateVisibleTabs = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const maxTabs = Math.floor((containerWidth - 40) / TAB_WIDTH);
        setVisibleCount(maxTabs);
      }
    };
    calculateVisibleTabs();
    window.addEventListener("resize", calculateVisibleTabs);
    return () => window.removeEventListener("resize", calculateVisibleTabs);
  }, []);

  const visibleTabs = inputFiles.slice(0, visibleCount);
  const overflowTabs = inputFiles.slice(visibleTabs.length);
  const activeFile = inputFiles[activeTab];
  const activeData = fileDataMap[activeFile] || [];

  const filteredData = useMemo(() => {
    if (filter === "All") return activeData;
    return activeData.filter(
      (row) => row.status?.toLowerCase() === filter.toLowerCase()
    );
  }, [activeData, filter]);

  const currentMetrics = useMemo(() => {
    const total = filteredData.length;
    const countByStatus = (status: string) =>
      filteredData.filter((row) => row.status?.toLowerCase() === status).length;

    return {
      valid: total ? Math.round((countByStatus("valid") / total) * 100) : 0,
      error: total ? Math.round((countByStatus("error") / total) * 100) : 0,
      missing: total ? Math.round((countByStatus("missing") / total) * 100) : 0,
    };
  }, [filteredData]);

  const columnCount =
    filteredData.length > 0 ? Object.keys(filteredData[0]).length : 0;
  const rowCount = filteredData.length;

  const dataTypes = useMemo(() => {
    const types = new Set<string>();
    filteredData.forEach((row) => {
      Object.values(row).forEach((value) => {
        if (value !== null && value !== undefined) {
          types.add(typeof value);
        }
      });
    });
    return types;
  }, [filteredData]);

  return (
    <>
      <div className="flex mt-8 relative" ref={containerRef}>
        {visibleTabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={clsx(
              "mr-1 py-2 px-4 rounded-t-md w-[140px] truncate text-ellipsis whitespace-nowrap",
              activeTab === index
                ? "bg-[#ad8a49] text-white"
                : "border-x border-t border-gray-300 text-gray-500 bg-gray-50"
            )}
          >
            {tab}
          </button>
        ))}
        {overflowTabs.length > 0 && (
          <div className="relative group">
            <button className="w-10 h-[42px] rounded-t-md border-x border-t border-gray-300 text-gray-500 bg-gray-50 flex items-center justify-center">
              ▼
            </button>
            <div className="absolute top-full left-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 hidden group-hover:block">
              {overflowTabs.map((tab, i) => {
                const realIndex = visibleTabs.length + i;
                return (
                  <div
                    key={realIndex}
                    onClick={() => setActiveTab(realIndex)}
                    className={clsx(
                      "px-4 py-2 cursor-pointer hover:bg-gray-100 truncate w-[140px]",
                      activeTab === realIndex && "bg-[#ad8a49] text-white"
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

      <div className="w-full min-h-screen bg-[#f3f0ea] border border-gray-300 rounded-b-md border-t-0 px-6 py-4">
        <div className="mb-4 mt-2">
          <div className="flex gap-2 my-4 flex-wrap">
            {[
              { label: "All", color: "bg-gray-200", icon: "📄" },
              { label: "Valid", color: "bg-gray-200", icon: "✅" },
              { label: "Error", color: "bg-gray-200", icon: "⚠️" },
              { label: "Missing", color: "bg-gray-200", icon: "❓" },
            ].map(({ label, color, icon }) => (
              <button
                key={label}
                onClick={() => setFilter(label as any)}
                className={clsx(
                  "px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1",
                  filter === label
                    ? "bg-[#ad8a49] text-white"
                    : `${color} text-gray-800`
                )}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </div>
          <div className="w-full flex flex-row items-center gap-4">
            <div className="h-10 w-7/12 bg-gray-200 overflow-hidden flex">
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
            </div>
            <div className="flex flex-grow gap-2 justify-between">
              <span>{columnCount} Columns</span>
              <span>{rowCount} Rows</span>
              <span>{dataTypes.size} Data Types</span>
            </div>
          </div>

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
          </div>

          <div className="mt-6">
            <TableWithErrorIndicators
              data={filteredData}
              inputFile={inputFiles[activeTab]}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default TabbedInterface;
