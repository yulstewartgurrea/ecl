import { useState } from "react";

//components
import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";

//helpers
import { generateDefaultRateDummyData } from "../../../utils/CommonHelper";

const Step7 = () => {
  const [zoom, setZoom] = useState(0.9);
  const dummyData = generateDefaultRateDummyData(100);

  return (
    <div className="bg-white p-4 rounded-lg mt-12">
      <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-2" />
      <TableTemplate1
        data={dummyData}
        format="decimal"
        decimalPlaces={0}
        zoomLevel={zoom}
        setZoomLevel={setZoom}
      />
      ;
    </div>
  );
};

export default Step7;
