import React, { useRef, useState, useEffect } from "react";
import clsx from "clsx";
import { formatValueGeneral } from "../utils/CommonHelper";

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
  const [internalHighlightedRow, setInternalHighlightedRow] = useState<number | null>(null);
  const headers = headersParams ?? (data.length > 0 ? Object.keys(data[0]) : []);

  const handleRowClick = (rowIndex: number) => {
    if (highlightAll) {
      onRowClick?.(rowIndex === highlightedRow ? null : rowIndex);
    } else {
      setInternalHighlightedRow(rowIndex === internalHighlightedRow ? null : rowIndex);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tableRef.current && !tableRef.current.contains(event.target as Node)) {
        if (!highlightAll) setInternalHighlightedRow(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [highlightAll]);

  // ZOOM logic
  const [internalZoom, setInternalZoom] = useState(0.9);
  const effectiveZoom = zoomLevel ?? internalZoom;
  const updateZoom = setZoomLevel ?? setInternalZoom;

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        const delta = event.deltaY < 0 ? 0.1 : -0.1;
        updateZoom((prevZoom: number) => Math.min(Math.max(prevZoom + delta, 0.5), 2));
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [updateZoom]);

  return (
    <div
      ref={tableRef}
      className={clsx(
        additionalCss?.outerDiv ?? "overflow-auto max-h-screen min-w-full"
      )}
    >
      <table
        style={{ zoom: effectiveZoom }}
        className="border border-gray-300 w-full"
      >
        <thead className="sticky top-0 z-10">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="bg-[#444444] text-white text-center p-2 border border-white"
              >
                {header.replace(/_/g, " ")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={clsx("hover:bg-gray-100 cursor-pointer")}
              onClick={() => handleRowClick(rowIndex)}
            >
              {headers.map((key, headerIndex: number) => (
                <td
                  key={key}
                  className={clsx(
                    "min-w-28 p-2 border border-gray-300",
                    {
                      [additionalCss?.firstColColor!]:
                        headerIndex === 0 && !!additionalCss?.firstColColor,
                      "bg-white": headerIndex !== 0 || !additionalCss?.firstColColor,
                      "text-right":
                        typeof row[key] === "number" || row[key] === "NA",
                      "text-center":
                        typeof row[key] !== "number" && row[key] !== "NA",
                    }
                  )}
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
