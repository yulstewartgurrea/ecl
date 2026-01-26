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
  setPdTransitionMatrixWorkflowId,
  setPdTransitionMatrixWorkflowData,
  setPdTransitionMatrixSelectedLoanProduct,
  setPdTransitionMatrixReportDateStart,
} from "../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";
import { useState, useEffect, useMemo } from "react";
import { setModuleProgress } from "../../redux_toolkit/features/progress/moduleProgressSlice";

const TransitionMatrixLanding = () => {
  const navigate = useNavigate();
  const flowrateProgressMap = useAppSelector(
    (state: any) => state.moduleProgress?.modules?.flowrate || {}
  );
  const lastFlowrateProgress = useMemo(() => {
    const entries = Object.values(flowrateProgressMap) as any[];
    if (!entries.length) return undefined;
    return entries.sort((a, b) => (b?.step ?? 0) - (a?.step ?? 0))[0];
  }, [flowrateProgressMap]);
  const dispatch = useAppDispatch();
  const authToken = useAppSelector((state) => state.auth.token);

  const buildWorkflowPath = (
    entity: string,
    reportingPeriod: string,
    workflowName: string,
    loanProduct: string
  ) => {
    if (!entity || !reportingPeriod || !workflowName || !loanProduct) return "";
    return `${entity}/${reportingPeriod}/${workflowName}/${loanProduct}`;
  };

  // If user has existing flowrate progress, jump back to the Flowrate module steps
  useEffect(() => {
    if (!lastFlowrateProgress) return;
    const data = (lastFlowrateProgress as any)?.data ?? {};
    if (data?.workflowData) {
      dispatch(
        setPdTransitionMatrixWorkflowData({ workflow_data: data.workflowData })
      );
    }
    if (data?.workflowId) {
      dispatch(
        setPdTransitionMatrixWorkflowId({ workflow_id: data.workflowId })
      );
    }
    navigate("/page/flowrate");
  }, [lastFlowrateProgress, navigate, dispatch]);

  const { isSidebarOpen } = useAppSelector((state: any) => state.navUIState);
  const {
    selectedPdTransitionMatrixEntity,
    selectedPdTransitionMatrixReportingPeriod,
    pdTransitionMatrixWfName,
    selectedPdTransitionMatrixLoanProduct,
    selectedPdTransitionMatrixReportDateStart,
  } = useAppSelector((state: any) => state.pdTransitionMatrixWfHelper);

  const loanProducts = useAppSelector(
    (state: any) => state.eclLoanProductsReducer.items
  );
  const entities = useAppSelector(
    (state: any) => state.eclEntitiesReducer.items
  );

  // API status
  const [apiStatus, setApiStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [statusMessage, setStatusMessage] = useState("");

  // Always default reporting period to "Monthly" (once)
  useEffect(() => {
    if (!selectedPdTransitionMatrixReportingPeriod) {
      dispatch(
        setPdTransitionMatrixSelectedReportingPeriod({
          period: "Monthly",
        })
      );
    }
  }, [selectedPdTransitionMatrixReportingPeriod, dispatch]);

  const handleWorkflowSelect = async (
    entity: string,
    reportingPeriod: string,
    workflowName: string,
    loanProduct?: string,
    reportDateStart?: string
  ) => {
    dispatch(
      setPdTransitionMatrixSelectedEntity({
        entity: entity || "",
      })
    );

    dispatch(
      setPdTransitionMatrixSelectedLoanProduct({
        loan_product: loanProduct || "",
      })
    );

    // still store the period in helper (existing workflows may have it)
    dispatch(
      setPdTransitionMatrixSelectedReportingPeriod({
        period: reportingPeriod || "Monthly",
      })
    );

    dispatch(
      setPdTransitionMatrixReportDateStart({
        report_date_start: reportDateStart || "",
      })
    );

    dispatch(
      setPdTransitionMatrixWfName({
        workflow_name: workflowName || "",
      })
    );

    // Fetch workflow ID from backend when folder is selected
    if (entity && reportingPeriod && workflowName) {
      try {
        const params = new URLSearchParams({
          entity: entity,
          loan_product: loanProduct || "",
          reporting_period: reportingPeriod,
          report_date_start: reportDateStart || "",
          workflow_name: workflowName,
          workflow_type: "asa",
        });

        const workflowRes = await fetch(
          `http://127.0.0.1:8000/workflows/?${params.toString()}`,
          { headers: { Authorization: `Bearer ${authToken}` } }
        );

        if (workflowRes.ok) {
          const responseData = await workflowRes.json();
          let wf = null;
          if (Array.isArray(responseData)) {
            wf = responseData[0];
          } else if (responseData?.data) {
            wf = Array.isArray(responseData.data)
              ? responseData.data[0]
              : responseData.data;
          } else {
            wf = responseData;
          }

          if (wf && wf.id) {
            console.log(
              `WORKFLOW FOUND FROM FOLDER: ID=${wf.id}, Name='${wf.workflow_name}'`
            );
            dispatch(setPdTransitionMatrixWorkflowId({ workflow_id: wf.id }));
            dispatch(
              setPdTransitionMatrixWorkflowData({ workflow_data: wf })
            );
            const workflowPath = buildWorkflowPath(
              entity || "",
              reportingPeriod || "Monthly",
              workflowName || "",
              loanProduct || ""
            );
            dispatch(
              setModuleProgress({
                moduleKey: "flowrate",
                contextKey: workflowPath || undefined,
                step: 0,
                data: {
                  workflowId: wf.id,
                  workflowData: wf,
                  workflowPath,
                },
              })
            );
          } else {
            console.log("Workflow not found for selected folder, clearing ID");
            dispatch(
              setPdTransitionMatrixWorkflowId({ workflow_id: null })
            );
            dispatch(
              setPdTransitionMatrixWorkflowData({
                workflow_data: null,
              })
            );
          }
        } else {
          console.log("Failed to fetch workflow, clearing ID");
          dispatch(setPdTransitionMatrixWorkflowId({ workflow_id: null }));
          dispatch(
            setPdTransitionMatrixWorkflowData({
              workflow_data: null,
            })
          );
        }
      } catch (error) {
        console.error(
          "Error fetching workflow from folder selection:",
          error
        );
        dispatch(setPdTransitionMatrixWorkflowId({ workflow_id: null }));
        dispatch(
          setPdTransitionMatrixWorkflowData({
            workflow_data: null,
          })
        );
      }
    } else {
      dispatch(setPdTransitionMatrixWorkflowId({ workflow_id: null }));
      dispatch(
        setPdTransitionMatrixWorkflowData({
          workflow_data: null,
        })
      );
    }
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

        const checkUrl = new URL(
          "http://127.0.0.1:8000/documents/workflows/check"
        );

        checkUrl.searchParams.set(
          "entity",
          selectedPdTransitionMatrixEntity
        );
        checkUrl.searchParams.set(
          "loan_product",
          selectedPdTransitionMatrixLoanProduct || ""
        );
        checkUrl.searchParams.set(
          "reporting_period",
          selectedPdTransitionMatrixReportingPeriod
        );
        checkUrl.searchParams.set(
          "report_date_start",
          selectedPdTransitionMatrixReportDateStart || ""
        );
        checkUrl.searchParams.set(
          "workflow_name",
          pdTransitionMatrixWfName
        );

        const checkResponse = await fetch(checkUrl.toString(), {
          headers: { Authorization: `Bearer ${authToken}` },
        });

        if (!checkResponse.ok) {
          throw new Error(`Error: ${checkResponse.statusText}`);
        }

        const checkData = await checkResponse.json();
        console.log("exists?", checkData.exists, pdTransitionMatrixWfName);

        // --- If workflow exists, load it and go to steps (no re-create)
        if (checkData.exists) {
          try {
            setApiStatus("loading");
            setStatusMessage("Loading existing workflow...");

            const params = new URLSearchParams({
              entity: selectedPdTransitionMatrixEntity,
              loan_product: selectedPdTransitionMatrixLoanProduct || "",
              reporting_period: selectedPdTransitionMatrixReportingPeriod,
              report_date_start:
                selectedPdTransitionMatrixReportDateStart || "",
              workflow_name: pdTransitionMatrixWfName,
              workflow_type: "asa",
            });

            const existingRes = await fetch(
              `http://127.0.0.1:8000/workflows/?${params.toString()}`,
              { headers: { Authorization: `Bearer ${authToken}` } }
            );

            if (!existingRes.ok) {
              throw new Error(
                `Failed to load existing workflow (${existingRes.status})`
              );
            }

            const responseData = await existingRes.json();
            let wf = null;
            if (Array.isArray(responseData)) {
              wf = responseData[0];
            } else if (responseData?.data) {
              wf = Array.isArray(responseData.data)
                ? responseData.data[0]
                : responseData.data;
            } else {
              wf = responseData;
            }

            if (!wf || !wf.id) {
              throw new Error("Existing workflow not found on server.");
            }

            dispatch(
              setPdTransitionMatrixWorkflowId({ workflow_id: wf.id })
            );
            dispatch(
              setPdTransitionMatrixWorkflowData({
                workflow_data: wf,
              })
            );

            const workflowPath = buildWorkflowPath(
              selectedPdTransitionMatrixEntity,
              selectedPdTransitionMatrixReportingPeriod,
              pdTransitionMatrixWfName,
              selectedPdTransitionMatrixLoanProduct || ""
            );
            dispatch(
              setModuleProgress({
                moduleKey: "flowrate",
                contextKey: workflowPath || undefined,
                step: 0,
                data: {
                  workflowId: wf.id,
                  workflowData: wf,
                  workflowPath,
                },
              })
            );

            setApiStatus("success");
            setStatusMessage("Workflow loaded.");

            // go to current flowrate steps page
            navigate(`/page/flowrate`, {
              state: { pdTransitionMatrixWfName },
            });
            return;
          } catch (err: any) {
            console.error(err);
            setApiStatus("error");
            setStatusMessage(
              err?.message || "Failed to load existing workflow."
            );
            return;
          }
        }

        // --- CASE 3: workflow does NOT exist -> create new, as before
        setApiStatus("loading");
        setStatusMessage("Creating workflow...");

        const payload = {
          entity: selectedPdTransitionMatrixEntity,
          workflow_name: pdTransitionMatrixWfName,
          reporting_period: selectedPdTransitionMatrixReportingPeriod,
          baseline_year: "2023",
          loan_product: selectedPdTransitionMatrixLoanProduct || undefined,
          report_date_start:
            selectedPdTransitionMatrixReportDateStart || undefined,
          workflow_type: "asa",
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

        const workflowResponseData = await workflowResponse.json();
        console.log("Full workflow response:", workflowResponseData);

        const workflowData =
          workflowResponseData?.data || workflowResponseData;

        if (workflowData && workflowData.id) {
          const workflowId = workflowData.id;
          console.log(
            `WORKFLOW CREATED: ID=${workflowId}, Name='${workflowData.workflow_name}', Entity='${workflowData.entity}', Period='${workflowData.reporting_period}'`
          );

          dispatch(
            setPdTransitionMatrixWorkflowId({ workflow_id: workflowId })
          );
          dispatch(
            setPdTransitionMatrixWorkflowData({
              workflow_data: workflowData,
            })
          );
          const workflowPath = buildWorkflowPath(
            selectedPdTransitionMatrixEntity,
            selectedPdTransitionMatrixReportingPeriod,
            pdTransitionMatrixWfName,
            selectedPdTransitionMatrixLoanProduct || ""
          );
          dispatch(
            setModuleProgress({
              moduleKey: "flowrate",
              contextKey: workflowPath || undefined,
              step: 0,
              data: {
                workflowId,
                workflowData,
                workflowPath,
              },
            })
          );
        } else {
          console.error("No workflow ID in response:", workflowResponseData);
        }

        setStatusMessage("Creating folder structure...");

        await invoke("create_folder_tree", {
          entity: selectedPdTransitionMatrixEntity,
          loan_product: selectedPdTransitionMatrixLoanProduct!,
          period: selectedPdTransitionMatrixReportingPeriod,
          report_date_start: selectedPdTransitionMatrixReportDateStart!,
          workflow_name: pdTransitionMatrixWfName,

          loanProduct: selectedPdTransitionMatrixLoanProduct,
          workflowName: pdTransitionMatrixWfName,
          reportDateStart: selectedPdTransitionMatrixReportDateStart,
        });

        setApiStatus("success");
        setStatusMessage("Workflow created successfully!");

        navigate(`/page/flowrate`, {
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
    dispatch(
      setPdTransitionMatrixSelectedEntity({ entity: e.target.value })
    );
  };

  const handleWorkflowInputChange = (e: any) => {
    dispatch(
      setPdTransitionMatrixWfName({ workflow_name: e.target.value })
    );
  };

  const handleLoanProductChange = (e: any) => {
    dispatch(
      setPdTransitionMatrixSelectedLoanProduct({
        loan_product: e.target.value,
      })
    );
  };

  const handleReportDateStartChange = (e: any) => {
    dispatch(
      setPdTransitionMatrixReportDateStart({
        report_date_start: e.target.value,
      })
    );
  };

  const isFormValid =
    selectedPdTransitionMatrixEntity &&
    pdTransitionMatrixWfName &&
    selectedPdTransitionMatrixReportingPeriod &&
    selectedPdTransitionMatrixLoanProduct;

  return (
    <>
      <div className="w-full h-full grid md:grid-cols-5 sm:grid-cols-2 space-y-2">
        <div
          className={clsx(
            "md:col-span-3 w-full h-full flex flex-col items-center justify-center"
          )}
        >
          <div className="text-center">
            <h1 className="text-3xl font-semibold mb-4 text-gray-800">
              Flowrate Approach Workflow
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
                  Business Unit
                </label>
              </div>
              <div className="flex flex-row border border-gray-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-amber-500">
                <div className="h-11 w-12  border-gray-200 flex items-center justify-center">
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
                  No entities found. Go to{" "}
                  <b>Configuration {"->"} Entities</b> to add one.
                </p>
              )}
            </div>

            {/* Loan Product */}
            <div className="px-10 pt-6 text-start">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 font-medium text-sm">
                  Loan Product
                </label>
              </div>
              <div className="flex flex-row border border-gray-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-amber-500">
                <div className="h-11 w-12  border-gray-200 flex items-center justify-center">
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
                        {lp.name}
                        {lp.code ? ` (${lp.code})` : ""}
                      </option>
                    ))}
                </select>
              </div>
              {(!loanProducts || loanProducts.length === 0) && (
                <p className="text-xs text-amber-600 mt-2">
                  No loan products found. Go to{" "}
                  <b>Configuration {"->"} Loan Products</b> to add one.
                </p>
              )}
            </div>

            {/* Reporting Period - fixed Monthly, disabled */}
            <div className="px-10 pt-6 text-start">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 font-medium text-sm">
                  Reporting Frequency
                </label>
              </div>
              <div className="flex flex-row border border-gray-300 rounded-xl bg-gray-100">
                <div className="h-11 w-12  border-gray-200 flex items-center justify-center">
                  <CalendarIcon className="w-5 h-5 text-gray-500" />
                </div>
                <input
                  type="text"
                  value="Monthly"
                  disabled
                  className="flex-1 text-gray-500 py-2.5 pl-2 pr-3 bg-gray-100 rounded-r-xl cursor-not-allowed"
                />
              </div>
           
            </div>

            {/* Report Date Start */}
            <div className="px-10 pt-6 text-start">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-gray-700 font-medium text-sm">
                  Reporting Date (Month-end)
                </label>
              </div>
              <div className="flex flex-row border border-gray-300 rounded-xl bg-white focus-within:ring-2 focus-within:ring-amber-500">
                <div className="h-11 w-12  border-gray-200 flex items-center justify-center">
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
              <label className="block text-gray-700 mb-2 font-medium text-sm">
                Workflow Name
              </label>
              <div className="flex flex-row border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-amber-500 rounded-xl">
                <div className="h-11 w-12  border-gray-200 flex items-center justify-center">
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

