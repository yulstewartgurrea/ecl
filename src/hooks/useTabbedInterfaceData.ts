// src/hooks/useTabbedInterfaceData.ts
import { useState, useEffect, useMemo, useRef } from "react";
import { useAppSelector, useAppDispatch } from "../redux_toolkit/hooks";
import useSWRMutation from "swr/mutation";
import {
  setWorkflowMetrics,
} from "../redux_toolkit/features/probability_of_default/transition_matrix/pdMatrixWfHelper";



type Metrics = {
  duplicate: number;
  valid: number;
  error: number;
  missing: number;
};

interface InsertPayload {
  id: number[] | any;
  workflow: string;
  filename: string;
  updatedData: any[];
}

interface UseInsertDocumentReturn {
  isLoading: boolean;
  error: Error | null;
  insertDocument: (
    payload: InsertPayload,
    onSuccess?: (result?: any) => void
  ) => Promise<any>;
}

/* Return type now includes onChildRefresh so parent can pass it down */
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
  error: Error | null;
  groupIds: number[];
  orgFilename: string[];
  orgData: any[];
  onChildRefresh: (updatedFile: any | null) => void;
};

// Utility function for sorting filenames
const sortFilenames = (filenames: string[], sortType: 'alphabetical' | 'monthly' = 'alphabetical'): string[] => {
  console.log('Sorting filenames:', filenames, 'with type:', sortType);
  
  if (sortType === 'monthly') {
    const monthMap: any = {
      January: 1,
      February: 2,
      March: 3,
      April: 4,
      May: 5,
      June: 6,
      July: 7,
      August: 8,
      September: 9,
      October: 10,
      November: 11,
      December: 12
    };

    const sorted = [...filenames].sort((a, b) => {
      // Extract month and year
      const [ , , monthA, yearA ] = a.split("_");
      const [ , , monthB, yearB ] = b.split("_");

      const yA = parseInt(yearA);
      const yB = parseInt(yearB);
      if (yA !== yB) return yA - yB; // sort by year first
      return monthMap[monthA] - monthMap[monthB]; // then by month
    });
    
    console.log('Monthly sorted result:', sorted);
    return sorted;
  }
  
  // Default alphabetical sorting
  return filenames.sort();
};

export function useTabbedInterfaceData(
  directoryPath: string
): UseTabbedInterfaceDataReturn {
  const dispatch = useAppDispatch();
  const containerRef = useRef<HTMLDivElement>(null);
  const authToken = useAppSelector((state) => state.auth.token);
  const [metricsMap, setMetricsMap] = useState<Record<string, Metrics>>({});
  const [inputFiles, setInputFiles] = useState<string[]>([]);
  const [orgFilename, setOrgFilename] = useState<string[]>([]);
  const [groupIds, setIds] = useState<number[]>([]);
  const [fileDataMap, setFileDataMap] = useState<Record<string, any[]>>({});
  const [activeTab, setActiveTab] = useState(0);
  const [filter, setFilter] = useState<"All" | "Valid" | "Error" | "Missing">(
    "All"
  );
  const [visibleCount, setVisibleCount] = useState(0);
  const TAB_WIDTH = 140;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(
          `http://localhost:8000/documents/read-excel?workflow_path=${directoryPath}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
          }
        );
        if (!response.ok) throw new Error("Network response was not ok");

        const data = await response.json();

        const metrics: Record<string, Metrics> = {};
        const fileNames: string[] = [];
        const orgFileName: string[] = [];
        const fileData: Record<string, any[]> = {};
        const ids: number[] = []; // <-- store ids here

        data.forEach((fileEntry: any) => {
          const baseName = fileEntry.filename.replace(/\.[^/.]+$/, "");
          const key = baseName.replace(/\s+/g, "_");

          metrics[key] = {
            duplicate: fileEntry.duplicate ?? null,
            valid: fileEntry.valid ?? 0,
            missing: fileEntry.missing ?? 0,
            error: fileEntry.error ?? 0,
          };
          dispatch(
            setWorkflowMetrics({
              workflow: directoryPath,
              metricsMap: metrics,
            })
          );
          orgFileName.push(fileEntry.filename);
          ids.push(fileEntry.id); // <-- correctly push id
          fileNames.push(key);
          fileData[key] = fileEntry.rows ?? [];
        });
        setOrgFilename(orgFileName);
        setMetricsMap(metrics);
        setInputFiles(fileNames);
        setFileDataMap(fileData);
        setIds(ids);
      } catch (error) {
        console.error("Fetch error:", error);
        setError(error instanceof Error ? error : new Error("Unknown error"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [directoryPath, authToken]);

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

  const visibleTabs = sortFilenames(inputFiles.slice(0, visibleCount), 'monthly');
  const overflowTabs = sortFilenames(inputFiles.slice(visibleTabs.length), 'monthly');
  console.log('overflowTabs', overflowTabs)
  const activeFile = inputFiles[activeTab];
  const activeData = fileDataMap[activeFile] || [];

  // filteredData for UI (based on selected filter)
  const filteredData = useMemo(() => {
    if (filter === "All") return activeData;
    return activeData.filter(
      (row) => row.status?.toLowerCase() === filter.toLowerCase()
    );
  }, [activeData, filter]);

  // orgData is original unfiltered rows for the active tab
  const orgData = activeData;

  const currentMetrics = useMemo(() => {
    const total = filteredData.length;
    const countByStatus = (status: string) =>
      filteredData.filter((row) => row.status?.toLowerCase() === status).length;

    return {
      valid: total ? Math.round((countByStatus("valid") / total) * 100) : 0,
      error: total ? Math.round((countByStatus("error") / total) * 100) : 0,
      missing: total ? Math.round((countByStatus("missing") / total) * 100) : 0,
      duplicate: total
        ? Math.round((countByStatus("duplicate") / total) * 100)
        : 0,
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

  /**
   * Called by child when it fetched updatedFile from read-excel.
   * It updates internal maps so filteredData and metrics recompute.
   */
  const handleChildRefresh = (updatedFile: any | null) => {
    if (!updatedFile) return;

    const baseName = updatedFile.filename.replace(/\.[^/.]+$/, "");
    const key = baseName.replace(/\s+/g, "_");

    // Update rows for that file key
    setFileDataMap((prev) => ({
      ...prev,
      [key]: updatedFile.rows ?? prev[key] ?? [],
    }));

    // Update metrics for that key
    setMetricsMap((prev) => ({
      ...prev,
      [key]: {
        valid: updatedFile.valid ?? prev[key]?.valid ?? 0,
        error: updatedFile.error ?? prev[key]?.error ?? 0,
        missing: updatedFile.missing ?? prev[key]?.missing ?? 0,
      },
    }));

    // Update orgFilename at the corresponding index
    setOrgFilename((prev) => {
      const idx = inputFiles.findIndex((f) => f === key);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = updatedFile.filename;
      return next;
    });

    // Update groupIds (ids aligned with inputFiles)
    setIds((prev) => {
      const idx = inputFiles.findIndex((f) => f === key);
      if (idx === -1 || updatedFile.id === undefined) return prev;
      const next = [...prev];
      next[idx] = updatedFile.id;
      return next;
    });
  };

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
    error,
    groupIds,
    orgFilename,
    orgData,
    onChildRefresh: handleChildRefresh,
  };
}

/* -------------------------
   Insert document hook (useInsertDocument)
   ------------------------- */

async function insertFetcher(
  url: string,
  { arg }: { arg: { payload: InsertPayload; token: string | null } }
) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: arg.token ? `Bearer ${arg.token}` : "",
    },
    body: JSON.stringify(arg.payload),
  });

  if (!response.ok) {
    const errData = await response.json();
    throw new Error(errData.detail || "Failed to insert document");
  }
  return response.json();
}

export const useInsertDocument = (authToken: any): UseInsertDocumentReturn => {
  const [error, setError] = useState<Error | null>(null);

  const { trigger, isMutating } = useSWRMutation(
    "http://localhost:8000/documents/insert-new-version",
    insertFetcher
  );

  const insertDocument = async (
    payload: InsertPayload,
    onSuccess?: (result?: any) => void
  ) => {
    try {
      setError(null);
      const result = await trigger({ payload, token: authToken });
      // pass server response to caller
      if (onSuccess) onSuccess(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
      throw err;
    }
  };

  return { isLoading: isMutating, error, insertDocument };
};
