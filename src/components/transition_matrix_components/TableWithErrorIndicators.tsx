import React, { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { formatValueGeneral } from "../../utils/CommonHelper";

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
}

const TableWithErrorIndicators: React.FC<TableWithErrorIndicatorsProps> = ({
  data,
  inputFile,
  format = "money",
  decimalPlaces = 2,
  headersParams,
  additionalCss,
}) => {
  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const headers =
    headersParams ?? (data.length > 0 ? Object.keys(data[0]) : []);
  const stats = useMemo(() => {
    const result: Record<
      string,
      { complete: number; error: number; missing: number }
    > = {};

    if (!data || data.length === 0) return result;

    const headers = Object.keys(data[0]);

    headers.forEach((key) => {
      let complete = 0;
      let missing = 0;
      let error = 0;

      for (const row of data) {
        const value = row[key];

        if (value === null || value === undefined || value === "") {
          missing++;
        } else if (
          value === "ERROR" ||
          value === "NaN" ||
          value === "INVALID"
        ) {
          error++;
        } else {
          complete++;
        }
      }

      result[key] = { complete, error, missing };
    });

    return result;
  }, [data]);

  const getTotal = (stat: ColumnStats) =>
    stat.complete + stat.error + stat.missing;

  const getPercent = (value: number, total: number) =>
    total === 0 ? 0 : Math.round((value / total) * 100);

  // zoom
  const [zoomLevel, setZoomLevel] = useState(0.9);
  const tableRefZoom = useRef<HTMLTableElement | null>(null);

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

  return (
    <div
      className={clsx(
        additionalCss?.outerDiv ?? "overflow-auto max-h-screen min-w-full"
      )}
    >
      <table
        ref={tableRefZoom}
        style={{ zoom: zoomLevel }}
        className="border border-gray-300 w-full"
      >
        <thead className="sticky top-0 z-10">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="bg-[#444444] text-white text-center p-2 border border-white relative text-nowrap cursor-default"
                onMouseEnter={() => setHoveredColumn(header)}
                onMouseLeave={() => setHoveredColumn(null)}
              >
                <div>{header.replace(/_/g, " ")}</div>

                {stats[header] && (
                  <div className="flex mt-1 h-1 w-full rounded overflow-hidden">
                    {(() => {
                      const stat = stats[header];
                      const total = getTotal(stat);
                      return (
                        <>
                          <div
                            className="bg-green-500"
                            style={{
                              width: `${getPercent(stat.complete, total)}%`,
                            }}
                          />
                          <div
                            className="bg-orange-400"
                            style={{
                              width: `${getPercent(stat.error, total)}%`,
                            }}
                          />
                          <div
                            className="bg-gray-600"
                            style={{
                              width: `${getPercent(stat.missing, total)}%`,
                            }}
                          />
                        </>
                      );
                    })()}
                  </div>
                )}

                {hoveredColumn === header && stats[header] && (
                  <div className="absolute top-full mt-1 left-1/2 -translate-x-1/2 z-50">
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
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-100 cursor-pointer">
              {headers.map((key) => (
                <td
                  key={key}
                  className={clsx(
                    "min-w-28 p-2 border border-gray-300 bg-white",
                    {
                      "text-right":
                        typeof row[key] === "number" || row[key] === "NA",
                      "text-center": typeof row[key] !== "number",
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

export default TableWithErrorIndicators;
