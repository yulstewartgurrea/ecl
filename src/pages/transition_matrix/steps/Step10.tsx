import { useState } from "react";
import { ArrowDownTrayIcon, DocumentPlusIcon } from "@heroicons/react/24/outline";

//components
import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";

//helpers
import LineGraph from "../../../components/visuals/LineGraph";

const Step10 = () => {
  const [zoom, setZoom] = useState(0.9);
  const dummyData = [
    {
      "Aging bucket": "0 DPD",
      "TTC PD": 0.1307,
    },
    {
      "Aging bucket": "1 - 30 DPD",
      "TTC PD": 0.3609,
    },
    {
      "Aging bucket": "31 - 60 DPD",
      "TTC PD": 0.4755,
    },
    {
      "Aging bucket": "61 - 90 DPD",
      "TTC PD": 0.7272,
    },
    {
      "Aging bucket": "91+ DPD",
      "TTC PD": 1,
    },
  ];

  const prepareChartDataForLineGraph = (
    data: { "Aging bucket": string; "TTC PD": number }[]
  ) => {
    const xValues = data.map((item) => item["Aging bucket"]);

    const yValues = [
      {
        label: "TTC PD",
        data: data.map((item) => item["TTC PD"]),
        borderColor: "rgba(255, 204, 0, 1)",
        backgroundColor: "rgba(255, 204, 0, 0.5)",
        fill: false,
        tension: 0.1,
      },
    ];

    return { xValues, yValues };
  };
  const { xValues, yValues } = prepareChartDataForLineGraph(dummyData);
  return (
    <div className="bg-white rounded-lg w-full flex flex-col">
      <div className="flex justify-end items-center gap-4 mt-6 pl-4">
        <button
          // onClick={onSaveProgress}
          className="bg-[#fce404] cursor-pointer border border-gray-300 max-w-60 text-nowrap font-normal px-4 py-1 rounded-lg inline-flex items-center justify-center gap-1"
        >
          <DocumentPlusIcon className="w-5 h-5 font-normal" />
          Save Progress
        </button>

        <button
          // onClick={onDownload}
          className="bg-white cursor-pointer border border-gray-300 font-normal px-4 py-1 rounded-lg inline-flex items-center justify-center gap-1"
        >
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
              data={dummyData}
              format="percentage"
              decimalPlaces={2}
              additionalCss={{ firstColColor: "bg-gray-100" }}
              zoomLevel={zoom}
              setZoomLevel={setZoom}
            />
          </div>
        </div>
        <div className="col-span-3 w-full h-full">
          <div className="w-5/6 h-[450px]  p-2 border border-gray-300">
            <LineGraph
              xValues={xValues}
              yValues={yValues}
              dataLabel="TTC PD"
              xAxisLabel="Aging Bucket"
              yAxisLabel="TTC PD"
              title="TTC PD by Aging Bucket"
              showYLabels={true}
              yAxisLabelFormat="percent"
              format="percent"
              showPointLabels={true}
             chartAreaBackgroundColor= {"#f9fafb"} 
            />
          </div>
        </div>
      </div>

    </div>
  );
};

export default Step10;
