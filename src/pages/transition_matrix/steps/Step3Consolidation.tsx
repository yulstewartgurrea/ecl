import { useState } from "react";

//components
import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";

//helpers
import { generateDummyTableData } from "../../../utils/CommonHelper";

const Step3Consolidation = () => {
    const [zoom, setZoom] = useState(0.9);
  const dummyData = generateDummyTableData(100);
  const filteredDummyData = dummyData.map((item:any)=>{
    const { maturity_date, ...rest} = item
    return rest
  })
  
  return (
    <div className="bg-white p-4 rounded-lg mt-12">
        <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6 mb-2"/>
      <TableTemplate1 data={filteredDummyData} zoomLevel={zoom} setZoomLevel={setZoom} />;
    </div>
  );
};

export default Step3Consolidation;

