// import { useState, useMemo, useEffect } from "react";
// import {
//   ArrowDownTrayIcon,
//   DocumentPlusIcon,
//   XMarkIcon,
// } from "@heroicons/react/16/solid";
// import { FunnelIcon } from "@heroicons/react/24/outline";
// import TableTemplate1 from "../../../components/TableTemplate1";
// import ZoomSlider from "../../../components/ZoomSlider";
// import LineGraph from "../../../components/visuals/LineGraph";
// import { generateODRDummyData } from "../../../utils/CommonHelper";

// const YEARS = [2021, 2022, 2023, 2024, 2025];
// const MONTHS = [
//   "January", "February", "March", "April", "May", "June",
//   "July", "August", "September", "October", "November", "December"
// ];

// const Step11 = () => {
//   const [zoom, setZoom] = useState(0.9);
//   const [dummyData, setDummyData] = useState<any[]>([])

//   useEffect(()=>{
//   if(!dummyData || dummyData?.length === 0){
//     const generateDummyData = generateODRDummyData(60);
//     setDummyData(generateDummyData)
//   }
//   },[])
  

//   const [filterOpen, setFilterOpen] = useState(false);
//   const [selectedYears, setSelectedYears] = useState<number[]>([2021]);
//   const [startMonth, setStartMonth] = useState("January");
//   const [endMonth, setEndMonth] = useState("December");

//   const toggleYear = (y: number) =>
//     setSelectedYears((prev) =>
//       prev.includes(y) ? prev.filter((v) => v !== y) : [...prev, y]
//     );

//   // Filter graph data
//   const filteredData = useMemo(() => {
//     if(!dummyData || dummyData?.length === 0) return []
//     const si = MONTHS.indexOf(startMonth);
//     const ei = MONTHS.indexOf(endMonth);

//     return dummyData.filter(({ Time }) => {
//       const [mo, , yr] = Time.split("/").map(Number);
//       const m = mo - 1;
//       return selectedYears.includes(yr) && m >= si && m <= ei;
//     });
//   }, [dummyData, selectedYears, startMonth, endMonth]);

//   const graphParams = {
//     xValues: filteredData.map((d) => d.Time),
//     yValues: [
//       {
//         label: "ODR",
//         data: filteredData.map((d) => d.ODR),
//         borderColor: "rgba(255,205,86,1)",
//         backgroundColor: "rgba(255,205,86,0.2)",
//         fill: false,
//         tension: 0.1,
//       },
//     ],
//     dataLabel: "ODR",
//     xAxisLabel: "Month",
//     yAxisLabel: "ODR (%)",
//     format: "percent" as const,
//     yAxisLabelFormat: "percent" as const,
//     decimalPlaces: 2,
//     showGrid: true,
//     showYLabels: true,
//     showPointLabels: false,
//     title: "Historical Default Rate",
//     chartAreaBackgroundColor: "#f9fafb",
//   };

//   return (
//     <div className="bg-white p-4 rounded-lg flex flex-col items-center w-full">
//       <div className="flex w-full items-start">
//         <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6" />
//       </div>

//       <div className="grid grid-cols-3 w-full gap-12">
//         <div className="col-span-1 overflow-auto max-h-[600px] border border-gray-300 rounded hide-scrollbar">
//           <TableTemplate1
//             data={dummyData}
//             additionalCss={{
//               outerDiv: "overflow-auto max-h-[600px] min-w-full",
//             }}
//             format="percentage"
//             decimalPlaces={2}
//             zoomLevel={zoom}
//             setZoomLevel={setZoom}
//           />
//         </div>

//         <div className="col-span-2 flex flex-col items-start">
//           <div className="relative flex items-start w-full">
//             <button
//               onClick={() => setFilterOpen((o) => !o)}
//               className="w-24 flex items-center justify-center gap-1 bg-[#fce404] px-3 py-1 cursor-pointer rounded-lg"
//             >
//               <FunnelIcon className="w-4 h-4" /> Filter
//             </button>
//           {filterOpen && (
//             <div className="absolute top-7 left-0 mt-2 w-[360px] bg-white border border-gray-300 rounded shadow-lg z-10 space-y-2 p-4">
              
//               {/* Year filter header with X button */}
//               <div className="flex justify-between items-center">
//                 <p className="font-medium mb-1">Year</p>
//                 <button onClick={() => setFilterOpen(false)}>
//                   <XMarkIcon className="w-5 h-5 hover:bg-red-100 rounded" />
//                 </button>
//               </div>

//               {/* Year checkboxes */}
//               <div className="grid grid-cols-4 gap-2">
//                 {YEARS.map((y) => (
//                   <label key={y} className="inline-flex items-center gap-2 text-xs">
//                     <input
//                       type="checkbox"
//                       checked={selectedYears.includes(y)}
//                       onChange={() => toggleYear(y)}
//                       className="accent-gray-300"
//                     />
//                     {y}
//                   </label>
//                 ))}
//               </div>

//               {/* Start month (single select) */}
//               <div className="border-t border-t-gray-200 pt-2 pb-1">
//                 <p className="font-medium mb-1">Start Month</p>
//                 <div className="grid grid-cols-4 gap-2">
//                   {MONTHS.map((m) => (
//                     <label key={m} className="inline-flex items-center gap-2 text-xs">
//                       <input
//                         type="checkbox"
//                         checked={startMonth === m}
//                         onChange={() => setStartMonth(m)}
//                         className="accent-gray-300"
//                       />
//                       {m}
//                     </label>
//                   ))}
//                 </div>
//               </div>

//               {/* End month (single select) */}
//               <div className="border-t border-t-gray-200 pt-2">
//                 <p className="font-medium mb-1">End Month</p>
//                 <div className="grid grid-cols-4 gap-2">
//                   {MONTHS.map((m) => (
//                     <label key={m} className="inline-flex items-center gap-2 text-xs">
//                       <input
//                         type="checkbox"
//                         checked={endMonth === m}
//                         onChange={() => setEndMonth(m)}
//                         className="accent-gray-300"
//                       />
//                       {m}
//                     </label>
//                   ))}
//                 </div>
//               </div>
//             </div>
//           )}

//           </div>          
//           <div className="w-11/12 min-h-[500px] border border-gray-300 rounded mt-4">
//             <LineGraph {...graphParams} />
//           </div>
//         </div>
//       </div>

//       <div className="flex justify-center items-center gap-4 mt-4">
//         <button
//           // onClick={onSaveProgress}
//           className="bg-[#fce404] cursor-pointer border border-gray-500 max-w-60 text-nowrap shadow-md font-bold px-4 py-1 rounded-lg inline-flex items-center justify-center gap-1"
//         >
//           <DocumentPlusIcon className="w-5 h-5 font-bold" />
//           Save Progress
//         </button>

//         <button
//           // onClick={onDownload}
//           className="bg-white cursor-pointer border border-gray-500 shadow-md font-bold px-4 py-1 rounded-lg inline-flex items-center justify-center gap-1"
//         >
//           <ArrowDownTrayIcon className="w-5 h-5 font-bold" />
//           Download
//         </button>
//       </div>
//     </div>
//   );
// };

// export default Step11;


import { useState, useMemo, useEffect } from "react";
import {
  ArrowDownTrayIcon,
  DocumentPlusIcon,
  XMarkIcon,
} from "@heroicons/react/16/solid";
import { FunnelIcon } from "@heroicons/react/24/outline";
import TableTemplate1 from "../../../components/TableTemplate1";
import ZoomSlider from "../../../components/ZoomSlider";
import LineGraph from "../../../components/visuals/LineGraph";
import { generateODRDummyData } from "../../../utils/CommonHelper";

const YEARS = [2021, 2022, 2023, 2024, 2025];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const Step11 = () => {
  const [zoom, setZoom] = useState(0.9);
  const [dummyData, setDummyData] = useState<any[]>([]);

  useEffect(() => {
    if (!dummyData || dummyData.length === 0) {
      const generateDummyData = generateODRDummyData(60);
      setDummyData(generateDummyData);
    }
  }, []);

  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedYears, setSelectedYears] = useState<number[]>([2021]);
  const [startMonth, setStartMonth] = useState("January");
  const [endMonth, setEndMonth] = useState("December");

  const toggleYear = (y: number) => {
    const isSelected = selectedYears.includes(y);
    let newYears = isSelected
      ? selectedYears.filter((v) => v !== y)
      : [...selectedYears, y];

    if (newYears.length === 0) {
      newYears = [Math.min(...YEARS)];
    }

    setSelectedYears(newYears);
  };

  const handleToggleAllYears = () => {
    const allSelected = YEARS.every((y) => selectedYears.includes(y));

    if (allSelected) {
      setSelectedYears([Math.min(...YEARS)]);
    } else {
      setSelectedYears([...YEARS]);
    }
  };

  const isAllSelected = YEARS.every((y) => selectedYears.includes(y));

  // Filter graph data
  const filteredData = useMemo(() => {
    if (!dummyData || dummyData.length === 0) return [];
    const si = MONTHS.indexOf(startMonth);
    const ei = MONTHS.indexOf(endMonth);

    return dummyData.filter(({ Time }) => {
      const [mo, , yr] = Time.split("/").map(Number);
      const m = mo - 1;
      return selectedYears.includes(yr) && m >= si && m <= ei;
    });
  }, [dummyData, selectedYears, startMonth, endMonth]);

  const graphParams = {
    xValues: filteredData.map((d) => d.Time),
    yValues: [
      {
        label: "ODR",
        data: filteredData.map((d) => d.ODR),
        borderColor: "rgba(255,205,86,1)",
        backgroundColor: "rgba(255,205,86,0.2)",
        fill: false,
        tension: 0.1,
      },
    ],
    dataLabel: "ODR",
    xAxisLabel: "Month",
    yAxisLabel: "ODR (%)",
    format: "percent" as const,
    yAxisLabelFormat: "percent" as const,
    decimalPlaces: 2,
    showGrid: true,
    showYLabels: true,
    showPointLabels: false,
    title: "Historical Default Rate",
    chartAreaBackgroundColor: "#f9fafb",
  };

  return (
    <div className="bg-white p-4 rounded-lg flex flex-col items-center w-full">
      <div className="flex w-full items-start">
        <ZoomSlider zoom={zoom} setZoom={setZoom} className="w-1/6" />
      </div>

      <div className="grid grid-cols-3 w-full gap-12">
        <div className="col-span-1 overflow-auto max-h-[600px] border border-gray-300 rounded hide-scrollbar">
          <TableTemplate1
            data={dummyData}
            additionalCss={{
              outerDiv: "overflow-auto max-h-[600px] min-w-full",
            }}
            format="percentage"
            decimalPlaces={2}
            zoomLevel={zoom}
            setZoomLevel={setZoom}
          />
        </div>

        <div className="col-span-2 flex flex-col items-start">
          <div className="relative flex items-start w-full">
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className="w-24 flex items-center justify-center gap-1 bg-[#fce404] px-3 py-1 cursor-pointer rounded-lg"
            >
              <FunnelIcon className="w-4 h-4" /> Filter
            </button>

            {filterOpen && (
              <div className="absolute top-7 left-0 mt-2 w-[360px] bg-white border border-gray-300 rounded shadow-lg z-10 space-y-2 p-4">
                {/* Year filter header with X button */}
                <div className="flex justify-between items-center">
                  <p className="font-medium mb-1">Year</p>
                  <button onClick={() => setFilterOpen(false)}>
                    <XMarkIcon className="w-5 h-5 hover:bg-red-100 rounded" />
                  </button>
                </div>

                {/* Select/Unselect All */}


                {/* Year checkboxes */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="mb-1 flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleToggleAllYears}
                      className="accent-gray-300"
                    />
                    {isAllSelected ? "Unselect All" : "Select All"}
                  </div>                  
                  {YEARS.map((y) => (
                    <label key={y} className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={selectedYears.includes(y)}
                        onChange={() => toggleYear(y)}
                        className="accent-gray-300"
                      />
                      {y}
                    </label>
                  ))}
                </div>

                {/* Start month */}
                <div className="border-t border-t-gray-200 pt-2 pb-1">
                  <p className="font-medium mb-1">Start Month</p>
                  <div className="grid grid-cols-4 gap-2">
                    {MONTHS.map((m) => (
                      <label key={m} className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={startMonth === m}
                          onChange={() => setStartMonth(m)}
                          className="accent-gray-300"
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>

                {/* End month */}
                <div className="border-t border-t-gray-200 pt-2">
                  <p className="font-medium mb-1">End Month</p>
                  <div className="grid grid-cols-4 gap-2">
                    {MONTHS.map((m) => (
                      <label key={m} className="inline-flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={endMonth === m}
                          onChange={() => setEndMonth(m)}
                          className="accent-gray-300"
                        />
                        {m}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="w-11/12 min-h-[500px] border border-gray-300 rounded mt-4">
            <LineGraph {...graphParams} />
          </div>
        </div>
      </div>

      <div className="flex justify-center items-center gap-4 mt-4">
        <button
          className="bg-[#fce404] cursor-pointer border border-gray-500 max-w-60 text-nowrap shadow-md font-bold px-4 py-1 rounded-lg inline-flex items-center justify-center gap-1"
        >
          <DocumentPlusIcon className="w-5 h-5 font-bold" />
          Save Progress
        </button>

        <button
          className="bg-white cursor-pointer border border-gray-500 shadow-md font-bold px-4 py-1 rounded-lg inline-flex items-center justify-center gap-1"
        >
          <ArrowDownTrayIcon className="w-5 h-5 font-bold" />
          Download
        </button>
      </div>
    </div>
  );
};

export default Step11;

