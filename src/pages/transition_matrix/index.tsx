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

  // NEW: local UI state for extra fields
  const [loanProduct, setLoanProduct] = useState<string>("");
  const [reportDateStart, setReportDateStart] = useState<string>("");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [proceedWithUpdate, setProceedWithUpdate] = useState(false);

  // API status
  const [apiStatus, setApiStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  const handleWorkflowSelect = (
    entity: string,
    reportingPeriod: string,
    workflowName: string
  ) => {
    dispatch(setPdTransitionMatrixSelectedEntity({ entity }));
    dispatch(setPdTransitionMatrixSelectedReportingPeriod({ period: reportingPeriod }));
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
          { headers: { Authorization: `Bearer ${authToken}` } }
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

        // NOTE: Keeping payload unchanged to avoid backend 422s.
        const payload = {
          entity: selectedPdTransitionMatrixEntity,
          workflow_name: pdTransitionMatrixWfName,
          reporting_period: selectedPdTransitionMatrixReportingPeriod,
          baseline_year: "2023",
          // If/when the backend supports these, include:
          // loan_product: loanProduct || undefined,
          // report_date_start: reportDateStart || undefined,
        };

        const workflowResponse = await fetch("http://127.0.0.1:8000/workflows/", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify(payload),
        });

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

        navigate(`/transition_matrix/workflow`, { state: { pdTransitionMatrixWfName } });
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
    dispatch(setPdTransitionMatrixSelectedReportingPeriod({ period: e.target.value }));
  };

  const isFormValid =
    selectedPdTransitionMatrixEntity &&
    pdTransitionMatrixWfName &&
    selectedPdTransitionMatrixReportingPeriod;

  return (
    <>
      <div className="w-full h-full grid md:grid-cols-5 sm:grid-cols-2 space-y-2">
        <div className={clsx("md:col-span-3 w-full h-full flex flex-col items-center justify-center")}>
          <div className="text-center">
            <h1 className="text-3xl font-semibold mb-4 text-gray-800">
              Transition Matrix Workflow
            </h1>
          </div>

          <div
            className={clsx(
              "col-span-3 border border-gray-200 rounded-2xl bg-white shadow-sm pb-10 transition-all duration-300",
              { "min-w-4/5": !isSidebarOpen, "min-w-5/6": isSidebarOpen }
            )}
          >
            {/* Entity */}
            <div className="px-10 pt-8 text-start">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 font-medium text-sm">
                  Generate Report For
                </label>
              </div>
              <div className="flex flex-row border border-gray-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-amber-500">
                <div className="h-11 w-12 border-r border-gray-200 flex items-center justify-center">
                  <UserGroupIcon className="w-5 h-5 text-gray-500" />
                </div>
                <select
                  id="entity"
                  value={selectedPdTransitionMatrixEntity}
                  onChange={handleEntityChange}
                  className="flex-1 text-gray-800 py-2.5 pl-2 pr-3 focus:outline-none bg-gray-50 rounded-r-xl"
                >
                  <option value="">Select An Entity</option>
                  <option value="Entity 1">Entity 1</option>
                  <option value="Entity 2">Entity 2</option>
                  <option value="Entity 3">Entity 3</option>
                </select>
              </div>
            </div>

            {/* NEW: Loan Product */}
            <div className="px-10 pt-6 text-start">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 font-medium text-sm">
                  Loan Product
                </label>
              </div>
              <div className="flex flex-row border border-gray-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-amber-500">
                <div className="h-11 w-12 border-r border-gray-200 flex items-center justify-center">
                  <FolderIcon className="w-5 h-5 text-gray-500" />
                </div>
                <select
                  id="loanProduct"
                  value={loanProduct}
                  onChange={(e) => setLoanProduct(e.target.value)}
                  className="flex-1 text-gray-800 py-2.5 pl-2 pr-3 focus:outline-none bg-gray-50 rounded-r-xl"
                >
                  <option value="">Select Loan Product</option>
                  <option value="Auto">Auto</option>
                  <option value="Corporate">Corporate</option>
                  <option value="Home">Home</option>
                  <option value="Personal">Personal</option>
                  <option value="SME">SME</option>
                </select>
              </div>
            </div>

            {/* Reporting Period (Frequency) */}
            <div className="px-10 pt-6 text-start">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 font-medium text-sm">
                  Reporting Period
                </label>
              </div>
              <div className="flex flex-row border border-gray-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-amber-500">
                <div className="h-11 w-12 border-r border-gray-200 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-gray-500" />
                </div>
                <select
                  id="period"
                  value={selectedPdTransitionMatrixReportingPeriod}
                  onChange={handleReportingPeriodChange}
                  className="flex-1 text-gray-800 py-2.5 pl-2 pr-3 focus:outline-none bg-gray-50 rounded-r-xl"
                >
                  <option value="">Select Period</option>
                  {/* NEW options added per request */}
                  <option value="Monthly">Monthly</option>
                  <option value="Semi-Annually">Semi-Annually</option>
                  {/* existing ones kept */}
                  <option value="Quarterly">Quarterly</option>
                  <option value="Annually">Annually</option>
                </select>
              </div>
            </div>

            {/* NEW: Report Date Start */}
            <div className="px-10 pt-6 text-start">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 font-medium text-sm">
                  Report Date Start
                </label>
              </div>
              <div className="flex flex-row border border-gray-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-amber-500">
                <div className="h-11 w-12 border-r border-gray-200 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  id="reportDateStart"
                  type="date"
                  value={reportDateStart}
                  onChange={(e) => setReportDateStart(e.target.value)}
                  className="flex-1 text-gray-800 py-2.5 pl-2 pr-3 focus:outline-none bg-gray-50 rounded-r-xl"
                />
              </div>
            </div>

            {/* Workflow Name */}
            <div className="px-10 pt-6 text-start">
              <label className="block text-gray-700 mb-2 font-medium text-sm">
                Workflow Name
              </label>
              <div className="flex flex-row border border-gray-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-amber-500">
                <div className="h-11 w-12 border-r border-gray-200 flex items-center justify-center">
                  <FolderIcon className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  id="currentUseSrWorkflowName"
                  type="text"
                  placeholder="Enter workflow name"
                  value={pdTransitionMatrixWfName}
                  onChange={handleWorkflowInputChange}
                  className="flex-1 text-gray-800 py-2.5 pl-2 pr-3 focus:outline-none bg-gray-50 rounded-r-xl"
                />
              </div>
            </div>

            {/* Start Button */}
            <div className="px-10">
              <button
                onClick={handleStartCalculation}
                disabled={!isFormValid || apiStatus === "loading"}
                className={clsx(
                  "w-full px-6 py-3 mt-8 rounded-xl transition-all duration-200 text-gray-900 flex items-center justify-center gap-2",
                  {
                    "bg-amber-400 hover:bg-amber-500 shadow-sm":
                      isFormValid && apiStatus !== "loading",
                    "bg-amber-300/60 cursor-not-allowed":
                      !isFormValid || apiStatus === "loading",
                  }
                )}
              >
                {apiStatus === "loading" && (
                  <svg
                    className="animate-spin h-5 w-5 text-gray-900"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle
                      className="opacity-30"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-90"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    />
                  </svg>
                )}
                Start
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Workflow Folder List */}
        <div className="md:col-span-2 h-full w-full">
          <WorkflowFolderList onWorkflowSelect={handleWorkflowSelect} />
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm bg-white/30 z-50">
          <div className="rounded-2xl shadow-lg p-6 w-[28rem] bg-white border border-gray-200">
            <p className="mb-4 text-gray-800">{modalMessage}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-800 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setProceedWithUpdate(true);
                  setShowModal(false);
                  handleStartCalculation();
                }}
                className="px-4 py-2 rounded-lg bg-amber-400 text-gray-900 hover:bg-amber-500"
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API Status Indicator */}
      <ApiStatusIndicator
        status={apiStatus}
        message={statusMessage}
        onHide={() => setApiStatus("idle")}
      />
    </>
  );
};

export default TransitionMatrixLanding;
