// import clsx from "clsx";
// import { Outlet, useNavigate } from "react-router-dom";
// import {
//   Bars3Icon,
//   PowerIcon,
//   ChevronDownIcon,
//   PercentBadgeIcon,
//   Square3Stack3DIcon,
//   ArrowTrendingDownIcon,
//   ChartPieIcon,
// } from "@heroicons/react/24/outline";
// import { useState } from "react";

// // redux toolkit
// import { useAppDispatch, useAppSelector } from "../redux_toolkit/hooks";
// import {
//   toggleSidebar,
//   setActiveTab,
//   setActiveSubTab,
//   resetStateNavUIState,
// } from "../redux_toolkit/features/general/navUIState";
// import { resetStateAuth } from "../redux_toolkit/features/general/auth";
// import { resetPdTransitionMatrixWfHelperData } from "../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";

// const sidebarOptions: any[] = [
//   {
//     tabName: "Probability of Default (PD)",
//     icon: PercentBadgeIcon,
//     subTabs: [
//       { subTabName: "Transition Matrix Approach" },
//       { subTabName: "Approach 2" },
//       { subTabName: "Approach 3" },
//     ],
//   },
//   {
//     tabName: "Overlay",
//     icon: Square3Stack3DIcon,
//     subTabs: [
//       // { subTabName: "Approach 1" },
//       // { subTabName: "Approach 2" }
//     ],
//   },
//   {
//     tabName: "Loss Given Default (LGD)",
//     icon: ArrowTrendingDownIcon,
//     subTabs: [
//       // { subTabName: "Approach 1" },
//       // { subTabName: "Approach 2" }
//     ],
//   },
//   {
//     tabName: "Exposure at Default (EAD)",
//     icon: ChartPieIcon,
//     subTabs: [
//       // { subTabName: "Approach 1" },
//       // { subTabName: "Approach 2" }
//     ],
//   },
// ];

// const Sidebar = () => {
//   const dispatch = useAppDispatch();
//   const navigate = useNavigate();
//   const { isSidebarOpen, activeTab, activeSubTab } = useAppSelector(
//     (state) => state.navUIState
//   );
//   const [dropdownVisible, setDropdownVisible] = useState<boolean>(false);

//   const handleToggleSidebar = () => {
//     dispatch(toggleSidebar());
//   };

//   const handleLogout = () => {
//     dispatch(resetStateAuth());
//     dispatch(resetPdTransitionMatrixWfHelperData());
//     dispatch(resetStateNavUIState());
//   };

//   const handleTabClick = (tabName: string) => {
//     setDropdownVisible((prev: any) => {
//       if (activeTab === tabName) return !prev;
//       else return true;
//     });
//     dispatch(setActiveTab(tabName));
//   };

//   const handleSubTabClick = (tabName: string, subTabName: string) => {
//     dispatch(setActiveTab(tabName));
//     dispatch(setActiveSubTab(subTabName));
//     setDropdownVisible(false);
//     if (
//       tabName === "Probability of Default (PD)" &&
//       subTabName === "Transition Matrix Approach"
//     ) {
//       navigate("/transition_matrix");
//     }
//   };

//   return (
//     <div className="flex h-screen w-screen bg-gray-50">
//       <aside
//         className={clsx(
//           "transition-all duration-200 flex flex-col relative overflow-hidden ",
//           {
//             "w-1/5 md:w-1/6 shadow-lg bg-white": isSidebarOpen,
//             "w-8 md:w-10 items-center bg-gray-50": !isSidebarOpen,
//           }
//         )}
//       >
//         <button
//           onClick={handleToggleSidebar}
//           className={clsx(
//             "p-1 rounded-md hover:bg-gray-400/15 transition-colors absolute",
//             {
//               "top-4 right-2 rotate-in": isSidebarOpen,
//               "top-4 left-1/2 -translate-x-1/2 rotate-out": !isSidebarOpen,
//             }
//           )}
//         >
//           <Bars3Icon
//             width={24}
//             height={24}
//             className={` ${
//               isSidebarOpen ? "text-yellow-400" : "text-gray-700"
//             }`}
//           />
//         </button>

//           <div className={clsx("mt-16 flex-grow transition-all duration-150",{
//             "block": isSidebarOpen,
//             "hidden": !isSidebarOpen
//           })}>
//             <div className="w-full flex flex-row items-center justify-center px-4 mb-12">
//               <img
//                 src="/SGVLogoLight.png"
//                 alt="Logo"
//                 className="flex items-center h-16 object-contain"
//               />
//             </div>
//             <nav className="flex flex-col space-y-3 text-gray-700">
//               {sidebarOptions.map((option) => (
//                 <div key={option.tabName} className="relative cursor-pointer">
//                   <div
//                     className={clsx("w-full flex flex-row h-14 text-sm", {
//                       "bg-yellow-400/40":
//                         dropdownVisible && activeTab === option.tabName,
//                       "bg-gray-200": !dropdownVisible,
//                     })}
//                   >
//                     <div
//                       className={clsx("w-2 h-auto bg-gray-400", {
//                         "bg-yellow-600/50":
//                           dropdownVisible && activeTab === option.tabName,
//                       })}
//                     />
//                     <div
//                       className={clsx(
//                         "w-full flex items-center justify-between px-2 text-wrap"
//                       )}
//                       onClick={() => handleTabClick(option.tabName)}
//                     >
//                       <div className="flex flex-row gap-2 items-center justify-center slide-in">
//                         <option.icon className="w-4 h-4 text-gray-700 mt-0.5"/>
//                         <span>{option.tabName}</span>
//                       </div>

//                       {option.subTabs.length > 0 && (
//                         <ChevronDownIcon
//                           className={clsx("w-5 h-5", {
//                             "rotate-in":
//                               dropdownVisible && activeTab === option.tabName,
//                             "rotate-out":
//                               !dropdownVisible && activeTab === option.tabName,
//                           })}
//                         />
//                       )}
//                     </div>
//                   </div>

//                   {activeTab === option.tabName &&
//                     dropdownVisible &&
//                     option.subTabs.length > 0 && (
//                       <div className="absolute left-2 w-[96%] mt-1 bg-white rounded-md shadow-lg z-10">
//                         {option.subTabs.map((subTab: any) => (
//                           <div
//                             key={subTab.subTabName}
//                             className={`p-2 text-gray-700 cursor-pointer hover:bg-yellow-100 ${
//                               activeSubTab === subTab.subTabName
//                                 ? "bg-yellow-400"
//                                 : ""
//                             }`}
//                             onClick={() =>
//                               handleSubTabClick(
//                                 option.tabName,
//                                 subTab.subTabName
//                               )
//                             }
//                           >
//                             {subTab.subTabName}
//                           </div>
//                         ))}
//                       </div>
//                     )}
//                 </div>
//               ))}
//             </nav>
//           </div>
         

//         {/* Logout Button at the bottom */}
//         {isSidebarOpen && (
//           <div className="flex min-h-[50px] bg-gray-600">
//             <button
//               type="button"
//               onClick={handleLogout}
//               className="flex h-[48px] w-full grow items-center justify-center gap-2 text-white text-sm font-medium px-2 hover:bg-gray-500"
//             >
//               <PowerIcon className="w-5" />
//               <div className="font-semibold whitespace-nowrap">LOGOUT</div>
//             </button>
//           </div>
//         )}
//       </aside>

//       <div className="flex-1 h-screen overflow-y-auto transition-all duration-300">
//         <main className="w-full h-full">
//           <Outlet />
//         </main>
//       </div>
//     </div>
//   );
// };

// export default Sidebar;

// import clsx from "clsx";
// import { Outlet, useNavigate } from "react-router-dom";
// import {
//   Bars3Icon,
//   PowerIcon,
//   ChevronDownIcon,
//   PercentBadgeIcon,
//   Square3Stack3DIcon,
//   ArrowTrendingDownIcon,
//   ChartPieIcon,
// } from "@heroicons/react/24/outline";
// import { useState } from "react";

// // redux toolkit
// import { useAppDispatch, useAppSelector } from "../redux_toolkit/hooks";
// import {
//   toggleSidebar,
//   setActiveTab,
//   setActiveSubTab,
//   resetStateNavUIState,
// } from "../redux_toolkit/features/general/navUIState";
// import { resetStateAuth } from "../redux_toolkit/features/general/auth";
// import { resetPdTransitionMatrixWfHelperData } from "../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";

// const sidebarOptions: any[] = [
//   {
//     tabName: "Probability of Default (PD)",
//     icon: PercentBadgeIcon,
//     subTabs: [
//       { subTabName: "Transition Matrix Approach" },
//       { subTabName: "Approach 2" },
//       { subTabName: "Approach 3" },
//     ],
//   },
//   {
//     tabName: "Overlay",
//     icon: Square3Stack3DIcon,
//     subTabs: [],
//   },
//   {
//     tabName: "Loss Given Default (LGD)",
//     icon: ArrowTrendingDownIcon,
//     subTabs: [],
//   },
//   {
//     tabName: "Exposure at Default (EAD)",
//     icon: ChartPieIcon,
//     subTabs: [],
//   },
// ];

// const Sidebar = () => {
//   const dispatch = useAppDispatch();
//   const navigate = useNavigate();
//   const { isSidebarOpen, activeTab, activeSubTab } = useAppSelector(
//     (state) => state.navUIState
//   );

//   const handleToggleSidebar = () => {
//     dispatch(toggleSidebar());
//   };

//   const handleLogout = () => {
//     dispatch(resetStateAuth());
//     dispatch(resetPdTransitionMatrixWfHelperData());
//     dispatch(resetStateNavUIState());
//   };

//   const handleTabClick = (tabName: string) => {
//     dispatch(setActiveTab(activeTab === tabName ? "" : tabName));
//   };

//   const handleSubTabClick = (tabName: string, subTabName: string) => {
//     dispatch(setActiveTab(tabName));
//     dispatch(setActiveSubTab(subTabName));
//     if (
//       tabName === "Probability of Default (PD)" &&
//       subTabName === "Transition Matrix Approach"
//     ) {
//       navigate("/transition_matrix");
//     }
//   };

//   const isTabActive = (option: any): boolean => {
//     if (activeTab === option.tabName) return true;
//     if (
//       option.subTabs.some((subTab: any) => subTab.subTabName === activeSubTab)
//     )
//       return true;
//     return false;
//   };

//   return (
//     <div className="flex h-screen w-screen bg-gray-50">
//       <aside
//         className={clsx(
//           "transition-all duration-200 flex flex-col relative overflow-hidden",
//           {
//             "w-[18%] shadow-lg bg-white": isSidebarOpen,
//             "w-8 md:w-10 items-center bg-gray-50": !isSidebarOpen,
//           }
//         )}
//       >
//         <button
//           onClick={handleToggleSidebar}
//           className={clsx(
//             "p-1 rounded-md hover:bg-purple-100 transition-colors absolute",
//             {
//               "top-4 right-2": isSidebarOpen,
//               "top-4 left-1/2 -translate-x-1/2": !isSidebarOpen,
//             }
//           )}
//         >
//           <Bars3Icon className="text-purple-700 w-6 h-6" />
//         </button>

//         <div
//           className={clsx("mt-16 flex-grow transition-all duration-150", {
//             block: isSidebarOpen,
//             hidden: !isSidebarOpen,
//           })}
//         >
//           <div className="w-full flex justify-center px-4 mb-12">
//             <img
//               src="/SGVLogoLight.png"
//               alt="Logo"
//               className="h-16 object-contain"
//             />
//           </div>

//           <nav className="flex flex-col space-y-1 text-gray-700 px-2">
//             {sidebarOptions.map((option) => {
//               const active = isTabActive(option);
//               return (
//                 <div key={option.tabName} className="flex flex-col w-full">
//                   <div
//                     onClick={() => handleTabClick(option.tabName)}
//                     className={clsx(
//                       "flex items-center justify-between px-3 py-2 rounded-md cursor-pointer hover:bg-purple-100 transition-all duration-200"
//                     )}
//                   >
//                     <div
//                       className={clsx("flex items-center gap-2", {
//                         "text-purple-700": active,
//                         "text-gray-600": !active,
//                       })}
//                     >
//                       <option.icon className="w-5 h-5" />
//                       <span className="whitespace-nowrap font-medium">{option.tabName}</span>
//                     </div>

//                     {option.subTabs.length > 0 && (
//                       <ChevronDownIcon
//                         className={clsx("w-4 h-4 transition-transform duration-200", {
//                           "rotate-180 text-purple-700": active,
//                           "text-gray-600": !active,
//                         })}
//                       />
//                     )}
//                   </div>

//                   {activeTab === option.tabName &&
//                     option.subTabs.length > 0 && (
//                       <div className="ml-6 mt-1 flex flex-col space-y-1 border-l-2 border-purple-400 pl-3">
//                         {option.subTabs.map((subTab: any) => {
//                           const isActiveSub = activeSubTab === subTab.subTabName;
//                           return (
//                             <div
//                               key={subTab.subTabName}
//                               onClick={() =>
//                                 handleSubTabClick(option.tabName, subTab.subTabName)
//                               }
//                               className={clsx(
//                                 "  py-1 px-2 rounded-md cursor-pointer text-sm flex items-center gap-2 group transition-all duration-300",
//                                 {
//                                   "bg-purple-400 text-white": isActiveSub,
//                                   "text-gray-600 hover:bg-purple-100": !isActiveSub,
//                                 }
//                               )}
//                             >
//                               {/* Bullet */}
//                               <div
//                                 className={clsx("w-2 h-2 rounded-full", {
//                                   "bg-white border border-purple-700":
//                                     !isActiveSub,
//                                   "bg-white": isActiveSub,
//                                 })}
//                               />
//                               <span className="whitespace-nowrap">{subTab.subTabName}</span>
//                             </div>
//                           );
//                         })}
//                       </div>
//                     )}
//                 </div>
//               );
//             })}
//           </nav>
//         </div>

//         {/* Logout Button */}
//         {isSidebarOpen && (
//           <div className="flex min-h-[50px] bg-purple-300">
//             <button
//               type="button"
//               onClick={handleLogout}
//               className="flex h-[48px] w-full items-center justify-center gap-2 text-gray-700 text-sm font-medium px-2 hover:bg-purple-600"
//             >
//               <PowerIcon className="w-5" />
//               <span className="font-semibold whitespace-nowrap">LOGOUT</span>
//             </button>
//           </div>
//         )}
//       </aside>

//       <div className="flex-1 h-screen overflow-y-auto transition-all duration-300">
//         <main className="w-full h-full">
//           <Outlet />
//         </main>
//       </div>
//     </div>
//   );
// };

// export default Sidebar;


import clsx from "clsx";
import { Outlet, useNavigate } from "react-router-dom";
import {
  Bars3Icon,
  PowerIcon,
  ChevronDownIcon,
  PercentBadgeIcon,
  Square3Stack3DIcon,
  ArrowTrendingDownIcon,
  ChartPieIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";

// redux toolkit
import { useAppDispatch, useAppSelector } from "../redux_toolkit/hooks";
import {
  toggleSidebar,
  setActiveTab,
  setActiveSubTab,
  resetStateNavUIState,
} from "../redux_toolkit/features/general/navUIState";
import { resetStateAuth } from "../redux_toolkit/features/general/auth";
import { resetPdTransitionMatrixWfHelperData } from "../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";

const sidebarOptions: any[] = [
  {
    tabName: "Probability of Default (PD)",
    icon: PercentBadgeIcon,
    subTabs: [
      { subTabName: "Transition Matrix Approach" },
      { subTabName: "Approach 2" },
      { subTabName: "Approach 3" },
    ],
  },
  {
    tabName: "Overlay",
    icon: Square3Stack3DIcon,
    subTabs: [],
  },
  {
    tabName: "Loss Given Default (LGD)",
    icon: ArrowTrendingDownIcon,
    subTabs: [],
  },
  {
    tabName: "Exposure at Default (EAD)",
    icon: ChartPieIcon,
    subTabs: [],
  },
];

const Sidebar = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isSidebarOpen, activeTab, activeSubTab } = useAppSelector(
    (state) => state.navUIState
  );

  const [expandedTabs, setExpandedTabs] = useState<Set<string>>(new Set());

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  const handleLogout = () => {
    dispatch(resetStateAuth());
    dispatch(resetPdTransitionMatrixWfHelperData());
    dispatch(resetStateNavUIState());
  };

  const handleTabClick = () => {//tabName: string
    // dispatch(setActiveTab(activeTab === tabName ? "" : tabName));
    navigate('/pd_landing')
  };

  const handleTabDownArrowClick = (e:any, tabName: string, hasSubTabs: boolean) => {
    e.stopPropagation()
    dispatch(setActiveTab(activeTab === tabName ? "" : tabName));

    if (hasSubTabs) {
      setExpandedTabs((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(tabName)) {
          newSet.delete(tabName);
        } else {
          newSet.add(tabName);
        }
        return newSet;
      });
    }
  };  

  const handleSubTabClick = (tabName: string, subTabName: string) => {
    dispatch(setActiveTab(tabName));
    dispatch(setActiveSubTab(subTabName));
    if (
      tabName === "Probability of Default (PD)" &&
      subTabName === "Transition Matrix Approach"
    ) {
      navigate("/transition_matrix");
    }
  };

  const isTabActive = (option: any): boolean => {
    if (activeTab === option.tabName) return true;
    if (
      option.subTabs.some((subTab: any) => subTab.subTabName === activeSubTab)
    )
      return true;
    return false;
  };

  return (
    <div className="flex h-screen w-screen bg-gray-50">
      <aside
        className={clsx(
          "transition-all duration-200 flex flex-col relative overflow-hidden",
          {
            "w-[18%] shadow-lg bg-white": isSidebarOpen,
            "w-8 md:w-10 items-center bg-gray-50": !isSidebarOpen,
          }
        )}
      >
        <button
          onClick={handleToggleSidebar}
          className={clsx(
            "p-1 rounded-md hover:bg-purple-100 transition-colors absolute",
            {
              "top-4 right-2": isSidebarOpen,
              "top-4 left-1/2 -translate-x-1/2": !isSidebarOpen,
            }
          )}
        >
          <Bars3Icon className="text-[#ffbe0b] w-6 h-6" />
        </button>

        <div
          className={clsx("mt-16 flex-grow transition-all duration-150", {
            block: isSidebarOpen,
            hidden: !isSidebarOpen,
          })}
        >
          <div className="w-full flex justify-center px-4 mb-12">
            <img
              src="/SGVLogoLight.png"
              alt="Logo"
              className="h-16 object-contain"
            />
          </div>

          <nav className="flex flex-col space-y-1 text-gray-700 px-2">
            {sidebarOptions.map((option) => {
              const active = isTabActive(option);
              const isExpanded = expandedTabs.has(option.tabName);

              return (
                <div key={option.tabName} className="flex flex-col w-full">
                  <div
                    onClick={() =>
                      handleTabClick()//option.tabName
                    }
                    className={clsx("flex items-center justify-between px-1 py-2 rounded-md cursor-pointer hover:bg-[#f8f8f8] transition-all duration-200 gap-1",{
                      " bg-[#f8f8f8]": active,
                    })}
                  >
                    <div
                      className={clsx("flex items-center gap-2", {
                        "text-gray-600 bg-[#f8f8f8]": active,
                        "text-gray-600": !active,
                      })}
                    >
                      <option.icon className="w-5 h-5"/>
                      <span className="whitespace-nowrap font-medium">
                        {option.tabName}
                      </span>
                    </div>

                    {option.subTabs.length > 0 && (
                      <ChevronDownIcon
                        className={clsx(
                          "w-4 h-4 transition-transform duration-200 text-gray-600",
                          {
                            "rotate-180": isExpanded,
                            // "text-gray-600": active,
                            // "text-gray-600": !active,
                          }
                        )}
                        onClick={(e) => handleTabDownArrowClick(e, option.tabName, option.subTabs.length > 0)}
                      />
                    )}
                  </div>

                  {isExpanded && option.subTabs.length > 0 && (
                    <div className="ml-6 mt-1 flex flex-col space-y-1 border-l-2 border-[#ccc] pl-3">
                      {option.subTabs.map((subTab: any) => {
                        const isActiveSub = activeSubTab === subTab.subTabName;
                        return (
                          <div
                            key={subTab.subTabName}
                            onClick={() =>
                              handleSubTabClick(option.tabName, subTab.subTabName)
                            }
                            className={clsx(
                              "py-1 px-2 rounded-md cursor-pointer text-sm flex items-center gap-2 group transition-all duration-300",
                              {
                                "bg-[#f8f8f8] text-gray-600": isActiveSub,
                                "text-gray-600 hover:bg-[#f8f8f8]": !isActiveSub,
                              }
                            )}
                          >
                            {/* Bullet */}
                            <div
                              className={clsx("w-2 h-2 rounded-full bg-white border border-[#ffbe0b]", {
                                // "bg-white border border-[#ffbe0b]": !isActiveSub,
                                // " border border-[#ffbe0b]": isActiveSub,
                              })}
                            />
                            <span className="whitespace-nowrap">
                              {subTab.subTabName}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {isSidebarOpen && (
          <div className="flex min-h-[50px] bg-[#ffbe0b]">
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-[48px] w-full items-center justify-center gap-2 text-gray-600 text-sm font-medium px-2 hover:bg-yellow-500 cursor-pointer"
            >
              <PowerIcon className="w-5" />
              <span className="font-semibold whitespace-nowrap">LOGOUT</span>
            </button>
          </div>
        )}
      </aside>

      <div className="flex-1 h-screen overflow-y-auto transition-all duration-300">
        <main className="w-full h-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Sidebar;

