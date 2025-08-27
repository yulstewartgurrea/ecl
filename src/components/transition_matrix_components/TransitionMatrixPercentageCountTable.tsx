import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { formatValueGeneral } from "../../utils/CommonHelper";

interface TransitionMatrixCountTableProps {
  data: Array<{ [key: string]: any }>;
  format?: string;
  decimalPlaces?: number;
  zoomLevel?: number; // optional controlled zoom level
  setZoomLevel?: (value: number) => void; // optional controlled zoom setter
}

const TransitionMatrixPercentageCountTable: React.FC<
  TransitionMatrixCountTableProps
> = ({
  data,
  format = "number",
  decimalPlaces = 0,
  zoomLevel: controlledZoomLevel,
  setZoomLevel: controlledSetZoomLevel,
}) => {
  if (!data || data.length === 0) return null;

  const row = data[0];
  const keys = Object.keys(row);

  const dateKey = keys.find(
    (key) => !key.includes("_") && /^\d{2}\/\d{2}\/\d{4}$/.test(key)
  );
  const bucketKey = keys.find((key) => key.includes("_Bucket"));
  const dpdKeys = keys
    .filter((key) => key.includes("_") && /\d+$/.test(key.split("_")[1]))
    .sort((a, b) => {
      const aNum = parseInt(a.split("_")[1], 10);
      const bNum = parseInt(b.split("_")[1], 10);
      return aNum - bNum;
    });
  const naKey = keys.find((key) => key.endsWith("_NA"));
  const totalKey = keys.find((key) => key === "Total Accounted Evaluated");

  const orderedKeys = [
    ...(dateKey ? [dateKey] : []),
    ...(bucketKey ? [bucketKey] : []),
    ...dpdKeys,
    ...(naKey ? [naKey] : []),
    ...(totalKey ? [totalKey] : []),
  ];

  const headersRow1 = orderedKeys.map((key) => {
    if (!key.includes("_")) return key;
    if (key === totalKey) return key;
    return key.split("_")[0];
  });
  const headersRow2 = orderedKeys.map((key) => {
    if (!key.includes("_") || key === totalKey) return "";
    return key.split("_")[1];
  });

  // Internal zoom state if not controlled
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
    <div className="overflow-auto max-h-[72vh] min-w-full rounded-lg border border-gray-200 bg-white shadow-sm">
      <table
        style={{ zoom: zoomLevel }}
        className="w-full table-fixed border-collapse text-sm"
      >
        <thead className="sticky top-0 z-20">
          <tr>
            {headersRow1.map((val, i) => (
              <th
                key={`header1-${i}`}
                className="bg-gradient-to-r from-gray-700 to-gray-600 text-white text-center px-3 py-2 border border-white"
                rowSpan={headersRow2[i] ? 1 : 2}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="font-medium text-xs tracking-wide">
                    {val}
                  </span>
                </div>
              </th>
            ))}
          </tr>
          <tr>
            {headersRow2.map((val, i) =>
              val ? (
                <th
                  key={`header2-${i}`}
                  className={clsx(
                    "font-semibold text-center px-2 py-1 border border-gray-200 text-xs",
                    {
                      "bg-gray-50": val === "Bucket",
                      "bg-gray-100": val !== "Bucket",
                    }
                  )}
                >
                  {val}
                </th>
              ) : null
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={clsx(
                "cursor-default",
                rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50",
                "hover:bg-gray-100"
              )}
            >
              {orderedKeys.map((key, colIndex) => (
                <td
                  key={colIndex}
                  className={clsx(
                    "px-3 py-2 border border-gray-100 text-center align-middle truncate",
                    {
                      "font-medium bg-gray-50": key.includes("Bucket"),
                      "bg-white": !key.includes("Bucket"),
                    }
                  )}
                >
                  {typeof row[key] === "number" && !key.includes("Bucket")
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

export default TransitionMatrixPercentageCountTable;
