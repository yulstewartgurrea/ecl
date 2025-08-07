import clsx from "clsx";
import { useState } from "react";

//redux toolkit
import { useSelector } from "react-redux";

//components
import TabbedInterface from "../../../components/transition_matrix_components/TabbedInterface";

const Step2 = () => {
  const { isSidebarOpen } = useSelector((state: any) => state.navUIState);
  return (
    // <div
    //   className={clsx(
    //     "grid grid-cols-1 mt-4 min-h-[80%] max-h-[80%] space-y-12 lg:space-y-0 lg:gap-6",
    //     {
    //       "lg:grid-cols-10": isSidebarOpen,
    //       "lg:grid-cols-4": !isSidebarOpen,
    //     }
    //   )}
    // >
    <div
      className={clsx(
        "w-full flex flex-col mt-4 min-h-[80%] max-h-[80%] space-y-12 lg:space-y-0 shadow-sm",
        {
          "col-span-7": isSidebarOpen,
          "col-span-3": !isSidebarOpen,
        }
      )}
    >
      <div
        className={clsx(
          "w-full flex flex-col bg-gray-100 p-4 border border-gray-300 rounded-lg shadow-sm",
          {
            "col-span-7": isSidebarOpen,
            "col-span-3": !isSidebarOpen,
          }
        )}
      >
        <TabbedInterface />
      </div>

      {/* <div
        className={clsx(
          "bg-gray-50 px-2 py-2 rounded-lg shadow-md border border-gray-300",
          {
            "lg:col-span-3": isSidebarOpen,
            "lg:col-span-1": !isSidebarOpen,
          }
        )}
      >
        <div
          className={clsx("w-full flex flex-col", {
            "items-center justify-center": folders.length === 0,
          })}
        >
          <div className="w-full h-full flex flex-col justify-center gap-2">
            <div className="border border-gray-300 rounded-md p-2 flex flex-col w-full justify-center items-center">
              <div className="w-full flex flex-row justify-between">
                <h2 className="text-sm my-2 font-semibold ">INPUT DATA</h2>
                <h2 className="text-xs my-2 text-blue-600">Imported data!</h2>
              </div>

              {folders.length > 0 ? (
                folders.map((folder: string) => (
                  <div
                    key={folder}
                    className="w-full mb-2 border border-gray-400  border-dashed rounded-lg py-2 px-2 text-wrap bg-white cursor-default"
                  >
                    <span className="text-sm">{folder}</span>
                  </div>
                ))
              ) : (
                <div className="text-gray-700">Load files</div>
              )}
              <button
                // onClick={onBack}
                className={clsx(
                  "w-40 disabled:bg-[#b4b4b4]/40 bg-yellow-300 cursor-pointer shadow-md font-normal px-4 py-1 rounded-lg  items-center justify-center disabled:cursor-not-allowed my-4"
                )}
                // disabled={currentStep === 0}
              >
                Import Data
              </button>              
            </div>
          </div>


        </div>
      </div> */}
    </div>
  );
};

export default Step2;
