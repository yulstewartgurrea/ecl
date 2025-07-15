import { useState } from "react";

//components
import TableTemplate2 from "../../../components/TableTemplate2";
import ZoomSlider from "../../../components/ZoomSlider";

const Step9 = () => {
  const [zoom, setZoom] = useState(0.9);
  const dummyData: any[] = [
    {
      Bucket: "0",
      "0": 0.9635,
      "1": 0.00251,
      "2": 0.0094,
      "3": 0.0001,
      "4": 0.0018,
      Total: 0.0,
    },
    {
      Bucket: "1",
      "0": 0.0603,
      "1": 0.0041,
      "2": 0.4326,
      "3": 0.1993,
      "4": 0.0,
      Total: 0.0,
    },
    {
      Bucket: "2",
      "0": 0.0711,
      "1": 0.0,
      "2": 0.0357,
      "3": 0.5771,
      "4": 0.0304,
      Total: 0.0,
    },
    {
      Bucket: "3",
      "0": 0.0425,
      "1": 0.017,
      "2": 0.0,
      "3": 0.0238,
      "4": 0.756,
      Total: 0.0,
    },
    {
      Bucket: "4",
      "0": 0.0018,
      "1": 0.001,
      "2": 0.008,
      "3": 0.0002,
      "4": 0.989,
      Total: 0.0,
    },
  ];

  return (
    <div className="bg-white pr-4 py-4 rounded-lg mt-6 min-w-full max-w-full">
      <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-2"/>
      <div className=" grid grid-cols-2 gap-1 overflow-auto max-h-[750px] mt-4">
        <div className="w-full flex flex-col px-4 col-span-1">
          <h3 className="font-semibold mb-4">Average Transition Matrix</h3>
          <TableTemplate2
            data={dummyData}
            headersParams={["Bucket", "0", "1", "2", "3", "4", "Total"]}
            format="percentage"
            decimalPlaces={2}
            zoomLevel={zoom}
            setZoomLevel={setZoom}
          />
          ;
        </div>
        <div className="w-full flex flex-col px-4 col-span-1">
          <h3 className="font-semibold mb-4">Matrix Multiplication</h3>
          {Array.from({ length: 12 }, (__, i) => (
            <div key={`matrix-multiplication-${i}`} className="mb-6">
              <div className="flex flex-row w-full justify-between gap-2">
                <span className="text-nowrap">Month {i + 1}</span>
                <TableTemplate2
                  data={dummyData}
                  headersParams={["Bucket", "0", "1", "2", "3", "4", "Total"]}
                  format="percentage"
                  decimalPlaces={2}
                  zoomLevel={zoom}
                  setZoomLevel={setZoom}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Step9;
