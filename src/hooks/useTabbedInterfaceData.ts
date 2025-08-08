import { useState, useEffect, useMemo, useRef } from "react";
type Metrics = {
  valid: number;
  error: number;
  missing: number;
};

type UseTabbedInterfaceDataReturn = {
  containerRef: React.RefObject<HTMLDivElement | null>;
  inputFiles: string[];
  metricsMap: Record<string, Metrics>;
  fileDataMap: Record<string, any[]>;
  activeTab: number;
  setActiveTab: React.Dispatch<React.SetStateAction<number>>;
  filter: "All" | "Valid" | "Error" | "Missing";
  setFilter: React.Dispatch<
    React.SetStateAction<"All" | "Valid" | "Error" | "Missing">
  >;
  visibleTabs: string[];
  overflowTabs: string[];
  visibleCount: number;
  filteredData: any[];
  currentMetrics: Metrics;
  columnCount: number;
  rowCount: number;
  dataTypes: Set<string>;
  isLoading: boolean;
};

export function useTabbedInterfaceData(
  directoryPath: string
): UseTabbedInterfaceDataReturn {
  const containerRef = useRef<HTMLDivElement>(null);

  const [metricsMap, setMetricsMap] = useState<Record<string, Metrics>>({});
  const [inputFiles, setInputFiles] = useState<string[]>([]);
  const [fileDataMap, setFileDataMap] = useState<Record<string, any[]>>({});
  const [activeTab, setActiveTab] = useState(0);
  const [filter, setFilter] = useState<"All" | "Valid" | "Error" | "Missing">(
    "All"
  );
  const [visibleCount, setVisibleCount] = useState(0);
  const TAB_WIDTH = 140;
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
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
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [directoryPath]);

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

  return {
    containerRef,
    inputFiles,
    metricsMap,
    fileDataMap,
    activeTab,
    setActiveTab,
    filter,
    setFilter,
    visibleTabs,
    overflowTabs,
    visibleCount,
    filteredData,
    currentMetrics,
    columnCount,
    rowCount,
    dataTypes,
    isLoading,
  };
}
