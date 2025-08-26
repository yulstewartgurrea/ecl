import { useState } from "react";
import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  CalendarIcon,
  UserGroupIcon,
  ChevronRightIcon,
  FolderIcon,
} from "@heroicons/react/16/solid";
import { invoke } from "@tauri-apps/api/core";

import WorkflowFolderList from "./WorkflowFolderList";
import ApiStatusIndicator from "../../components/ApiStatusIndicators";

import { useAppDispatch, useAppSelector } from "../../redux_toolkit/hooks";
import {
  setPdTransitionMatrixSelectedEntity,
  setPdTransitionMatrixSelectedReportingPeriod,
  setPdTransitionMatrixWfName,
} from "../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";

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

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [proceedWithUpdate, setProceedWithUpdate] = useState(false);

  // API status
  const [apiStatus, setApiStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const handleWorkflowSelect = (
    entity: string,
    reportingPeriod: string,
    workflowName: string
  ) => {
    dispatch(setPdTransitionMatrixSelectedEntity({ entity }));
    dispatch(
      setPdTransitionMatrixSelectedReportingPeriod({ period: reportingPeriod })
    );
    dispatch(setPdTransitionMatrixWfName({ workflow_name: workflowName }));
  };

  const handleStartCalculation = async () => {
    if (
      pdTransitionMatrixWfName.trim() &&
      selectedPdTransitionMatrixEntity &&
      selectedPdTransitionMatrixReportingPeriod
    ) {
      try {
        setApiStatus("loading");
        setStatusMessage("Checking existing workflow...");

        const checkResponse = await fetch(
          `http://127.0.0.1:8000/documents/workflows/check?entity=${encodeURIComponent(
            selectedPdTransitionMatrixEntity
          )}&reporting_period=${encodeURIComponent(
            selectedPdTransitionMatrixReportingPeriod
          )}&workflow_name=${encodeURIComponent(pdTransitionMatrixWfName)}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
            },
          }
        );

        if (!checkResponse.ok) {
          throw new Error(`Error: ${checkResponse.statusText}`);
        }

        const checkData = await checkResponse.json();

        if (checkData.exists && !proceedWithUpdate) {
          setModalMessage(
            "This workflow already exists. If you wish to continue, click Continue. Note that it will update the existing record."
          );
          setShowModal(true);
          setApiStatus("idle");
          return;
        }

        setApiStatus("loading");
        setStatusMessage("Creating workflow...");

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
            body: JSON.stringify(payload),
          }
        );

        if (!workflowResponse.ok) {
          const errorData = await workflowResponse.json();
          throw new Error(errorData.detail || "Failed to create workflow");
        }

        await workflowResponse.json();

        setStatusMessage("Creating folder structure...");

        await invoke("create_folder_tree", {
          entity: selectedPdTransitionMatrixEntity,
          period: selectedPdTransitionMatrixReportingPeriod,
          workflowName: pdTransitionMatrixWfName,
        });

        setProceedWithUpdate(false);
        setShowModal(false);
        setApiStatus("success");
        setStatusMessage("Workflow created successfully!");

        navigate(`/transition_matrix/workflow`, {
          state: { pdTransitionMatrixWfName },
        });
      } catch (error: any) {
        console.error("Failed to start calculation:", error);
        setApiStatus("error");
        setStatusMessage(error?.message || "Something went wrong");
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
    <>
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
              "col-span-3 min-h-1/2 border border-[#e4e1e0] rounded-lg bg-white shadow-lg shadow-[#c9d4d4] pb-10 transition-all duration-300",
              {
                " min-w-4/5": !isSidebarOpen,
                "min-w-5/6": isSidebarOpen,
              }
            )}
          >
            {/* ENTITY SELECT */}
            <div className="px-10 pt-10 text-start rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-600 font-semibold text-sm">
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

            {/* REPORTING PERIOD */}
            <div className="px-10 pt-10 text-start rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-600 font-semibold text-sm">
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

            {/* WORKFLOW NAME */}
            <div className="px-10 pt-8 text-start">
              <label className="block text-gray-600 mb-2 font-semibold text-sm">
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
            </div>

            {/* START BUTTON */}
            <div className="px-10">
              <button
                onClick={handleStartCalculation}
                disabled={!isFormValid || apiStatus === "loading"}
                className={clsx(
                  "w-full px-6 py-3 mt-6 rounded-lg transition-all duration-300 text-gray-700 flex items-center justify-center gap-2",
                  {
                    "bg-yellow-300 hover:bg-yellow-400 cursor-pointer":
                      isFormValid && apiStatus !== "loading",
                    "bg-yellow-400/50 cursor-not-allowed":
                      !isFormValid || apiStatus === "loading",
                  }
                )}
              >
                {apiStatus === "loading" && (
                  <svg
                    className="animate-spin h-5 w-5 text-gray-700"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4l-3 3 3 3h-4z"
                    ></path>
                  </svg>
                )}
                Start
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* WORKFLOW FOLDER LIST */}
        <div className="md:col-span-2 h-full w-full">
          <WorkflowFolderList onWorkflowSelect={handleWorkflowSelect} />
        </div>
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm bg-white/30 z-50">
          <div className="rounded-xl shadow-lg p-6 w-[28rem]">
            <p className="mb-4">{modalMessage}</p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setProceedWithUpdate(true);
                  setShowModal(false);
                  handleStartCalculation();
                }}
                className="px-4 py-2 bg-yellow-400 rounded hover:bg-yellow-500"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API STATUS INDICATOR */}
      <ApiStatusIndicator
        status={apiStatus}
        message={statusMessage}
        onHide={() => setApiStatus("idle")}
      />
    </>
  );
};

export default TransitionMatrixLanding;
