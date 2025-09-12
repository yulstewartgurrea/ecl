import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { CheckIcon, FunnelIcon } from "@heroicons/react/24/outline";
import { formatValueGeneral } from "../../utils/CommonHelper";
import ApiStatusIndicator from "../../components/ApiStatusIndicators";
import { useInsertDocument } from "../../hooks/useTabbedInterfaceData";
import { useAppSelector, useAppDispatch } from "../../redux_toolkit/hooks";
import {
  setWorkflowMetrics,
} from "../../redux_toolkit/features/probability_of_default/transition_matrix/pdMatrixWfHelper";
import EditButton from "../ui/EditButton";

type Metrics = {
  duplicate: number;
  valid: number;
  error: number;
  missing: number;
};

interface TableWithErrorIndicatorsProps {
  data: Array<{ [key: string]: any }>;
  inputFile: string;
  format?: string;
  decimalPlaces?: number;
  headersParams?: string[];
  additionalCss?: any;
  groupIds?: any; // expect array aligned with tabs (keeps current behavior)
  directoryPath?: any;
  orgData?: any;
  baseDataForSave?: any[]; 
  onRefresh?: (updatedFile: any | null) => void; // parent hook handler
  onSaveSuccess?: () => void;
}

const TableWithErrorIndicators: React.FC<TableWithErrorIndicatorsProps> = ({
  data,
  inputFile,
  format = "money",
  decimalPlaces = 2,
  headersParams,
  additionalCss,
  groupIds,
  directoryPath,
  orgData,
  onRefresh,
  onSaveSuccess,
}) => {
  const dispatch = useAppDispatch();
  const [filters, setFilters] = useState<Record<string, string>>({});
  const authToken = useAppSelector((state) => state.auth.token);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState<string | null>(
    null
  );
  const [filterSelections, setFilterSelections] = useState<
    Record<string, Set<string>>
  >({});
  const [filterSearch, setFilterSearch] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);
  const [tableData, setTableData] = useState<any[]>([]);
  const originalRowsRef = useRef<any[]>([]);
  // map local _rowIndex -> global index in orgData (or -1 if not mapped)
  const originalIndexMapRef = useRef<Map<number, number>>(new Map());
  // track edits/deletes by global index
  const editedIndicesRef = useRef<Set<number>>(new Set());
  const editedGlobalRef = useRef<Set<number>>(new Set());
  const deletedGlobalRef = useRef<Set<number>>(new Set());
  const {
    isLoading: isSaving,
    error: saveError,
    insertDocument,
  } = useInsertDocument(authToken);

  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [zoomLevel, setZoomLevel] = useState(0.9);
  const tableRefZoom = useRef<HTMLTableElement | null>(null);
  const [isDelete, setIsDelete] = useState(false);
  const normalize = (str: string) =>
    str.replace(/_/g, " ").trim().toLowerCase();
  const excludedHeaders = [
    "error explanations",
    "errors",
    "missing fields",
    "report date parsed",
    "booking date parsed",
    "maturity date parsed",
    "row sequence",
    "source file",
    "group sequence",
    "rowIndex",
    "duplicate",
  ].map(normalize);

  const headers = useMemo(() => {
    const rawHeaders =
      headersParams ?? (data.length > 0 ? Object.keys(data[0]) : []);
    return rawHeaders.filter((h) => !excludedHeaders.includes(normalize(h)));
  }, [headersParams, data]);

  const headersWithFilter = ["report_date", "cis_number", "pn_number"];
  const addRowIndex = (rows: any[]) =>
    rows.map((row, i) => ({ ...row, _rowIndex: i }));

  // Helper to best-match a row to orgData; returns global index or -1
  const findGlobalIndexForRow = (row: any, orgArr: any[]) => {
    if (!orgArr || orgArr.length === 0) return -1;
    // Try to match by likely stable keys first
    const stableKeys = ["row_sequence", "cis_number", "pn_number", "id"];
    for (const k of stableKeys) {
      if (row[k] !== undefined) {
        const found = orgArr.findIndex((r) => r && r[k] === row[k]);
        if (found >= 0) return found;
      }
    }
    // Fallback to stringify comparison (best-effort)
    try {
      const s = JSON.stringify(row);
      const found = orgArr.findIndex((r) => {
        try {
          return JSON.stringify(r) === s;
        } catch {
          console.log('zoomLevel: ', zoomLevel, isDelete)
          return false;
        }
      });
      return found >= 0 ? found : -1;
    } catch {
      return -1;
    }
  };

  // Initialize tableData and store original deep copy on data change
  useEffect(() => {
    const deepCopy = addRowIndex(data || []);
    originalRowsRef.current = deepCopy;
    setTableData(deepCopy);
    editedGlobalRef.current.clear();
    deletedGlobalRef.current.clear();
    setIsDelete(false);

    // Build mapping from the local (filtered) _rowIndex -> index in the full orgData
    const map = new Map<number, number>();
    if (orgData && Array.isArray(orgData)) {
      deepCopy.forEach((row, localIdx) => {
        const foundIndex = findGlobalIndexForRow(row, orgData);
        map.set(localIdx, foundIndex);
      });
    } else {
      deepCopy.forEach((_, localIdx) => map.set(localIdx, localIdx));
    }
    originalIndexMapRef.current = map;
  }, [data, orgData]);

  // Initialize filterSelections
  useEffect(() => {
    const newSelections: Record<string, Set<string>> = {};
    headersWithFilter.forEach((header) => {
      const uniqueValues = Array.from(
        new Set((data || []).map((row) => row[header]).filter(Boolean))
      ).map(String);
      newSelections[header] = new Set(uniqueValues);
    });
    setFilterSelections(newSelections);
  }, [data]);

  // Compute filtered table data (this is what the UI shows)
  const filteredTableData = useMemo(() => {
    return tableData.filter((row) =>
      Object.entries(filters).every(([key, filterValue]) => {
        if (!filterValue) return true;
        const selectedValues = filterValue.split(",");
        return selectedValues.includes(String(row[key]));
      })
    );
  }, [tableData, filters]);

  // zoom wheel handler
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        const delta = event.deltaY < 0 ? 0.1 : -0.1;
        setZoomLevel((prev) => Math.min(Math.max(prev + delta, 0.5), 2));
      }
    };
    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, []);

  const handleCellChange = (
    rowIndex: number, // this is the _rowIndex (local index in tableData)
    key: string,
    value: string | number
  ) => {
    setTableData((prev) => {
      const newData = prev.map((r) => ({ ...r })); // shallow copy
      const i = newData.findIndex((r) => r._rowIndex === rowIndex);
      if (i >= 0) {
        newData[i] = { ...newData[i], [key]: value };
        // mark corresponding global index as edited
        const globalIdx = originalIndexMapRef.current.get(rowIndex);
        if (typeof globalIdx === "number" && globalIdx >= 0) {
          editedGlobalRef.current.add(globalIdx);
        } else {
          // if no mapping, mark the local _rowIndex as - meaning new row; edits will be applied on save by appending
          // no action needed in editedGlobalRef for new rows
        }
      } else {
        // fallback: if not found by _rowIndex, try treating as index
        if (newData[rowIndex]) {
          newData[rowIndex] = { ...newData[rowIndex], [key]: value };
          const globalIdx = originalIndexMapRef.current.get(rowIndex);
          if (typeof globalIdx === "number" && globalIdx >= 0) {
            editedGlobalRef.current.add(globalIdx);
          }
        }
      }
      return newData;
    });
  };

  const handleDeleteRow = (rowIndex: number) => {
    if (!isEditing) return;

    // Determine global index (if mapped). If mapped, mark deletedGlobalRef
    const globalIdx = originalIndexMapRef.current.get(rowIndex);
    if (typeof globalIdx === "number" && globalIdx >= 0) {
      deletedGlobalRef.current.add(globalIdx);
    } else {
      // It's a new/unmapped row - no need to mark global delete
    }

    setTableData((prev) => {
      const updated = prev.filter((r) => r._rowIndex !== rowIndex);
      // Reassign _rowIndex sequentially so the in-memory array is compact
      const reindexed = addRowIndex(updated);

      // After reindexing, rebuild originalIndexMapRef to map new local indices to the same global indices where possible.
      const newMap = new Map<number, number>();
      reindexed.forEach((r, newLocalIdx) => {
        // Try to find previous mapping by matching content to previous rows (best-effort)
        let prevLocal = -1;
        for (const [k] of originalIndexMapRef.current.entries()) {
          const prevRow = originalRowsRef.current[k];
          try {
            if (prevRow && JSON.stringify(prevRow) === JSON.stringify(r)) {
              prevLocal = k;
              break;
            }
          } catch {
            // ignore
          }
        }
        // Prefer to keep previous global mapping if found, else attempt to match to orgData
        let mappedGlobal = -1;
        if (prevLocal >= 0) mappedGlobal = originalIndexMapRef.current.get(prevLocal) ?? -1;
        if (mappedGlobal === -1 && orgData) {
          mappedGlobal = findGlobalIndexForRow(r, orgData);
        }
        newMap.set(newLocalIdx, mappedGlobal);
      });
      originalIndexMapRef.current = newMap;
      originalRowsRef.current = reindexed; // keep current snapshot
      return reindexed;
    });

    setIsDelete(true);
  };

  const handleRefresh = async (_maybeResultFromInsert?: any) => {
    try {
      const response = await fetch(
        `http://localhost:8000/documents/read-excel?workflow_path=${directoryPath}`,
        {
          headers: { Authorization: authToken ? `Bearer ${authToken}` : "" },
        }
      );

      if (!response.ok) {
        console.error("Refresh failed", await response.text());
        if (onRefresh) onRefresh(null);
        return null;
      }

      // parse response once
      const allFiles = await response.json();

      // build fresh metrics map (overwrite semantics)
      const metrics: Record<string, Metrics> = {};
      allFiles.forEach((fileEntry: any) => {
        const baseName = fileEntry.filename.replace(/\.[^/.]+$/, "");
        const key = baseName.replace(/\s+/g, "_");
        metrics[key] = {
          duplicate: fileEntry.duplicate ?? null,
          valid: fileEntry.valid ?? 0,
          missing: fileEntry.missing ?? 0,
          error: fileEntry.error ?? 0,
        };
      });

      // ALWAYS overwrite workflow metrics in Redux for this directoryPath
      try {
        dispatch(
          setWorkflowMetrics({
            workflow: directoryPath,
            metricsMap: metrics,
          })
        );
      } catch (err) {
        console.warn("Failed to dispatch setWorkflowMetrics:", err);
      }

      // find updated file we care about
      const updatedFile = allFiles.find((f: any) => f.filename === inputFile);

      if (updatedFile) {
        // prefer parent-driven update if available
        if (onRefresh) {
          try {
            onRefresh(updatedFile);
          } catch (err) {
            console.warn("onRefresh callback threw:", err);
          }
          return updatedFile;
        }

        // fallback: update local state directly (backwards compatible)
        originalRowsRef.current = JSON.parse(
          JSON.stringify(updatedFile.rows || [])
        );
        setTableData(JSON.parse(JSON.stringify(updatedFile.rows || [])));

        // clear edit/delete refs safely (depending on which variant you're using in this file)
        try {
          editedIndicesRef && editedIndicesRef.current && editedIndicesRef.current.clear();
        } catch {}
        try {
          editedGlobalRef && editedGlobalRef.current && editedGlobalRef.current.clear();
        } catch {}
        try {
          deletedGlobalRef && deletedGlobalRef.current && deletedGlobalRef.current.clear();
        } catch {}

        return updatedFile;
      } else {
        if (onRefresh) onRefresh(null);
        return null;
      }
    } catch (err) {
      console.error("Refresh error:", err);
      if (onRefresh) onRefresh(null);
      return null;
    }
  };



  const handleSave = async () => {
    try {
      // Start from the full original dataset (orgData) to avoid losing non-visible rows
      const fullOriginal = Array.isArray(orgData) ? JSON.parse(JSON.stringify(orgData)) : [];

      // Build a map keyed by global index for the full original data
      const globalMap = new Map<number, any>();
      for (let i = 0; i < fullOriginal.length; i++) {
        globalMap.set(i, { ...fullOriginal[i], _originalGlobalIndex: i });
      }

      // 1) Apply deletions marked by deletedGlobalRef
      for (const delIdx of Array.from(deletedGlobalRef.current)) {
        if (globalMap.has(delIdx)) {
          globalMap.delete(delIdx);
        }
      }

      // 2) Apply edits from tableData by mapping local -> global
      tableData.forEach((row) => {
        const localIdx = row._rowIndex;
        const globalIdx = originalIndexMapRef.current.get(localIdx);
        if (typeof globalIdx === "number" && globalIdx >= 0 && globalMap.has(globalIdx)) {
          // merge changes
          globalMap.set(globalIdx, { ...globalMap.get(globalIdx), ...row });
        } else {
          // new/unmapped row => append as new entry using a new global key
          const newGlobalKey = globalMap.size > 0 ? Math.max(...Array.from(globalMap.keys())) + 1 : 0;
          globalMap.set(newGlobalKey, { ...row, _rowIndex: newGlobalKey });
        }
      });

      // 3) Build final array preserving order by global index
      const updatedData = Array.from(globalMap.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, v]) => {
          const copy = { ...v };
          delete copy._originalGlobalIndex;
          return copy;
        });

      // Build payload
      const payload = {
        id: groupIds,
        workflow: directoryPath,
        filename: inputFile,
        updatedData: updatedData,
      };

      // Send to backend
      await insertDocument(payload, handleRefresh);

      // Reset internal state using the updatedData
      originalRowsRef.current = JSON.parse(JSON.stringify(updatedData));
      setTableData(JSON.parse(JSON.stringify(updatedData)));
      editedGlobalRef.current.clear();
      deletedGlobalRef.current.clear();
      originalIndexMapRef.current = new Map(); // will be rebuilt on next data prop update
      setIsEditing(false);
      setIsDelete(false);
      if (onSaveSuccess) onSaveSuccess();
    } catch (err) {
      console.error(`Error saving document: ${(err as Error).message}`);
      alert(`Error saving document: ${(err as Error).message}`);
    }
  };

  // Filter handlers (unchanged)
  const toggleSelection = (header: string, val: string) => {
    setFilterSelections((prev) => {
      const newSet = new Set(prev[header] || []);
      if (newSet.has(val)) newSet.delete(val);
      else newSet.add(val);
      return { ...prev, [header]: newSet };
    });
  };
  const selectAll = (header: string, values: string[]) =>
    setFilterSelections((prev) => ({ ...prev, [header]: new Set(values) }));
  const clearAll = (header: string) =>
    setFilterSelections((prev) => ({ ...prev, [header]: new Set() }));
  const applyFilter = (header: string, uniqueValuesAll: string[]) => {
    const selectedArray = Array.from(filterSelections[header] || []);
    setFilters((prev) => ({
      ...prev,
      [header]:
        selectedArray.length === uniqueValuesAll.length
          ? ""
          : selectedArray.join(","),
    }));
    setFilterDropdownOpen(null);
  };
  const cancelFilter = () => setFilterDropdownOpen(null);

  useEffect(() => {
    if (isSaving) {
      setStatus("loading");
      setStatusMessage("Saving document...");
    } else if (saveError) {
      setStatus("error");
      setStatusMessage("Failed to save document.");
    } else {
      setStatus("success");
      setStatusMessage("Document ready.");
    }
  }, [isSaving, saveError]);

  return (
    <>
      <ApiStatusIndicator
        status={status}
        message={statusMessage}
        onHide={() => setStatus("idle")}
      />

      <div
        className={clsx(
          additionalCss?.outerDiv ?? "overflow-auto max-h-screen min-w-full",
          "flex flex-col"
        )}
        onClick={() => setFilterDropdownOpen(null)}
      >
        {/* Buttons row aligned to right above the table */}
        <div className="flex justify-end mb-2 gap-2">
          {isEditing ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white
                      shadow hover:bg-emerald-700 active:bg-emerald-800
                      focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2
                      disabled:opacity-60 disabled:cursor-not-allowed transition"
            title="Save"
          >
            {isSaving ? (
              <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10" className="opacity-30" stroke="currentColor" strokeWidth="4" fill="none" />
                <path d="M4 12a8 8 0 018-8" className="opacity-90" fill="currentColor" />
              </svg>
            ) : (
              <CheckIcon className="h-5 w-5" />
            )}
            <span>{isSaving ? "Saving..." : "Save"}</span>
          </button>

          ) : (
            <EditButton
              iconOnly
              variant="ghost"
              size="sm"
              onClick={() => setIsEditing(true)}
            />
          )}
        </div>

        {/* Table */}
        <div className="overflow-auto h-[80vh] border border-gray-300 rounded">
          <table ref={tableRefZoom} className="border border-gray-300">
            <thead className="sticky top-0 z-10 bg-[#444444]">
              <tr>
                {headers.map((header) => {
                  const uniqueValuesAll = Array.from(
                    new Set(
                      (data || []).map((row) => row[header]).filter(Boolean)
                    )
                  ).map(String);
                  const showFilter = headersWithFilter.includes(header);
                  const searchTerm = filterSearch[header] || "";
                  const uniqueValuesFiltered = uniqueValuesAll.filter((val) =>
                    val.toLowerCase().includes(searchTerm.toLowerCase())
                  );

                  return (
                    <th
                      key={header}
                      className="bg-[#444444] text-white p-3 border border-white relative text-nowrap cursor-default hover:bg-gray-700 transition-colors duration-200 rounded"
                    
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-semibold tracking-wide select-none">
                          {header.replace(/_/g, " ")}
                        </span>
                        {showFilter && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFilterDropdownOpen(
                                filterDropdownOpen === header ? null : header
                              );
                              setFilterSearch((prev) => ({
                                ...prev,
                                [header]: "",
                              }));
                              if (!filterSelections[header]) {
                                setFilterSelections((prev) => ({
                                  ...prev,
                                  [header]: new Set(
                                    uniqueValuesAll.map(String)
                                  ),
                                }));
                              }
                            }}
                            className={clsx(
                              "p-1 rounded hover:bg-gray-600 transition-colors",
                              filters[header] ? "text-yellow-400" : "text-white"
                            )}
                            aria-label={`Toggle filter for ${header}`}
                          >
                            <FunnelIcon className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      {filterDropdownOpen === header && (
                        <div
                          className="absolute top-[calc(var(--header-bottom)+5px)] left-[calc(var(--header-left))] z-[9999] w-56 max-h-80 overflow-auto bg-white border border-gray-300 rounded shadow-lg p-3 text-black"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            placeholder="Search..."
                            className="w-full p-1 mb-2 border border-gray-300 rounded"
                            value={filterSearch[header] || ""}
                            onChange={(e) =>
                              setFilterSearch((prev) => ({
                                ...prev,
                                [header]: e.target.value,
                              }))
                            }
                          />
                          <div className="mb-2 flex justify-between text-xs font-semibold">
                            <button
                              onClick={() =>
                                selectAll(header, uniqueValuesAll.map(String))
                              }
                              className="underline hover:text-blue-600"
                            >
                              Select All
                            </button>
                            <button
                              onClick={() => clearAll(header)}
                              className="underline hover:text-blue-600"
                            >
                              Clear All
                            </button>
                          </div>

                          <div className="max-h-44 overflow-auto border border-gray-200 rounded p-1">
                            {uniqueValuesFiltered.length === 0 && (
                              <div className="text-center text-gray-500 text-xs italic">
                                No values
                              </div>
                            )}
                            {uniqueValuesFiltered.map((val) => (
                              <label
                                key={val}
                                className="block text-sm cursor-pointer text-left select-none hover:bg-gray-100 rounded px-1"
                              >
                                <input
                                  type="checkbox"
                                  className="mr-2"
                                  checked={
                                    filterSelections[header]?.has(
                                      String(val)
                                    ) || false
                                  }
                                  onChange={() =>
                                    toggleSelection(header, String(val))
                                  }
                                />
                                {val}
                              </label>
                            ))}
                          </div>
                          <div className="flex justify-end gap-2 text-xs">
                            <button
                              className="px-2 py-1 border rounded bg-gray-200"
                              onClick={() => cancelFilter()}
                            >
                              Cancel
                            </button>
                            <button
                              className="px-2 py-1 border rounded bg-blue-500 text-white"
                              onClick={() =>
                                applyFilter(header, uniqueValuesAll.map(String))
                              }
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}
                    </th>
                  );
                })}
                {filteredTableData.length > 0 && isEditing && (
                  <th className="bg-[#444444] text-white p-3 border border-white text-center">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredTableData.map((row) => {
                if (!row) return null; // safeguard
                const rowIndex = row._rowIndex;

                return (
                  <tr key={rowIndex} className="hover:bg-gray-100">
                    {headers.map((key) => (
                      <td
                        key={key}
                        className={clsx(
                          "min-w-28 p-2 border border-gray-300 bg-white",
                          {
                            "text-right": !isNaN(Number(row[key])),
                            "text-center": isNaN(Number(row[key])),
                          }
                        )}
                      >
                        {isEditing ? (
                          <input
                            type="text"
                            value={row[key] ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              const parsed =
                                val !== "" && !isNaN(Number(val))
                                  ? Number(val)
                                  : val;
                              handleCellChange(rowIndex, key, parsed);
                            }}
                            className="border border-gray-300 rounded px-2 py-1 w-full text-sm"
                          />
                        ) : row[key] !== "" &&
                          row[key] !== null &&
                          !isNaN(Number(row[key])) ? (
                          formatValueGeneral(
                            Number(row[key]),
                            format,
                            decimalPlaces
                          )
                        ) : (
                          row[key] ?? ""
                        )}
                      </td>
                    ))}

                    {isEditing && (
                      <td className="text-center p-2 border border-gray-300 bg-white">
                        <button
                          onClick={() => handleDeleteRow(rowIndex)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

export default TableWithErrorIndicators;
