import React, { useRef, useState, useEffect } from "react";
import clsx from "clsx";
import { formatValueGeneral } from "../utils/CommonHelper";
import { FunnelIcon } from "@heroicons/react/24/outline";

interface TableTemplate1Props {
  data: Array<{ [key: string]: any }>;
  highlightAll?: boolean;
  highlightedRow?: number | null;
  onRowClick?: (rowIndex: number | null) => void;
  format?: string;
  decimalPlaces?: number;
  headersParams?: string[];
  additionalCss?: any;
  zoomLevel?: number;
  setZoomLevel?: (zoom: number | ((prev: number) => number)) => void;
}

const TableTemplate1: React.FC<TableTemplate1Props> = ({
  data,
  highlightAll = false,
  highlightedRow,
  onRowClick,
  format = "money",
  decimalPlaces = 2,
  headersParams,
  additionalCss,
  zoomLevel,
  setZoomLevel,
}) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [internalHighlightedRow, setInternalHighlightedRow] = useState<
    number | null
  >(null);
  const headers =
    headersParams ?? (data.length > 0 ? Object.keys(data[0]) : []);

  // applied filters
  const [filters, setFilters] = useState<{ [key: string]: Set<string> }>({});
  // temporary filter state (for dropdown)
  const [tempFilters, setTempFilters] = useState<{
    [key: string]: Set<string>;
  }>({});
  const [filterSearch, setFilterSearch] = useState<{ [key: string]: string }>(
    {}
  );
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  // row click
  const handleRowClick = (rowIndex: number) => {
    if (highlightAll) {
      onRowClick?.(rowIndex === highlightedRow ? null : rowIndex);
    } else {
      setInternalHighlightedRow(
        rowIndex === internalHighlightedRow ? null : rowIndex
      );
    }
  };

  // close filters when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tableRef.current &&
        !tableRef.current.contains(event.target as Node)
      ) {
        setOpenFilter(null);
        if (!highlightAll) setInternalHighlightedRow(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [highlightAll]);

  // zoom logic
  const [internalZoom, setInternalZoom] = useState(0.9);
  const effectiveZoom = zoomLevel ?? internalZoom;
  const updateZoom = setZoomLevel ?? setInternalZoom;

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        const delta = event.deltaY < 0 ? 0.1 : -0.1;
        updateZoom((prevZoom: number) =>
          Math.min(Math.max(prevZoom + delta, 0.5), 2)
        );
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [updateZoom]);

  // unique values for dropdowns
  const uniqueValues = (key: string) =>
    [...new Set(data.map((row) => row[key]))].filter(
      (v) => v !== undefined && v !== null
    );

  // filtering
  const filteredData = data.filter((row) => {
    return headers.every((key) => {
      const selected = filters[key];
      if (selected && selected.size > 0) {
        return selected.has(row[key]?.toString());
      }
      return true;
    });
  });

  // toggle select in tempFilters
  const toggleSelect = (header: string, value: string) => {
    setTempFilters((prev) => {
      const newSet = new Set(prev[header] || []);
      if (newSet.has(value)) {
        newSet.delete(value);
      } else {
        newSet.add(value);
      }
      return { ...prev, [header]: newSet };
    });
  };

  // select all / clear all
  const selectAll = (header: string, allValues: string[]) => {
    setTempFilters((prev) => ({
      ...prev,
      [header]: new Set(allValues),
    }));
  };

  const clearAll = (header: string) => {
    setTempFilters((prev) => ({
      ...prev,
      [header]: new Set(),
    }));
  };
  const openFilterFor = (header: string) => {
    const allValues = uniqueValues(header).map((v) => v.toString());

    setTempFilters((prev) => {
      const existing = prev[header];
      // ✅ If no filter applied yet, default to ALL selected
      const initial = existing?.size ? new Set(existing) : new Set(allValues);

      return {
        ...prev,
        [header]: initial,
      };
    });

    setOpenFilter(header);
  };
  // apply / cancel
  const applyFilter = (header: string) => {
    const allValues = uniqueValues(header).map((v) => v.toString());
    const selected = tempFilters[header] || new Set();

    setFilters((prev) => ({
      ...prev,
      // ✅ If everything is selected → treat as no filter
      [header]:
        selected.size === allValues.length ? new Set() : new Set(selected),
    }));

    setOpenFilter(null);
  };

  const cancelFilter = () => {
    setOpenFilter(null);
  };

  return (
    <div
      ref={tableRef}
      className={clsx(
        additionalCss?.outerDiv ?? "overflow-auto max-h-screen min-w-full"
      )}
    >
      <table
        style={{ zoom: effectiveZoom }}
        className="border border-gray-300 w-full relative"
      >
        <thead className="sticky top-0 z-10">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="bg-[#444444] text-white text-center p-2 border border-white relative"
              >
                <div className="flex items-center justify-center gap-1">
                  {header.replace(/_/g, " ")}
                  {(header === "report_date" || header === "pn_number") && (
                    <FunnelIcon
                      className="h-4 w-4 cursor-pointer"
                      onClick={() =>
                        openFilter === header
                          ? setOpenFilter(null)
                          : openFilterFor(header)
                      }
                    />
                  )}
                </div>

                {/* filter dropdown */}
                {openFilter === header && (
                  <div className="absolute left-0 mt-2 bg-white text-black border rounded shadow-lg w-56 z-50 p-2">
                    <input
                      type="text"
                      placeholder="Search..."
                      className="w-full p-1 border mb-2 text-sm"
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
                        className="underline hover:text-blue-600"
                        onClick={() =>
                          selectAll(
                            header,
                            uniqueValues(header).map((v) => v.toString())
                          )
                        }
                      >
                        Select All
                      </button>
                      <button
                        className="underline hover:text-blue-600"
                        onClick={() => clearAll(header)}
                      >
                        Clear All
                      </button>
                    </div>

                    <div className="max-h-40 overflow-y-auto text-sm mb-2">
                      {uniqueValues(header)
                        .filter((val) =>
                          val
                            .toString()
                            .toLowerCase()
                            .includes(
                              (filterSearch[header] || "").toLowerCase()
                            )
                        )
                        .map((val, idx) => (
                          <label
                            key={idx}
                            className="flex items-center gap-1 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={
                                tempFilters[header]?.has(val.toString()) ||
                                false
                              }
                              onChange={() =>
                                toggleSelect(header, val.toString())
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
                        onClick={() => applyFilter(header)}
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredData.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={clsx("hover:bg-gray-100 cursor-pointer")}
              onClick={() => handleRowClick(rowIndex)}
            >
              {headers.map((key, headerIndex: number) => (
                <td
                  key={key}
                  className={clsx("min-w-28 p-2 border border-gray-300", {
                    [additionalCss?.firstColColor!]:
                      headerIndex === 0 && !!additionalCss?.firstColColor,
                    "bg-white":
                      headerIndex !== 0 || !additionalCss?.firstColColor,
                    "text-right":
                      typeof row[key] === "number" || row[key] === "NA",
                    "text-center":
                      typeof row[key] !== "number" && row[key] !== "NA",
                  })}
                >
                  {typeof row[key] === "number"
                    ? formatValueGeneral(row[key], format, decimalPlaces)
                    : row[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableTemplate1;
