import { useState } from "react";

//components
import ZoomSlider from "../../../components/ZoomSlider";
import TransitionMatrixCountTable from "../../../components/transition_matrix_components/TransitionMatrixCountTable";

//helpers
import { generateTransitionMatrixDummyData } from "../../../utils/CommonHelper";

const Step8 = () => {
  const [zoom, setZoom] = useState(0.9);      
  const data = generateTransitionMatrixDummyData();
  return (
    <div className="flex flex-col w-full mt-6">
      <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-1" />
      <div className="px-4 py-1 min-w-full min-h-full overflow-auto">
        <div className="w-full flex flex-row space-x-16">
          {Array.from({ length: 4 }, (_, index) => {
            return (
              <div>
                <div className="w-full flex flex-row justify-start items-center space-x-12">
                  <h1 className="text-xl font-bold mb-4">
                    {index}
                  </h1>
                  <h1 className="text-xl font-bold mb-4">
                    Transition Matrix (Count)
                  </h1>
                </div>
                <div className="w-full flex flex-col space-y-4">
                  {Array.from({ length: 4 }, (_,) => {
                    return (
                      <TransitionMatrixCountTable
                        data={data}
                        format="number"
                        decimalPlaces={0}
                        zoomLevel={zoom}
                        setZoomLevel={setZoom}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>         
    </div>

  );
};

export default Step8;
