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
    subTabs: [
      // { subTabName: "Approach 1" },
      // { subTabName: "Approach 2" }
    ],
  },
  {
    tabName: "Loss Given Default (LGD)",
    icon: ArrowTrendingDownIcon,
    subTabs: [
      // { subTabName: "Approach 1" },
      // { subTabName: "Approach 2" }
    ],
  },
  {
    tabName: "Exposure at Default (EAD)",
    icon: ChartPieIcon,
    subTabs: [
      // { subTabName: "Approach 1" },
      // { subTabName: "Approach 2" }
    ],
  },
];

const Sidebar = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isSidebarOpen, activeTab, activeSubTab } = useAppSelector(
    (state) => state.navUIState
  );
  const [dropdownVisible, setDropdownVisible] = useState<boolean>(false);

  const handleToggleSidebar = () => {
    dispatch(toggleSidebar());
  };

  const handleLogout = () => {
    dispatch(resetStateAuth());
    dispatch(resetPdTransitionMatrixWfHelperData());
    dispatch(resetStateNavUIState());
  };

  const handleTabClick = (tabName: string) => {
    setDropdownVisible((prev: any) => {
      if (activeTab === tabName) return !prev;
      else return true;
    });
    dispatch(setActiveTab(tabName));
  };

  const handleSubTabClick = (tabName: string, subTabName: string) => {
    dispatch(setActiveTab(tabName));
    dispatch(setActiveSubTab(subTabName));
    setDropdownVisible(false);
    if (
      tabName === "Probability of Default (PD)" &&
      subTabName === "Transition Matrix Approach"
    ) {
      navigate("/transition_matrix");
    }
  };

  return (
    <div className="flex h-screen w-screen bg-gray-50">
      <aside
        className={clsx(
          "transition-all duration-200 flex flex-col relative overflow-hidden ",
          {
            "w-1/5 md:w-1/6 shadow-lg bg-white": isSidebarOpen,
            "w-8 md:w-10 items-center bg-gray-50": !isSidebarOpen,
          }
        )}
      >
        <button
          onClick={handleToggleSidebar}
          className={clsx(
            "p-1 rounded-md hover:bg-gray-400/15 transition-colors absolute",
            {
              "top-4 right-2 rotate-in": isSidebarOpen,
              "top-4 left-1/2 -translate-x-1/2 rotate-out": !isSidebarOpen,
            }
          )}
        >
          <Bars3Icon
            width={24}
            height={24}
            className={` ${
              isSidebarOpen ? "text-yellow-400" : "text-gray-700"
            }`}
          />
        </button>

          <div className={clsx("mt-16 flex-grow transition-all duration-150",{
            "block": isSidebarOpen,
            "hidden": !isSidebarOpen
          })}>
            <div className="w-full flex flex-row items-center justify-center px-4 mb-12">
              <img
                src="/SGVLogoLight.png"
                alt="Logo"
                className="flex items-center h-16 object-contain"
              />
            </div>
            <nav className="flex flex-col space-y-3 text-gray-700">
              {sidebarOptions.map((option) => (
                <div key={option.tabName} className="relative cursor-pointer">
                  <div
                    className={clsx("w-full flex flex-row h-14 text-sm", {
                      "bg-yellow-400/40":
                        dropdownVisible && activeTab === option.tabName,
                      "bg-gray-200": !dropdownVisible,
                    })}
                  >
                    <div
                      className={clsx("w-2 h-auto bg-gray-400", {
                        "bg-yellow-600/50":
                          dropdownVisible && activeTab === option.tabName,
                      })}
                    />
                    <div
                      className={clsx(
                        "w-full flex items-center justify-between px-2 text-wrap"
                      )}
                      onClick={() => handleTabClick(option.tabName)}
                    >
                      <div className="flex flex-row gap-2 items-center justify-center slide-in">
                        <option.icon className="w-4 h-4 text-gray-700 mt-0.5"/>
                        <span>{option.tabName}</span>
                      </div>

                      {option.subTabs.length > 0 && (
                        <ChevronDownIcon
                          className={clsx("w-5 h-5", {
                            "rotate-in":
                              dropdownVisible && activeTab === option.tabName,
                            "rotate-out":
                              !dropdownVisible && activeTab === option.tabName,
                          })}
                        />
                      )}
                    </div>
                  </div>

                  {activeTab === option.tabName &&
                    dropdownVisible &&
                    option.subTabs.length > 0 && (
                      <div className="absolute left-2 w-[96%] mt-1 bg-white rounded-md shadow-lg z-10">
                        {option.subTabs.map((subTab: any) => (
                          <div
                            key={subTab.subTabName}
                            className={`p-2 text-gray-700 cursor-pointer hover:bg-yellow-100 ${
                              activeSubTab === subTab.subTabName
                                ? "bg-yellow-400"
                                : ""
                            }`}
                            onClick={() =>
                              handleSubTabClick(
                                option.tabName,
                                subTab.subTabName
                              )
                            }
                          >
                            {subTab.subTabName}
                          </div>
                        ))}
                      </div>
                    )}
                </div>
              ))}
            </nav>
          </div>
         

        {/* Logout Button at the bottom */}
        {isSidebarOpen && (
          <div className="flex min-h-[50px] bg-gray-600">
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-[48px] w-full grow items-center justify-center gap-2 text-white text-sm font-medium px-2 hover:bg-gray-500"
            >
              <PowerIcon className="w-5" />
              <div className="font-semibold whitespace-nowrap">LOGOUT</div>
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
