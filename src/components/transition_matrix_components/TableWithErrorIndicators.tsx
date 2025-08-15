import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { FunnelIcon } from "@heroicons/react/24/outline";
import { formatValueGeneral } from "../../utils/CommonHelper";
import ApiStatusIndicator from "../../components/ApiStatusIndicators";
import { useAppSelector } from "../../redux_toolkit/hooks";
import { useInsertDocument } from "../../hooks/useTabbedInterfaceData";

interface ColumnStats {
  complete: number;
  error: number;
  missing: number;
}

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
  onRefresh?: (updatedFile: any | null) => void; // parent hook handler
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
}) => {
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
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
  const originalRowsRef = useRef<any[]>([]); // deep-copy of original JSON rows
  const editedIndicesRef = useRef<Set<number>>(new Set()); // indices (original) that were edited

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
  ].map(normalize);

  const headers = useMemo(() => {
    const rawHeaders =
      headersParams ?? (data.length > 0 ? Object.keys(data[0]) : []);
    return rawHeaders.filter((h) => !excludedHeaders.includes(normalize(h)));
  }, [headersParams, data]);

  const headersWithFilter = ["report_date", "cis_number", "pn_number"];

  // Initialize tableData and store original deep copy on data change
  useEffect(() => {
    const deepCopy = JSON.parse(JSON.stringify(data || []));
    originalRowsRef.current = deepCopy;
    setTableData(deepCopy);
    editedIndicesRef.current.clear();
  }, [data]);

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

  // Stats (based on filtered data)
  const stats = useMemo(() => {
    const result: Record<string, ColumnStats> = {};
    headers.forEach((key) => {
      let complete = 0;
      let missing = 0;
      let error = 0;
      for (const row of filteredTableData) {
        const value = row[key];
        if (value === null || value === undefined || value === "") missing++;
        else if (["ERROR", "NaN", "INVALID"].includes(String(value))) error++;
        else complete++;
      }
      result[key] = { complete, error, missing };
    });
    return result;
  }, [filteredTableData, headers]);

  const getTotal = (stat: ColumnStats) =>
    stat.complete + stat.error + stat.missing;
  const getPercent = (value: number, total: number) =>
    total === 0 ? 0 : Math.round((value / total) * 100);

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

  // handle cell change using the original row index
  const handleCellChange = (rowIndex: number, key: string, value: string) => {
    setTableData((prev) => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], [key]: value };
      return updated;
    });
    // mark that original index as edited
    editedIndicesRef.current.add(rowIndex);
  };

  // refresh from backend (keeps Authorization header) and notify parent hook
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
      const allFiles = await response.json();
      const updatedFile = allFiles.find((f: any) => f.filename === inputFile);
      if (updatedFile) {
        originalRowsRef.current = JSON.parse(
          JSON.stringify(updatedFile.rows || [])
        );
        setTableData(JSON.parse(JSON.stringify(updatedFile.rows || [])));
        editedIndicesRef.current.clear();

        // notify parent (hook) so it updates fileDataMap / metricsMap
        if (onRefresh) onRefresh(updatedFile);
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
      const original = orgData;

      // Step 1: Merge edits from tableData into original
      let merged = original.map((origRow: any, i: number) => {
        if (editedIndicesRef.current.has(i)) {
          return tableData[i];
        }
        return origRow;
      });

      // Step 2: Append any new rows added in tableData
      if (tableData.length > merged.length) {
        for (let j = merged.length; j < tableData.length; j++) {
          merged.push(tableData[j]);
        }
      }

      // Step 3: Remove exactly one duplicate (based on cis_number, pn_number, and report_date)
      const seen = new Set();
      merged = merged.filter((row: any) => {
        if (!row) return false; // skip undefined rows just in case

        const key = `${row.report_date}-${row.cis_number}-${row.pn_number}`;
        if (seen.has(key)) {
          // first time duplicate found, skip only once
          return false;
        }
        seen.add(key);
        return true;
      });

      // Step 4: Send to backend
      const payload = {
        id: groupIds,
        workflow: directoryPath,
        filename: inputFile,
        updatedData: merged,
      };

      await insertDocument(payload, handleRefresh);

      // Step 5: Reset state
      originalRowsRef.current = JSON.parse(JSON.stringify(merged));
      setTableData(JSON.parse(JSON.stringify(merged)));
      editedIndicesRef.current.clear();
      setIsEditing(false);
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

      <div className="flex justify-between items-center mb-2">
        {isEditing ? (
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Save
          </button>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Edit
          </button>
        )}
      </div>

      <div
        className={clsx(
          additionalCss?.outerDiv ?? "overflow-auto max-h-screen min-w-full",
          "relative" // relative for absolute dropdown
        )}
        onClick={() => setFilterDropdownOpen(null)}
      >
        <table ref={tableRefZoom} className="border border-gray-300 w-full">
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
                    onMouseEnter={() => setHoveredColumn(header)}
                    onMouseLeave={() => setHoveredColumn(null)}
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
                                [header]: new Set(uniqueValuesAll.map(String)),
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

                    {/* Move the dropdown outside of table's scroll clipping */}
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
                                  filterSelections[header]?.has(String(val)) ||
                                  false
                                }
                                onChange={() =>
                                  toggleSelection(header, String(val))
                                }
                              />
                              {val}
                            </label>
                          ))}
                        </div>

                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            onClick={cancelFilter}
                            className="px-3 py-1 rounded border border-gray-400 hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() =>
                              applyFilter(header, uniqueValuesAll.map(String))
                            }
                            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700"
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    )}
                    {filterDropdownOpen !== header &&
                      hoveredColumn === header &&
                      stats[header] && (
                        <div className="absolute top-[calc(var(--header-bottom)+5px)] left-[calc(var(--header-left))] z-[9999] w-56 max-h-80 overflow-auto  shadow-lg p-3 text-black">
                          {/* Caret/Arrow */}
                          <div className="w-0 h-0 border-l-6 border-r-6 border-b-6 border-transparent border-b-gray-300 mx-auto" />

                          {/* Tooltip Box */}
                          <div className="bg-white border border-gray-300 shadow-lg text-gray-800 text-xs px-3 py-2 rounded whitespace-nowrap relative">
                            <div className="font-semibold mb-2 text-center">
                              {header}
                            </div>

                            <div className="flex text-center text-[11px] border-t border-gray-200 pt-2">
                              <div className="flex-1 pr-3 border-r border-gray-300">
                                <div className="text-green-600 font-semibold">
                                  {stats[header].complete} (
                                  {getPercent(
                                    stats[header].complete,
                                    getTotal(stats[header])
                                  )}
                                  %)
                                </div>
                                <div className="text-gray-600 text-[10px] mt-1">
                                  Valid
                                </div>
                              </div>

                              <div className="flex-1 px-3 border-r border-gray-300">
                                <div className="text-orange-500 font-semibold">
                                  {stats[header].error} (
                                  {getPercent(
                                    stats[header].error,
                                    getTotal(stats[header])
                                  )}
                                  %)
                                </div>
                                <div className="text-gray-600 text-[10px] mt-1">
                                  Error
                                </div>
                              </div>

                              <div className="flex-1 pl-3">
                                <div className="text-gray-700 font-semibold">
                                  {stats[header].missing} (
                                  {getPercent(
                                    stats[header].missing,
                                    getTotal(stats[header])
                                  )}
                                  %)
                                </div>
                                <div className="text-gray-600 text-[10px] mt-1">
                                  Missing
                                </div>
                              </div>
                            </div>
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
            {filteredTableData.map((row, filteredIndex) => {
              const rowIndex = tableData.findIndex((r) => r === row);

              const handleDeleteRow = () => {
                if (!isEditing) return; // only allow deletion in edit mode
                setTableData((prev) => {
                  const updated = [...prev];
                  updated.splice(rowIndex, 1);
                  return updated;
                });
                // mark as edited to ensure save picks up changes
                editedIndicesRef.current.add(rowIndex);
              };

              return (
                <tr key={rowIndex} className="hover:bg-gray-100">
                  {headers.map((key) => (
                    <td
                      key={key}
                      className={clsx(
                        "min-w-28 p-2 border border-gray-300 bg-white",
                        {
                          "text-right": typeof row[key] === "number",
                          "text-center": typeof row[key] !== "number",
                        }
                      )}
                    >
                      {isEditing ? (
                        <input
                          type="text"
                          value={tableData[rowIndex][key] ?? ""}
                          onChange={(e) =>
                            handleCellChange(rowIndex, key, e.target.value)
                          }
                          className="border border-gray-300 rounded px-2 py-1 w-full text-sm"
                        />
                      ) : typeof row[key] === "number" ? (
                        formatValueGeneral(row[key], format, decimalPlaces)
                      ) : (
                        row[key]
                      )}
                    </td>
                  ))}

                  {/* Delete button */}
                  <td className="text-center p-2 border border-gray-300 bg-white">
                    {isEditing && (
                      <button
                        onClick={handleDeleteRow}
                        className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
};

export default TableWithErrorIndicators;
