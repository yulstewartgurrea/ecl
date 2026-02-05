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
  setModuleProgress,
} from "../../redux_toolkit/features/progress/moduleProgressSlice";
import { clearStep5Bundle } from "../../redux_toolkit/features/asa/flowrateStep5Slice";

const FlowrateApproachPage = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const {
    currentPdTransitionMatrixWorkflowId,
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

  const workflowIdForKey = useMemo(() => {
    const wfIdRaw =
      currentPdTransitionMatrixWorkflowId ??
      currentPdTransitionMatrixWorkflowData?.id;
    const wfId = Number(wfIdRaw);
    return Number.isFinite(wfId) && wfId > 0 ? wfId : undefined;
  }, [currentPdTransitionMatrixWorkflowId, currentPdTransitionMatrixWorkflowData?.id]);

  const flowrateProgressMap = useAppSelector(
    (state: RootState) => state.moduleProgress?.modules?.flowrate || {}
  ) as Record<string, any>;

  const progressEntry = useMemo(() => {
    if (workflowPath && flowrateProgressMap[workflowPath]) {
      return flowrateProgressMap[workflowPath];
    }
    if (workflowIdForKey) {
      return (
        flowrateProgressMap[`wf:${workflowIdForKey}`] ||
        Object.values(flowrateProgressMap).find(
          (entry: any) => (entry?.data as any)?.workflowId === workflowIdForKey
        )
      );
    }
    return undefined;
  }, [flowrateProgressMap, workflowPath, workflowIdForKey]);

  const persistedStep = progressEntry?.step;

  const step1Status = useMemo(() => {
    const status = (progressEntry?.data as any)?.step1Status as string | undefined;
    return status ?? "empty";
  }, [progressEntry]);
  const canProceedFromUpload = step1Status === "success";
  const [step1GateMsg, setStep1GateMsg] = useState<string | null>(null);

  useEffect(() => {
    if (canProceedFromUpload || step1Status === "empty" || step1Status === "uploading") {
      setStep1GateMsg(null);
    }
  }, [canProceedFromUpload, step1Status]);

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

  useEffect(() => {
    if (step1Status === "success" && step1GateMsg) {
      setStep1GateMsg(null);
    }
  }, [step1Status, step1GateMsg]);

  const developmentSteps = [
    { label: "Inputs", completed: false },
    { label: "Flowrate Approach", completed: false },
    { label: "Credit Loss Rate Approach", completed: false },
    { label: "Output", completed: false },
  ];

  const commitStepChange = (targetIndex: number) => {
    if (activeSubStep === 0 && targetIndex > 0 && !canProceedFromUpload) {
      if (step1Status === "error") {
        setStep1GateMsg(
          "You cannot proceed to the next step because there is an error in your upload."
        );
      } else {
        setStep1GateMsg("Please upload a valid file before proceeding.");
      }
      return;
    }

    setActiveSubStep(targetIndex);
    if (step1GateMsg) setStep1GateMsg(null);

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
        contextKey: workflowPath || undefined,
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
          canContinue={activeSubStep === 0 ? canProceedFromUpload : true}
        />
      </div>

      {activeSubStep === 0 && step1GateMsg && (
        <div className="mx-auto px-4 pt-2">
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {step1GateMsg}
          </div>
        </div>
      )}

      <div className="mx-auto lg:px-4">{renderSubStepContent()}</div>
    </div>
  );
};

export default FlowrateApproachPage;
