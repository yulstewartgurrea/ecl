// ==========================
// pages/flowrate/FlowrateApproachPage.tsx
// ==========================
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Stepper from "../../components/stepper/Stepper";
import Step1 from "./steps/Step1";
import Step2 from "./steps/Step2";
import Step3 from "./steps/Step3";
import Step4 from "./steps/Step4";

import { useAppDispatch, useAppSelector } from "../../redux_toolkit/hooks";
import type { RootState } from "../../redux_toolkit/store";
import {
  setPdTransitionMatrixCurrentStep,
  clearPdTransitionMatrixWorkflowStep,
} from "../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";
import {
  clearModuleProgress,
  clearModuleProgressByWorkflowId,
  selectModuleProgress,
  setModuleProgress,
} from "../../redux_toolkit/features/progress/moduleProgressSlice";
import { clearStep5Bundle } from "../../redux_toolkit/features/asa/flowrateStep5Slice";

const FlowrateApproachPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const {
    currentPdTransitionMatrixWorkflowData,
    selectedPdTransitionMatrixEntity,
    selectedPdTransitionMatrixReportingPeriod,
    pdTransitionMatrixWfName,
    selectedPdTransitionMatrixLoanProduct,
    stepsByWorkflowPath = {},
    currentStep: legacyCurrentStep,
  } = useAppSelector((state: RootState) => state.pdTransitionMatrixWfHelper as any);

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

    if (!entity || !reportingPeriod || !wfName || !loanProduct) return "";
    return `${entity}/${reportingPeriod}/${wfName}/${loanProduct}`;
  }, [
    currentPdTransitionMatrixWorkflowData,
    selectedPdTransitionMatrixEntity,
    selectedPdTransitionMatrixReportingPeriod,
    pdTransitionMatrixWfName,
    selectedPdTransitionMatrixLoanProduct,
  ]);

  // IMPORTANT: use a stable key (same idea we used before)
  const progressKey = useMemo(() => {
    const wfId = Number(currentPdTransitionMatrixWorkflowData?.id);
    if (workflowPath) return workflowPath;
    if (Number.isFinite(wfId) && wfId > 0) return `wf:${wfId}`;
    return undefined;
  }, [workflowPath, currentPdTransitionMatrixWorkflowData?.id]);

  const persistedStep = useAppSelector((state: RootState) =>
    selectModuleProgress(state, "flowrate", progressKey)?.step
  );

  const step1Valid = useAppSelector((state: RootState) => {
    const entry = selectModuleProgress(state, "flowrate", progressKey);
    return Boolean((entry?.data as any)?.step1Valid);
  });

  const initialStepForPath =
    (persistedStep !== undefined
      ? persistedStep
      : workflowPath && stepsByWorkflowPath[workflowPath] !== undefined
      ? stepsByWorkflowPath[workflowPath]
      : legacyCurrentStep ?? 0) || 0;

  const [activeSubStep, setActiveSubStep] = useState<number>(initialStepForPath);

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
    if (activeSubStep === 0 && targetIndex > 0 && !step1Valid) return;

    setActiveSubStep(targetIndex);

    dispatch(
      setPdTransitionMatrixCurrentStep({
        step: targetIndex,
        workflowPath: workflowPath || undefined,
      })
    );

    dispatch(
      setModuleProgress({
        moduleKey: "flowrate",
        contextKey: progressKey,
        step: targetIndex,
        data: {
          workflowPath,
        },
      })
    );
  };

  const handleFinish = () => {
    const wfIdRaw = Number(currentPdTransitionMatrixWorkflowData?.id);
    const wfId = Number.isFinite(wfIdRaw) && wfIdRaw > 0 ? wfIdRaw : undefined;

    // 1) Clear module progress for THIS workflow key (so landing won't auto-resume)
    dispatch(
      clearModuleProgress({
        moduleKey: "flowrate",
        contextKey: progressKey,
      })
    );

    // 2) If you also track progress by workflowId, clear it properly (NOT 0)
    if (wfId !== undefined) {
      dispatch(
        clearModuleProgressByWorkflowId({
          moduleKey: "flowrate",
          workflowId: wfId,
        })
      );
    }

    // 3) Clear Step5 bundle for this workflow (if your slice is keyed by workflowId)
    dispatch(clearStep5Bundle(wfId));

    // 4) Reset step tracking in helper (for this workflow path)
    dispatch(
      setPdTransitionMatrixCurrentStep({
        step: 0,
        workflowPath: workflowPath || undefined,
      })
    );

    dispatch(
      clearPdTransitionMatrixWorkflowStep({
        workflowPath: workflowPath || undefined,
      })
    );

    // 5) Navigate back to landing/index.tsx
    // Pass a flag so landing won't immediately "resume" even if some stale progress remains
    navigate("/flowrate", { replace: true, state: { skipResume: true } });
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

  const currentStepLabel = developmentSteps[activeSubStep]?.label ?? "Step";

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20">
        <div className="mx-auto px-6 py-4 flex items-center justify-between bg-white">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {currentStepLabel}
            </h1>
          </div>

          {activeSubStep === developmentSteps.length - 1 && (
            <button
              onClick={handleFinish}
              className="rounded-full border border-gray-200 bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-200"
              type="button"
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
          canContinue={activeSubStep === 0 ? step1Valid : true}
        />
      </div>

      <div className="mx-auto lg:px-4">{renderSubStepContent()}</div>
    </div>
  );
};

export default FlowrateApproachPage;
