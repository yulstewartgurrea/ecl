import React, { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { formatValueGeneral } from "../utils/CommonHelper";

interface OverTableTemplate2Props {
  data: Array<{ [key: string]: any }>;
  format?: string;
  decimalPlaces?: number;
  headersParams?: string[];
  additionalCss?: any;
  zoomLevel?: number; // optional controlled zoom level
  setZoomLevel?: (value: number) => void; // optional controlled zoom setter
}

const TableTemplate2: React.FC<OverTableTemplate2Props> = ({
  data,
  format = "money",
  decimalPlaces = 2,
  headersParams,
  additionalCss,
  zoomLevel: controlledZoomLevel,
  setZoomLevel: controlledSetZoomLevel,
}) => {
  const tableRef = useRef<HTMLDivElement | null>(null);
  const headers =
    headersParams ?? (data.length > 0 ? Object.keys(data[0]) : []);

  // Internal zoom state if not controlled via props
  const [internalZoomLevel, setInternalZoomLevel] = useState(0.9);

  // Use controlled zoom if provided, else internal
  const zoomLevel = controlledZoomLevel ?? internalZoomLevel;
  const setZoomLevel = controlledSetZoomLevel ?? setInternalZoomLevel;

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey) {
        event.preventDefault();
        const delta = event.deltaY < 0 ? 0.075 : -0.075;
        const newZoom = Math.min(Math.max(zoomLevel + delta, 0.5), 2);
        setZoomLevel(newZoom);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [zoomLevel, setZoomLevel]);

  return (
    <div
      ref={tableRef}
      className="overflow-auto max-h-[72vh] min-w-full rounded-lg border border-gray-200 bg-white shadow-sm"
    >
      <table
        style={{ zoom: zoomLevel }}
        className="w-full border-collapse text-sm"
      >
        <thead className="sticky top-0 z-20">
          <tr>
            {headers.map((header, headerIndex: number) => (
              <th
                key={header}
                className={clsx(
                  "text-center px-3 py-2 border border-gray-100 whitespace-nowrap text-xs",
                  {
                    "bg-gray-800 text-white": headerIndex === 0,
                    "bg-gray-50 text-gray-700": headerIndex !== 0,
                  }
                )}
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
              className={clsx(
                rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50",
                "hover:bg-gray-100"
              )}
            >
              {headers.map((key, headerMapIndex) => {
                let displayValue;
                if (key === "Bucket") {
                  displayValue = row[key];
                } else if (typeof row[key] === "number") {
                  displayValue = formatValueGeneral(
                    row[key],
                    format,
                    decimalPlaces
                  );
                } else {
                  displayValue = row[key];
                }

                if (row.Month === "Month 12" && row.Bucket === 4) {
                  console.log(
                    "🗓️ Month 12 – Bucket 4 cell:",
                    key,
                    "→",
                    displayValue
                  );
                }

                return (
                  <td
                    key={key}
                    className={clsx(
                      "px-3 py-2 border text-center align-middle truncate text-sm",
                      {
                        [additionalCss?.firstColColor!]:
                          headerMapIndex === 0 &&
                          !!additionalCss?.firstColColor,
                        "bg-gray-50 border-gray-100":
                          headerMapIndex === 0 && !additionalCss?.firstColColor,
                        "bg-white border-gray-100": headerMapIndex !== 0,
                      }
                    )}
                  >
                    {displayValue}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableTemplate2;
