import { useEffect, useState } from "react";

//components
import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";

import { useAppSelector } from "../../../redux_toolkit/hooks";
import { useSelector } from "react-redux";
import type { RootState } from "../../../redux_toolkit/store";

const Step7 = () => {
  const [zoom, setZoom] = useState(0.9);
  const [data, setData] = useState<any[]>([]);
  const authToken = useAppSelector((state) => state.auth.token);
  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);
  const directoryPath = `/${entity}/${period}/${workflowName}`;

  useEffect(() => {
    const fetchData = async () => {
      try {
        // First fetch: consolidated rows
        const response = await fetch(
          `http://localhost:8000/documents/consolidated-rows?workflow_path=${directoryPath}`,
          {
            method: "GET", // ⬅️ Include this for clarity
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );
        if (!response.ok) {
          throw new Error("Failed to fetch consolidated rows");
        }

        const result = await response.json();
        const payload = {
          workflow_path: directoryPath,
          row: result,
        };
        // Second fetch: pivot the data via POST
        const response_everbad = await fetch(
          "http://localhost:8000/documents/bucket-dpd-everbad",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(payload),
          }
        );

        if (!response_everbad.ok) {
          throw new Error("Failed to fetch pivoted data");
        }
        const result_everbad = await response_everbad.json();
        const payload2 = {
          workflow_path: directoryPath,
          row: result_everbad,
        };
        // Second fetch: pivot the data via POST
        const calculate_odr = await fetch(
          "http://localhost:8000/documents/calculate-odr",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(payload2),
          }
        );

        if (!calculate_odr.ok) {
          throw new Error("Failed to fetch pivoted data");
        }

        const result_calculated_odr = await calculate_odr.json();
        console.log("result_calculated_odr", result_calculated_odr);
        setData(result_calculated_odr);

        const odrArray: Array<{
          "Observation point": string;
          ODR: string;
        }> = result_calculated_odr;

        if (Array.isArray(odrArray) && odrArray.length > 0) {
          const storageKey = "odr_by_point";
          const raw = localStorage.getItem(storageKey);
          const existing: { "Observation point": string; ODR: string }[] = raw
            ? JSON.parse(raw)
            : [];

          // ▶ Iterate over all new ODR entries
          odrArray.forEach(({ "Observation point": obsPoint, ODR }) => {
            const idx = existing.findIndex(
              (e) => e["Observation point"] === obsPoint
            );
            if (idx >= 0) {
              // update existing entry
              existing[idx].ODR = ODR;
            } else {
              // add new entry
              existing.push({ "Observation point": obsPoint, ODR });
            }
          });

          // ▶ Save the merged array back to localStorage
          localStorage.setItem(storageKey, JSON.stringify(existing));
          console.log("Updated odr_by_point:", existing);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, []);
  return (
    <div className="bg-white p-4 rounded-lg mt-12">
      <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-2" />
      <TableTemplate1
        data={data}
        format="decimal"
        decimalPlaces={0}
        zoomLevel={zoom}
        setZoomLevel={setZoom}
      />
    </div>
  );
};

export default Step7;
