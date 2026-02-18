import { useNavigate } from "react-router-dom";
import clsx from "clsx";
import {
  CalendarIcon,
  UserGroupIcon,
  ChevronRightIcon,
  FolderIcon,
} from "@heroicons/react/16/solid";
import { invoke } from "@tauri-apps/api/core";
import {
  createOrUpdateWorkflow,
  WorkflowAlreadyExistsError,
} from "../../services/workflow"; // ← adjust path if needed


import WorkflowFolderList from "./WorkflowFolderList";
import ApiStatusIndicator from "../../components/ApiStatusIndicators";

import { useAppDispatch, useAppSelector } from "../../redux_toolkit/hooks";
import {
  setPdTransitionMatrixSelectedEntity,
  setPdTransitionMatrixSelectedReportingPeriod,
  setPdTransitionMatrixWfName,
  setPdTransitionMatrixWorkflowId,
  // NEW actions
  setPdTransitionMatrixSelectedLoanProduct,
  setPdTransitionMatrixReportDateStart,
} from "../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";
import { useState } from "react";
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
const TransitionMatrixLanding = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const authToken = useAppSelector((state) => state.auth.token);

  const { isSidebarOpen } = useAppSelector((state: any) => state.navUIState);
  const {
    selectedPdTransitionMatrixEntity,
    selectedPdTransitionMatrixReportingPeriod,
    pdTransitionMatrixWfName,
    currentPdTransitionMatrixWorkflowId,
    // NEW from Redux
    selectedPdTransitionMatrixLoanProduct,
    selectedPdTransitionMatrixReportDateStart,
  } = useAppSelector((state: any) => state.pdTransitionMatrixWfHelper);
  const loanProducts = useAppSelector((state: any) => state.eclLoanProductsReducer.items);
  // Entities saved in Redux
  const entities = useAppSelector((state: any) => state.eclEntitiesReducer.items);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [proceedWithUpdate, setProceedWithUpdate] = useState(false);

  // API status
  const [apiStatus, setApiStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // Debug
  console.log("Transition Matrix - Current workflow ID:", currentPdTransitionMatrixWorkflowId);

  const handleWorkflowSelect = (
    entity: string,
    reportingPeriod: string,
    workflowName: string
  ) => {
    dispatch(setPdTransitionMatrixSelectedEntity({ entity }));
    dispatch(setPdTransitionMatrixSelectedReportingPeriod({ period: reportingPeriod }));
    dispatch(setPdTransitionMatrixWfName({ workflow_name: workflowName }));
    console.log("Current workflow ID:", currentPdTransitionMatrixWorkflowId);
  };
  
const handleStartCalculation = async () => {
  if (
    !pdTransitionMatrixWfName.trim() ||
    !selectedPdTransitionMatrixEntity ||
    !selectedPdTransitionMatrixReportingPeriod
  ) {
    return;
  }

  try {
    setApiStatus("loading");
    setStatusMessage("Checking or creating workflow…");

    // Uses services/workflow.ts to check + create in one call
    const record = await createOrUpdateWorkflow({
      apiBase: API_BASE,
      token: authToken,
      entity: String(selectedPdTransitionMatrixEntity),
      reportingPeriod: String(selectedPdTransitionMatrixReportingPeriod),
      workflowName: pdTransitionMatrixWfName,
      proceedWithUpdate, // if false and it exists, the service throws WorkflowAlreadyExistsError
      baselineYear: "2023",
      loanProduct: selectedPdTransitionMatrixLoanProduct || undefined,
      reportDateStart: selectedPdTransitionMatrixReportDateStart || undefined,
      workflowType: "ecl",
    });

    // Save id to Redux if returned
    if (record?.id) {
      dispatch(setPdTransitionMatrixWorkflowId({ workflow_id: record.id }));
    }

    // Local folder structure (Tauri command)
    setStatusMessage("Creating folder structure…");
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
  } catch (err: any) {
    if (err instanceof WorkflowAlreadyExistsError) {
      // Show your confirmation modal; user can “Continue” to set proceedWithUpdate true
      setModalMessage(
        "This workflow already exists. If you wish to continue, click Continue. Note that it will update the existing record."
      );
      setShowModal(true);
      setApiStatus("idle");
      return;
    }
    console.error("Failed to start calculation:", err);
    setApiStatus("error");
    setStatusMessage(err?.message || "Something went wrong");
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

  // NEW: Redux-backed handlers
  const handleLoanProductChange = (e: any) => {
    dispatch(setPdTransitionMatrixSelectedLoanProduct({ loan_product: e.target.value }));
  };
  const handleReportDateStartChange = (e: any) => {
    dispatch(setPdTransitionMatrixReportDateStart({ report_date_start: e.target.value }));
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
            <h1 className="text-3xl font-semibold mb-4 text-gray-800">Transition Matrix Workflow</h1>
          </div>

          <div
            className={clsx(
              "col-span-3 border border-gray-200 rounded-2xl bg-white shadow-sm pb-10 transition-all duration-300",
              { "min-w-4/5": !isSidebarOpen, "min-w-5/6": isSidebarOpen }
            )}
          >
            {/* Entity (from Redux) */}
            <div className="px-10 pt-8 text-start">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 font-medium text-sm">Generate Report For</label>
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
                  {Array.isArray(entities) &&
                    entities.map((row: any) => (
                      <option key={row.id} value={row.name}>
                        {row.name}
                        {row.code ? ` (${row.code})` : ""}
                      </option>
                    ))}
                </select>
              </div>
              {(!entities || entities.length === 0) && (
                <p className="text-xs text-amber-600 mt-2">
                  No entities found. Go to <b>Configuration → Entities</b> to add one.
                </p>
              )}
            </div>

            {/* Loan Product (Redux) */}
            <div className="px-10 pt-6 text-start">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 font-medium text-sm">Loan Product</label>
              </div>
              <div className="flex flex-row border border-gray-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-amber-500">
                <div className="h-11 w-12 border-r border-gray-200 flex items-center justify-center">
                  <FolderIcon className="w-5 h-5 text-gray-500" />
                </div>
                  <select
                    id="loanProduct"
                    value={selectedPdTransitionMatrixLoanProduct || ""}
                    onChange={handleLoanProductChange}
                    className="flex-1 text-gray-800 py-2.5 pl-2 pr-3 focus:outline-none bg-gray-50 rounded-r-xl"
                  >
                    <option value="">Select Loan Product</option>
                    {Array.isArray(loanProducts) &&
                      loanProducts.map((lp: any) => (
                        <option key={lp.id} value={lp.name}>
                          {lp.name}{lp.code ? ` (${lp.code})` : ""}
                        </option>
                      ))}
                  </select>
                  {(!loanProducts || loanProducts.length === 0) && (
                    <p className="text-xs text-amber-600 mt-2">
                      No loan products found. Go to <b>Configuration → Loan Products</b> to add one.
                    </p>
                  )}

              </div>
            </div>

            {/* Reporting Period (Frequency) */}
            <div className="px-10 pt-6 text-start">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 font-medium text-sm">Reporting Period</label>
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
                  <option value="Monthly">Monthly</option>
                  <option value="Semi-Annually">Semi-Annually</option>
                  <option value="Quarterly">Quarterly</option>
                  <option value="Annually">Annually</option>
                </select>
              </div>
            </div>

            {/* Report Date Start (Redux) */}
            <div className="px-10 pt-6 text-start">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 font-medium text-sm">Report Date Start</label>
              </div>
              <div className="flex flex-row border border-gray-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-amber-500">
                <div className="h-11 w-12 border-r border-gray-200 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  id="reportDateStart"
                  type="date"
                  value={selectedPdTransitionMatrixReportDateStart || ""}
                  onChange={handleReportDateStartChange}
                  className="flex-1 text-gray-800 py-2.5 pl-2 pr-3 focus:outline-none bg-gray-50 rounded-r-xl"
                />
              </div>
            </div>

            {/* Workflow Name */}
            <div className="px-10 pt-6 text-start">
              <label className="block text-gray-700 mb-2 font-medium text-sm">Workflow Name</label>
              <div className="flex flex-row border border-gray-300 rounded-XL bg-white focus-within:ring-2 focus-within:ring-amber-500 rounded-xl">
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
