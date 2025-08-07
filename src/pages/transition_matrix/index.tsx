import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  CalendarIcon,
  UserGroupIcon,
  ChevronRightIcon,
  FolderIcon,
} from "@heroicons/react/16/solid";

//components
import WorkflowFolderList from "./WorkflowFolderList";

//redux toolkit
import { useAppDispatch, useAppSelector } from "../../redux_toolkit/hooks";
import {
  setPdTransitionMatrixSelectedEntity,
  setPdTransitionMatrixSelectedReportingPeriod,
  setPdTransitionMatrixWfName,
} from "../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";

import { invoke } from "@tauri-apps/api/core";

const TransitionMatrixLanding = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const authToken = useAppSelector((state) => state.auth.token);

  const { isSidebarOpen } = useAppSelector((state: any) => state.navUIState);
  const {
    selectedPdTransitionMatrixEntity,
    selectedPdTransitionMatrixReportingPeriod,
    pdTransitionMatrixWfName,
  } = useAppSelector((state: any) => state.pdTransitionMatrixWfHelper);

  const handleStartCalculation = async () => {
    if (
      pdTransitionMatrixWfName.trim() &&
      selectedPdTransitionMatrixEntity &&
      selectedPdTransitionMatrixReportingPeriod
    ) {
      try {
        const payload = {
          entity: selectedPdTransitionMatrixEntity,
          workflow_name: pdTransitionMatrixWfName,
          reporting_period: selectedPdTransitionMatrixReportingPeriod,
          baseline_year: "2023",
        };

        const workflowResponse = await fetch(
          "http://127.0.0.1:8000/workflows/",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${authToken}`,
            },
            body: JSON.stringify(payload), // <-- FIXED HERE
          }
        );

        console.log("Workflow creation response:", workflowResponse);

        if (!workflowResponse.ok) {
          const errorData = await workflowResponse.json();
          console.error("Error data:", errorData); // helpful for debugging
          throw new Error(errorData.detail || "Failed to create workflow");
        }

        const workflowData = await workflowResponse.json();
        console.log("Workflow created:", workflowData);

        const folderTreeResponse = await invoke("create_folder_tree", {
          entity: selectedPdTransitionMatrixEntity,
          period: selectedPdTransitionMatrixReportingPeriod,
          workflowName: pdTransitionMatrixWfName,
        });
        dispatch(
          setPdTransitionMatrixSelectedEntity({
            entity: selectedPdTransitionMatrixEntity,
          })
        );
        dispatch(
          setPdTransitionMatrixSelectedReportingPeriod({
            period: selectedPdTransitionMatrixReportingPeriod,
          })
        );
        dispatch(
          setPdTransitionMatrixWfName({
            workflow_name: pdTransitionMatrixWfName,
          })
        );
        console.log("Folder tree creation response:", folderTreeResponse);

        navigate(`/transition_matrix/workflow`, {
          state: { pdTransitionMatrixWfName },
        });
      } catch (error) {
        console.error("Failed to start calculation:", error);
      }
    }
  };

  const handleEntityChange = (e: any) => {
    dispatch(setPdTransitionMatrixSelectedEntity({ entity: e.target.value }));
  };

  const handleWorkflowInputChange = (e: any) => {
    dispatch(setPdTransitionMatrixWfName({ workflow_name: e.target.value }));
  };

  const handleReportingPeriodChange = (e: any) => {
    dispatch(
      setPdTransitionMatrixSelectedReportingPeriod({ period: e.target.value })
    );
  };

  const isFormValid =
    selectedPdTransitionMatrixEntity &&
    pdTransitionMatrixWfName &&
    selectedPdTransitionMatrixReportingPeriod;

  return (
    <div className="w-full h-full grid md:grid-cols-5 sm:grid-cols-2 space-y-2">
      <div
        className={clsx(
          "md:col-span-3 w-full h-full flex flex-col items-center justify-center"
        )}
      >
        <div className="text-center">
          <h1 className="text-3xl font-medium mb-4 text-gray-700">
            Transition Matrix Workflow
          </h1>
        </div>
        <div
          className={clsx(
            "col-span-3 min-h-1/2 border border-[#e4e1e0] rounded-lg bg-white shadow-lg shadow-[#c9d4d4] pb-10  transition-all duration-300",
            {
              " min-w-4/5": !isSidebarOpen,
              "min-w-5/6": isSidebarOpen,
            }
          )}
        >
          <div className="px-10 pt-10 text-start rounded-lg">
            <div className=" text-start rounded-lg flex items-center justify-between">
              <label
                htmlFor="bank"
                className="block text-gray-600 mb-2 font-semibold text-sm"
              >
                GENERATE REPORT FOR:
              </label>
            </div>

            <div className="flex flex-row border border-gray-300 rounded-lg bg-white">
              <div className="h-12 w-1/12 border-r border-gray-300 flex items-center justify-center">
                <UserGroupIcon className="w-5 h-5 text-[#8a7d7c]" />
              </div>

              <select
                id="entity"
                value={selectedPdTransitionMatrixEntity}
                onChange={handleEntityChange}
                className="w-11/12 text-gray-600 py-2 pl-1 focus:outline-none bg-gray-50 rounded-r-lg"
              >
                <option value="">Select an entity</option>
                <option value="BanKo">Entity 1</option>
                <option value="LSB">Entity 2</option>
                <option value="Parent">Entity 3</option>
              </select>
            </div>
          </div>
          <div className="px-10 pt-10 text-start rounded-lg">
            <div className=" text-start rounded-lg flex items-center justify-between">
              <label
                htmlFor="bank"
                className="block text-gray-600 mb-2 font-semibold text-sm"
              >
                REPORTING PERIOD:
              </label>
            </div>

            <div className="flex flex-row border border-gray-300 rounded-lg bg-white">
              <div className="h-12 w-1/12 border-r border-gray-300 flex items-center justify-center">
                <CalendarIcon className="w-5 h-5 text-[#8a7d7c]" />
              </div>

              <select
                id="period"
                value={selectedPdTransitionMatrixReportingPeriod}
                onChange={handleReportingPeriodChange}
                className="w-11/12 text-gray-600 py-2 pl-1 focus:outline-none bg-gray-50 rounded-r-lg"
              >
                <option value="">Select period</option>
                <option value="Annually">Annually</option>
                <option value="Quarterly">Quarterly</option>
              </select>
            </div>
          </div>
          <div className="px-10 pt-8  text-start">
            <label
              htmlFor="currentUseSrWorkflowName"
              className="block text-gray-600 mb-2 font-semibold text-sm"
            >
              WORKFLOW NAME:
            </label>
            <div className="flex flex-row border border-gray-300 rounded-lg bg-white">
              <div className="h-12 w-1/12 border-r border-gray-300 flex items-center justify-center">
                <FolderIcon className="w-5 h-5 text-[#8a7d7c]" />
              </div>
              <input
                id="currentUseSrWorkflowName"
                type="text"
                placeholder="Input text"
                value={pdTransitionMatrixWfName}
                onChange={handleWorkflowInputChange}
                className="w-11/12 text-gray-600 pl-2 focus:outline-none bg-gray-50 rounded-r-lg"
              />
            </div>
            {/* {error && (
                    <p className="text-red-500 text-sm mt-1 text-wrap">{error}</p>
                    )} */}
          </div>
          <div className="px-10">
            <button
              onClick={handleStartCalculation}
              disabled={!isFormValid}
              className={`w-full px-6 py-3 mt-6 rounded-lg transition-all duration-300 text-gray-700 ${
                isFormValid
                  ? "bg-yellow-300 hover:bg-yellow-400 cursor-pointer "
                  : "bg-yellow-400/50 cursor-not-allowed"
              }`}
            >
              <span className="flex items-center justify-center gap-2">
                Start
                <ChevronRightIcon className="h-5 w-5" />
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="md:col-span-2 h-full w-full">
        <WorkflowFolderList />
      </div>
    </div>
  );
};

export default TransitionMatrixLanding;
