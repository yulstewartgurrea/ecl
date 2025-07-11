import { useState } from "react";

// components
import ZoomSlider from "../../../components/ZoomSlider";
import TransitionMatrixPercentageCountTable from "../../../components/transition_matrix_components/TransitionMatrixPercentageCountTable";

// helpers
import { generateTransitionMatrixDummyData, generateTransitionMatrixPercentageDummyData } from "../../../utils/CommonHelper";
import TableTemplate2 from "../../../components/TableTemplate2";

const dummyData: any[] = [
  {
  "Usual  Bucket": "0",
    "0": 0.9635,
    "1": 0.00251,
    "2": 0.0094,
    "3": 0.0001,
    "4": 0.0018,
    Total: 0.0,
  },
  {
    "Usual  Bucket": "1",
    "0": 0.0603,
    "1": 0.0041,
    "2": 0.4326,
    "3": 0.1993,
    "4": 0.0,
    Total: 0.0,
  },
  {
    "Usual  Bucket": "2",
    "0": 0.0711,
    "1": 0.0,
    "2": 0.0357,
    "3": 0.5771,
    "4": 0.0304,
    Total: 0.0,
  },
  {
    "Usual  Bucket": "3",
    "0": 0.0425,
    "1": 0.017,
    "2": 0.0,
    "3": 0.0238,
    "4": 0.756,
    Total: 0.0,
  },
  {
    "Usual  Bucket": "4",
    "0": 0.0018,
    "1": 0.001,
    "2": 0.008,
    "3": 0.0002,
    "4": 0.989,
    Total: 0.0,
  },
];

const Step8 = () => {
  const [zoom, setZoom] = useState(0.9);

  const year = 2020;

  const matrixDataByMonth = Array.from({ length: 12 }, (_, monthIndex) => {
    return generateTransitionMatrixDummyData(year, monthIndex);
  }); 

  const matrixDataByMonthPercentage = Array.from({ length: 12 }, (_, monthIndex) => {
    return generateTransitionMatrixPercentageDummyData(year, monthIndex);
  });

  console.log('matrixDataByMonth: ', matrixDataByMonth)
  return (
    <div className="flex flex-col w-full mt-6">
      <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-1" />
      <div className="px-4 py-1 min-w-full min-h-full overflow-auto">
        <div className="w-full flex flex-row space-x-16">
          {[
            "Transition Matrix - Count",
            "Transition Matrix - Percentage",
            "Average Transition Matrix",
          ].map((title, typeIndex) => (
            <div key={typeIndex}>
              <div className="w-full flex flex-row justify-start items-center space-x-12">
                <h1 className="text-xl font-bold mb-4">{typeIndex + 1}</h1>
                <h1 className="text-xl font-bold mb-4">{title}</h1>
              </div>
              <div className="w-full flex flex-col space-y-4">
                {typeIndex === 0 ? (
                  matrixDataByMonth.map((data, monthIndex) => (
                    <TransitionMatrixPercentageCountTable
                      key={`${typeIndex}-${monthIndex}`}
                      data={data}
                      format="number"
                      decimalPlaces={0}
                      zoomLevel={zoom}
                      setZoomLevel={setZoom}
                    />
                  ))
                ) :typeIndex === 1 ? (
                  matrixDataByMonthPercentage.map((data, monthIndex) => (
                    <TransitionMatrixPercentageCountTable
                      key={`${typeIndex}-${monthIndex}`}
                      data={data}
                      format="percentage"
                      decimalPlaces={2}
                      zoomLevel={zoom}
                      setZoomLevel={setZoom}
                    />
                  ))
                ): (
                  <TableTemplate2
                    data={dummyData}
                    headersParams={["Usual  Bucket", "0", "1", "2", "3", "4", "Total"]}
                    format="percentage"
                    decimalPlaces={2}
                    zoomLevel={zoom}
                    setZoomLevel={setZoom}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Step8;
