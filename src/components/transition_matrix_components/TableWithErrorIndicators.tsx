import React, { useEffect, useRef, useState } from "react";
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

const mockColumnStats: Record<string, Record<string, ColumnStats>> = {
  "20240430_Input_Data": {
    report_date: { complete: 950, error: 25, missing: 25 },
    load_segment: { complete: 1000, error: 0, missing: 0 },
    cis_number: { complete: 970, error: 0, missing: 30 },
    pn_number: { complete: 980, error: 15, missing: 5 },
    loan_amount: { complete: 910, error: 50, missing: 40 },
    outstanding_balance: { complete: 930, error: 35, missing: 35 },
    amortization: { complete: 860, error: 90, missing: 50 },
    booking_date: { complete: 1000, error: 0, missing: 0 },
    maturity_date: { complete: 870, error: 80, missing: 50 },
  },
  "20240531_Input_Data": {
    report_date: { complete: 800, error: 120, missing: 80 },
    load_segment: { complete: 980, error: 10, missing: 10 },
    cis_number: { complete: 910, error: 60, missing: 30 },
    pn_number: { complete: 850, error: 100, missing: 50 },
    loan_amount: { complete: 900, error: 60, missing: 40 },
    outstanding_balance: { complete: 940, error: 30, missing: 30 },
    amortization: { complete: 890, error: 50, missing: 60 },
    booking_date: { complete: 970, error: 20, missing: 10 },
    maturity_date: { complete: 860, error: 80, missing: 60 },
  },
  "20240630_Input_Data":  {
    report_date: { complete: 800, error: 120, missing: 80 },
    load_segment: { complete: 980, error: 10, missing: 10 },
    cis_number: { complete: 910, error: 60, missing: 30 },
    pn_number: { complete: 850, error: 100, missing: 50 },
    loan_amount: { complete: 900, error: 60, missing: 40 },
    outstanding_balance: { complete: 940, error: 30, missing: 30 },
    amortization: { complete: 890, error: 50, missing: 60 },
    booking_date: { complete: 970, error: 20, missing: 10 },
    maturity_date: { complete: 860, error: 80, missing: 60 },
  },
};

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
  const stats = mockColumnStats[inputFile] || {};

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
