import React, { useRef, useState, useEffect } from "react";
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

const OverTableTemplate2: React.FC<OverTableTemplate2Props> = ({
  data,
  format = "money",
  decimalPlaces = 2,
  headersParams,
  additionalCss,
  zoomLevel: controlledZoomLevel,
  setZoomLevel: controlledSetZoomLevel,
}) => {
  const tableRef = useRef<HTMLDivElement>(null);
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
        const delta = event.deltaY < 0 ? 0.1 : -0.1;
        const newZoom = Math.min(Math.max(zoomLevel + delta, 0.5), 2);
        setZoomLevel(newZoom);
      }
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    return () => window.removeEventListener("wheel", handleWheel);
  }, [zoomLevel, setZoomLevel]);
  return (
    <div ref={tableRef} className="overflow-auto max-h-screen min-w-full">
      <table
        style={{ zoom: zoomLevel }}
        className="border border-gray-300 w-full"
      >
        <thead className="sticky top-0 z-10">
          <tr>
            {headers.map((header, headerIndex: number) => (
              <th
                key={header}
                className={clsx(
                  "min-w-20 text-center px-2 py-1 border border-gray-300",
                  {
                    "bg-[#dcdcdc] text-gray-700": headerIndex !== 0,
                    "bg-[#444444] text-white": headerIndex === 0,
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
            <tr key={rowIndex} className="hover:bg-gray-100 cursor-pointer">
              {headers.map((key, headerMapIndex) => {
                // 1️⃣ Compute the displayValue exactly as you do in your JSX:
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

                // 2️⃣ If this is Month 12 AND Bucket 4, log the formatted value
                if (row.Month === "Month 12" && row.Bucket === 4) {
                  console.log(
                    "🗓️ Month 12 – Bucket 4 cell:",
                    key,
                    "→",
                    displayValue
                  );
                }

                // 3️⃣ Finally render
                return (
                  <td
                    key={key}
                    className={clsx("min-w-20 px-2 py-1 border text-center", {
                      [additionalCss?.firstColColor!]:
                        headerMapIndex === 0 && !!additionalCss?.firstColColor,
                      "bg-[#dcdcdc] border-gray-300":
                        headerMapIndex === 0 && !additionalCss?.firstColColor,
                      "bg-white border-gray-200": headerMapIndex !== 0,
                    })}
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

export default OverTableTemplate2;
