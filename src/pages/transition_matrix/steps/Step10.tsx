import { useState, useEffect } from "react";
import {
  ArrowDownTrayIcon,
  DocumentPlusIcon,
} from "@heroicons/react/24/outline";

//components
import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";

//helpers
import LineGraph from "../../../components/visuals/LineGraph";

type DpdRow = {
  "Aging bucket": string;
  "TTC PD": number;
};

const Step10 = () => {
  const [zoom, setZoom] = useState(0.9);
  const [ttcData, setTtcData] = useState<DpdRow[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("month12_bucket4");
    if (!raw) {
      console.warn("month12_bucket4 not found in localStorage");
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      let dpd4Arr: number[];

      if (
        Array.isArray(parsed) &&
        parsed.length === 5 &&
        parsed.every((n) => typeof n === "number")
      ) {
        // new style: [0.1749, 0.3525, …]
        dpd4Arr = parsed;
      } else if (typeof parsed === "object" && parsed !== null) {
        // old style: { "0 DPD_0": 0.1749, … }
        const keys = [
          "0 DPD_0",
          "1-30 DPD_1",
          "31-60 DPD_2",
          "61-90 DPD_3",
          "91+ DPD_4",
        ];
        dpd4Arr = keys.map((k) => Number(parsed[k] ?? 0));
      } else {
        throw new Error("Unexpected month12_bucket4 shape");
      }

      // Now map those five numbers into your DpdRow[]
      const labels = [
        "0 DPD",
        "1 - 30 DPD",
        "31 - 60 DPD",
        "61 - 90 DPD",
        "91+ DPD",
      ];
      const transformed: DpdRow[] = dpd4Arr.map((val, idx) => ({
        "Aging bucket": labels[idx],
        // convert to % and round
        "TTC PD": val,
      }));

      setTtcData(transformed);
    } catch (e) {
      console.warn("month12_bucket4 parse failed:", e);
    }
  }, []);

  // prepare for line graph
  const prepareChartDataForLineGraph = (data: DpdRow[]) => {
    const xValues = data.map((item) => item["Aging bucket"]);
    const yValues = [
      {
        label: "TTC PD",
        data: data.map((item) => item["TTC PD"]),
        // colors here are defaults you already had
        borderColor: "rgba(255, 204, 0, 1)",
        backgroundColor: "rgba(255, 204, 0, 0.5)",
        fill: false,
        tension: 0.1,
      },
    ];
    return { xValues, yValues };
  };
  const { xValues, yValues } = prepareChartDataForLineGraph(ttcData);

  return (
    <div className="bg-white rounded-lg w-full flex flex-col">
      <div className="flex justify-end items-center gap-4 mt-6 pl-4">
        <button className="bg-[#fce404] cursor-pointer border border-gray-300 max-w-60 text-nowrap font-normal px-4 py-1 rounded-lg inline-flex items-center justify-center gap-1">
          <DocumentPlusIcon className="w-5 h-5 font-normal" />
          Save Progress
        </button>
        <button className="bg-white cursor-pointer border border-gray-300 font-normal px-4 py-1 rounded-lg inline-flex items-center justify-center gap-1">
          <ArrowDownTrayIcon className="w-5 h-5 font-normal" />
          Download
        </button>
      </div>

      <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 px-4 py-2" />

      <div className="w-full flex items-center justify-center font-semibold text-2xl mb-6 px-4 py-2">
        THROUGH THE CYCLE PD
      </div>

      <div className="w-full grid grid-cols-5 gap-6">
        <div className="col-span-2 flex items-center justify-end">
          <div className="w-2/3">
            <TableTemplate1
              data={ttcData}
              format="percentage"
              decimalPlaces={2}
              additionalCss={{ firstColColor: "bg-gray-100" }}
              zoomLevel={zoom}
              setZoomLevel={setZoom}
            />
          </div>
        </div>
        <div className="col-span-3 w-full h-full">
          <div className="w-5/6 h-[450px] p-2 border border-gray-300">
            <LineGraph
              xValues={xValues}
              yValues={yValues}
              dataLabel="TTC PD"
              xAxisLabel="Aging Bucket"
              yAxisLabel="TTC PD"
              title="TTC PD by Aging Bucket"
              showYLabels
              yAxisLabelFormat="percent"
              format="percent"
              showPointLabels
              chartAreaBackgroundColor="#f9fafb"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step10;
