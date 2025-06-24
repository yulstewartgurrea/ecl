import { useState, useRef, useEffect } from 'react';
import clsx from 'clsx';
import TableWithErrorIndicators from './TableWithErrorIndicators';
import { generateDummyTableData } from '../../utils/CommonHelper';

const TabbedInterface = () => {
  const [inputFiles] = useState<string[]>([
    "20240430_Input_Data",    
    "20240531_Input_Data",    
    "20240630_Input_Data",
    "20240731_Input_Data",
    "20240830_Input_Data",
    "20240931_Input_Data",
    "20241030_Input_Data",
    "20241131_Input_Data",
    "20241230_Input_Data",
  ]);
  const [activeTab, setActiveTab] = useState(0);
  const [visibleCount, setVisibleCount] = useState(inputFiles.length);
  const containerRef = useRef<HTMLDivElement>(null);

  const [metricsMap] = useState<Record<string, { valid: number; error: number; missing: number }>>({
    "20240430_Input_Data": { valid: 85, error: 10, missing: 5 },
    "20240531_Input_Data": { valid: 60, error: 30, missing: 10 },
    "20240630_Input_Data": { valid: 95, error: 4, missing: 1 },
    "20240731_Input_Data": { valid: 40, error: 40, missing: 20 },
    "20240830_Input_Data": { valid: 70, error: 25, missing: 5 },
    "20240931_Input_Data": { valid: 90, error: 5, missing: 5 },
    "202401030_Input_Data": { valid: 50, error: 30, missing: 20 },
    "202401131_Input_Data": { valid: 75, error: 15, missing: 10 },
    "202401230_Input_Data": { valid: 75, error: 15, missing: 10 }    
  });

  const TAB_WIDTH = 140;

  useEffect(() => {
    const calculateVisibleTabs = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const maxTabs = Math.floor((containerWidth - 40) / TAB_WIDTH);
        setVisibleCount(maxTabs);
      }
    };
    calculateVisibleTabs();
    window.addEventListener("resize", calculateVisibleTabs);
    return () => window.removeEventListener("resize", calculateVisibleTabs);
  }, []);

  const visibleTabs = inputFiles.slice(0, visibleCount);
  const overflowTabs = inputFiles.slice(visibleTabs.length);
const activeFile = inputFiles[activeTab];
  const currentMetrics = metricsMap[activeFile] || { valid: 0, error: 0, missing: 0 };
  const dummyData:any = generateDummyTableData(100);
  console.log('dummyData: ', dummyData)
  return (
    <>
      <div className="flex mt-8 relative" ref={containerRef}>
        {visibleTabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={clsx(
              "mr-1 py-2 px-4 rounded-t-md w-[140px] truncate text-ellipsis whitespace-nowrap",
              "disabled:cursor-not-allowed disabled:opacity-50",
              activeTab === index
                ? "bg-[#ad8a49] text-white"
                : "border-x border-t border-gray-300 text-gray-500 bg-gray-50"
            )}
          >
            {tab}
          </button>
        ))}

        {overflowTabs.length > 0 && (
          <div className="relative group">
            <button
              className="w-10 h-[42px] rounded-t-md border-x border-t border-gray-300 text-gray-500 bg-gray-50 flex items-center justify-center"
            >
              ▼
            </button>
            <div className="absolute top-full left-0 bg-white border border-gray-300 rounded-md shadow-lg z-10 hidden group-hover:block">
              {overflowTabs.map((tab, i) => {
                const realIndex = visibleTabs.length + i;
                return (
                  <div
                    key={realIndex}
                    onClick={() => setActiveTab(realIndex)}
                    className={clsx(
                      "px-4 py-2 cursor-pointer hover:bg-gray-100 truncate w-[140px]",
                      activeTab === realIndex && "bg-[#ad8a49] text-white"
                    )}
                  >
                    {tab}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="w-full min-h-screen bg-[#f3f0ea] border border-gray-300 rounded-b-md border-t-0 px-6 py-4">

        {/* Main Progress Bar (Dynamic per active tab) */}
        <div className="mb-4 mt-2">
          <div className='w-full flex flex-row items-center gap-4'>
            <div className="h-10 w-7/12 bg-gray-200 overflow-hidden flex">
              <div className="bg-green-500 h-full" style={{ width: `${currentMetrics.valid}%` }} />
              <div className="bg-orange-400 h-full" style={{ width: `${currentMetrics.error}%` }} />
              <div className="bg-gray-700 h-full" style={{ width: `${currentMetrics.missing}%` }} />
            </div>
            <div className='flex flex-grow gap-2 justify-between'>
              <span>12 Columns</span>
              <span>1110 Rows</span>
              <span>5 Data Types</span>
            </div>
          </div>

          <div className="flex gap-6 mt-2 text-sm items-center">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-sm" />
              <span>{currentMetrics.valid}% Valid</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-orange-400 rounded-sm" />
              <span>{currentMetrics.error}% Error</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-gray-700 rounded-sm" />
              <span>{currentMetrics.missing}% Missing</span>
            </div>
          </div>

          <div className='mt-6'>
            <TableWithErrorIndicators data={dummyData} inputFile={inputFiles[activeTab]}/>
          </div>
        </div>  
      </div>    
    </>
  );
};

export default TabbedInterface;

