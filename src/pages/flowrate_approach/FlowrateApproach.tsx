// ==========================
// pages/flowrate/FlowrateApproachPage.tsx
// ==========================
import { useEffect, useMemo, useState } from "react";
import Stepper from "../../components/stepper/Stepper";
import Step1 from "./steps/Step1";
import Step2 from "./steps/Step2";
import Step3 from "./steps/Step3";
import Step4 from "./steps/Step4";

import { useAppDispatch, useAppSelector } from "../../redux_toolkit/hooks";
import type { RootState } from "../../redux_toolkit/store";
import {
  setPdTransitionMatrixCurrentStep,
} from "../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";
import {
  clearModuleProgress,
  selectModuleProgress,
  setModuleProgress,
} from "../../redux_toolkit/features/progress/moduleProgressSlice";
import { clearStep5Bundle } from "../../redux_toolkit/features/asa/flowrateStep5Slice";

const FlowrateApproachPage = () => {
  const dispatch = useAppDispatch();

  const {
    currentPdTransitionMatrixWorkflowData,
    selectedPdTransitionMatrixEntity,
    selectedPdTransitionMatrixReportingPeriod,
    pdTransitionMatrixWfName,
    selectedPdTransitionMatrixLoanProduct,
    stepsByWorkflowPath = {},
    currentStep: legacyCurrentStep,
  } = useAppSelector((state: RootState) => state.pdTransitionMatrixWfHelper as any);

  // 🔗 Build the canonical workflowPath: entity/reportingPeriod/workflowName/loanProduct
  const workflowPath = useMemo(() => {
    const entity =
      currentPdTransitionMatrixWorkflowData?.entity ||
      selectedPdTransitionMatrixEntity ||
      "";
    const reportingPeriod =
      currentPdTransitionMatrixWorkflowData?.reporting_period ||
      selectedPdTransitionMatrixReportingPeriod ||
      "";
    const wfName =
      currentPdTransitionMatrixWorkflowData?.workflow_name ||
      pdTransitionMatrixWfName ||
      "";
    const loanProduct =
      currentPdTransitionMatrixWorkflowData?.loan_product ||
      selectedPdTransitionMatrixLoanProduct ||
      "";

    if (!entity || !reportingPeriod || !wfName || !loanProduct) {
      return "";
    }

    return `${entity}/${reportingPeriod}/${wfName}/${loanProduct}`;
  }, [
    currentPdTransitionMatrixWorkflowData,
    selectedPdTransitionMatrixEntity,
    selectedPdTransitionMatrixReportingPeriod,
    pdTransitionMatrixWfName,
    selectedPdTransitionMatrixLoanProduct,
  ]);

  const persistedStep = useAppSelector((state: RootState) =>
    selectModuleProgress(state, "flowrate", workflowPath || undefined)?.step
  );

  // Prefer persisted module step; fall back to per-workflow step; then legacy currentStep; then 0
  const initialStepForPath =
    (persistedStep !== undefined
      ? persistedStep
      : workflowPath && stepsByWorkflowPath[workflowPath] !== undefined
      ? stepsByWorkflowPath[workflowPath]
      : legacyCurrentStep ?? 0) || 0;

  const [activeSubStep, setActiveSubStep] = useState<number>(initialStepForPath);

  // Keep local state synced if Redux step for this path changes
  useEffect(() => {
    setActiveSubStep(initialStepForPath);
  }, [initialStepForPath]);

  const developmentSteps = [
    { label: "Inputs", completed: false },
    { label: "Flowrate Approach", completed: false },
    { label: "Credit Loss Rate Approach", completed: false },
    { label: "Output", completed: false },
  ];

  const commitStepChange = (targetIndex: number) => {
    setActiveSubStep(targetIndex);

    // Persist step in Redux, including the workflowPath so
    // each workflow remembers its own last step.
    dispatch(
      setPdTransitionMatrixCurrentStep({
        step: targetIndex,
        workflowPath: workflowPath || undefined,
      })
    );

    dispatch(
      setModuleProgress({
        moduleKey: "flowrate",
        contextKey: workflowPath || undefined,
        step: targetIndex,
        data: workflowPath ? { workflowPath } : undefined,
      })
    );
  };

  const handleFinish = () => {
    dispatch(
      clearModuleProgress({
        moduleKey: "flowrate",
        contextKey: workflowPath || undefined,
      })
    );
    if (workflowPath) {
      const parts = workflowPath.split("/");
      const wfId = Number(localStorage.getItem("current_workflow_id") || "");
      if (Number.isFinite(wfId)) {
        dispatch(clearStep5Bundle(wfId));
      } else {
        dispatch(clearStep5Bundle(undefined));
      }
    } else {
      dispatch(clearStep5Bundle(undefined));
    }
    setActiveSubStep(0);
    dispatch(
      setPdTransitionMatrixCurrentStep({
        step: 0,
        workflowPath: workflowPath || undefined,
      })
    );
  };

  const renderSubStepContent = () => {
    switch (activeSubStep) {
      case 0:
        return <Step1 />;
      case 1:
        return <Step2 />;
      case 2:
        return <Step3 />;
      case 3:
        return <Step4 />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 ">
        <div className="mx-auto px-6 py-4 flex items-center justify-between bg-white">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Flowrate Approach
            </h1>
            <p className="text-xs text-gray-800">
              A structured and dynamic framework for estimating credit losses.
            </p>
          </div>
          {activeSubStep === developmentSteps.length - 1 && (
            <button
              onClick={handleFinish}
              className="rounded-full border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200"
            >
              Finish
            </button>
          )}
        </div>
      </header>

      <div className="flex flex-row items-start justify-between px-4 py-2 sticky top-16 z-30 bg-white">
        <Stepper
          steps={developmentSteps}
          activeStep={activeSubStep}
          onApprovedStepChange={commitStepChange}
          canContinue={true}
        />
      </div>

      <div className="mx-auto lg:px-4 ">
        {renderSubStepContent()}
      </div>
    </div>
  );
};

export default FlowrateApproachPage;
