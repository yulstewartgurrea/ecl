// Sidebar.tsx
import React, { useEffect, useState } from "react";
import clsx from "clsx";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Bars3Icon,
  PowerIcon,
  ChevronDownIcon,
  Square3Stack3DIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  AdjustmentsHorizontalIcon,
  FolderIcon,
} from "@heroicons/react/24/outline";

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

// ----- Sidebar items (unchanged except for added tabs) -----
const sidebarOptions: any[] = [
  { tabName: "Workflows", icon: FolderIcon, subTabs: [] },
  { tabName: "Flowrate Approach", icon: ChartBarIcon, subTabs: [] },
  { tabName: "Overlay", icon: Square3Stack3DIcon, subTabs: [] },
  { tabName: "Expected Credit Loss (ECL)", icon: ChartBarIcon, subTabs: [] },
  { tabName: "Configuration", icon: AdjustmentsHorizontalIcon, subTabs: [] },
  { tabName: "General Settings", icon: Cog6ToothIcon, subTabs: [] },
];

// ----- Route maps (tab -> route, subtab -> route) -----
const TAB_TO_ROUTE: Record<string, string> = {
  "Workflows": "/workflows",
  "Overlay": "/overlay",
  "Flowrate Approach": "/flowrate",
  "Expected Credit Loss (ECL)": "/ecl",
  "Configuration": "/ecl_configuration",
  "General Settings": "/settings",
};


// build reverse map to sync Redux from URL
const ROUTE_TO_TAB: Record<string, string> = Object.fromEntries(
  Object.entries(TAB_TO_ROUTE).map(([tab, path]) => [path, tab])
);

const Sidebar = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const { isSidebarOpen, activeTab, activeSubTab } = useAppSelector(
    (state) => state.navUIState
  );

  const [expandedTabs, setExpandedTabs] = useState<Set<string>>(new Set());

  // --- UI helpers ---
  const isTabActive = (option: any): boolean =>
    activeTab === option.tabName ||
    option.subTabs.some((s: any) => s.subTabName === activeSubTab);

  // --- Actions ---
  const handleToggleSidebar = () => dispatch(toggleSidebar());

  const handleLogout = () => {
    dispatch(resetStateAuth());
    dispatch(resetPdTransitionMatrixWfHelperData());
    dispatch(resetStateNavUIState());
    navigate("/")
    // Clear persisted auth and in-memory uploader caches to avoid stale sessions
    localStorage.removeItem("persist:root");
    const g: any = window as any;
    if (g.__MCU_CACHE__ && typeof g.__MCU_CACHE__.clear === "function") {
      g.__MCU_CACHE__.clear();
    }
  };

  const handleTabClick = (tabName: string) => {
    // 1) mark active in Redux
    dispatch(setActiveTab(tabName));
    dispatch(setActiveSubTab("")); // clear any previous subtab

    // 2) navigate
    const path = TAB_TO_ROUTE[tabName] ?? "/";
    navigate(path);
  };

  const handleTabDownArrowClick = (
    e: React.MouseEvent,
    tabName: string,
    hasSubTabs: boolean
  ) => {
    e.stopPropagation();
    // highlight the tab without navigation (useful if you just want to expand)
    dispatch(setActiveTab(tabName));

    if (hasSubTabs) {
      setExpandedTabs((prev) => {
        const n = new Set(prev);
        n.has(tabName) ? n.delete(tabName) : n.add(tabName);
        return n;
      });
    }
  };

  const handleSubTabClick = (tabName: string, subTabName: string) => {
    dispatch(setActiveTab(tabName));
    dispatch(setActiveSubTab(subTabName));
    const path =TAB_TO_ROUTE[tabName] ?? "/";
    navigate(path);
  };

  // --- Keep Redux in sync with the URL (handles refresh/back/links) ---
  useEffect(() => {
    const currentPath = location.pathname;
    // 1) try exact tab match
    console.log('currentPath: sidebar: ', currentPath)
    const tabFromRoute = ROUTE_TO_TAB[currentPath];
    if (tabFromRoute) {
      if (tabFromRoute !== activeTab) {
        dispatch(setActiveTab(tabFromRoute));
        dispatch(setActiveSubTab(""));
      }
      return;
    }

    const inferred = Object.entries(TAB_TO_ROUTE).find(([, path]) =>
      currentPath.startsWith(path)
    );
    if (inferred) {
      const [tab] = inferred;
      if (tab !== activeTab) {
        dispatch(setActiveTab(tab));
        dispatch(setActiveSubTab(""));
      }
    }
  }, [location.pathname]);

  return (
    <div className="flex h-screen w-screen bg-gray-50">
      <aside
        className={clsx(
          "transition-all duration-200 flex flex-col relative overflow-hidden",
          {
            "w-[20%] shadow-lg bg-white": isSidebarOpen,
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
            <img src="/ASALogo.png" alt="Logo" className="h-16 object-contain" />
          </div>

          <nav className="flex flex-col space-y-1 text-gray-700 px-2">
            {sidebarOptions.map((option) => {
              const active = isTabActive(option);
              const isExpanded = expandedTabs.has(option.tabName);

              return (
                <div key={option.tabName} className="flex flex-col w-full">
                  <div
                    onClick={() => handleTabClick(option.tabName)}
                    className={clsx(
                      "flex items-center justify-between px-1 py-2 rounded-md cursor-pointer hover:bg-[#f8f8f8] transition-all duration-200 gap-1",
                      { "bg-[#f8f8f8]": active }
                    )}
                  >
                    <div
                      className={clsx("flex items-center gap-2", {
                        "text-gray-600 bg-[#f8f8f8]": active,
                        "text-gray-600": !active,
                      })}
                    >
                      <option.icon className="w-5 h-5" />
                      <span className="whitespace-nowrap font-medium text-sm">
                        {option.tabName}
                      </span>
                    </div>

                    {option.subTabs.length > 0 && (
                      <ChevronDownIcon
                        className={clsx(
                          "w-4 h-4 transition-transform duration-200 text-gray-600",
                          { "rotate-180": isExpanded }
                        )}
                        onClick={(e) =>
                          handleTabDownArrowClick(
                            e,
                            option.tabName,
                            option.subTabs.length > 0
                          )
                        }
                      />
                    )}
                  </div>

                  {isExpanded && option.subTabs.length > 0 && (
                    <div className="ml-6 mt-1 flex flex-col space-y-1  border-[#ccc] pl-3">
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
                            <div className="w-2 h-2 rounded-full bg-white border border-[#ffbe0b]" />
                            <span className="whitespace-nowrap">{subTab.subTabName}</span>
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
          <div className="flex min-h-[50px] bg-gradient-to-r from-[#EA8024] to-[#FFBB00]">
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-[48px] w-full items-center justify-center gap-2 text-white text-sm font-medium px-2 hover:from-[#FFBB00] hover:to-[#EA8024] cursor-pointer transition-all duration-200"
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

