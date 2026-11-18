"use client";
import clsx from "clsx";
import { useState, useEffect } from "react";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import Stepper, { type Step } from "../../components/stepper/Stepper";
import Step1 from "./steps/Step1";
import Step2 from "./steps/Step2";
import Step3Consolidation from "./steps/Step3Consolidation";
import Step4 from "./steps/Step4";
import Step5 from "./steps/Step5";
import Step6 from "./steps/Step6";
import Step7 from "./steps/Step7";
import Step8 from "./steps/Step8";
import Step9 from "./steps/Step9";
import Step10 from "./steps/Step10";
import Step11 from "./steps/Step11";

// redux toolkit
import { useAppDispatch } from "../../redux_toolkit/hooks";
import { resetStateNavUIState } from "../../redux_toolkit/features/general/navUIState";
import { resetPdMatrixWfHelperData } from "../../redux_toolkit/features/probability_of_default/transition_matrix/pdMatrixWfHelper";
import { useSelector } from "react-redux";
import type { RootState } from "../../redux_toolkit/store";
import { setModuleStep } from "../../redux_toolkit/features/workflow/workflowSlice";

const stepLabels = [
  "Input Files",
  "Data Validation",
  "Data Consolidation",
  "Pivoting",
  "Bucketing",
  "Everbad",
  "Default Rate",
  "Matrix Construction",
  "Markov Chain",
  "TTC PD",
  "Historical Default Rate",
];

const PdTransitionMatrixWorkflow = () => {
  const dispatch = useAppDispatch();

  // Redux current step (0-based)
  const currentStep = useSelector(
    (state: RootState) => state.workflow.modules.transitionMatrix.currentStep,
  );

  const setCurrentStepRedux = (step: number) => {
    dispatch(setModuleStep({ moduleId: "transitionMatrix", step }));
  };

  const [stepsCompletionStatus, setStepsCompletionStatus] = useState<
    Step[] | null
  >(null);

  useEffect(() => {
    if (!stepsCompletionStatus) {
      setStepsCompletionStatus(
        stepLabels.map((label) => ({
          label,
          completed: false,
        })),
      );
    }
  }, [stepsCompletionStatus]);

  /** Go to the selected step and mark the current one as completed */
  const commitStepChange = (targetIndex: number) => {
    setStepsCompletionStatus(
      (prev) =>
        prev?.map((s, idx) =>
          idx === currentStep ? { ...s, completed: true } : s,
        ) ?? prev,
    );
    setCurrentStepRedux(targetIndex);
  };

  const renderStepComponent = () => {
    switch (currentStep) {
      case 0:
        return <Step1 />;
      case 1:
        return <Step2 />;
      case 2:
        return <Step3Consolidation />;
      case 3:
        return <Step4 />;
      case 4:
        return <Step5 />;
      case 5:
        return <Step6 />;
      case 6:
        return <Step7 />;
      case 7:
        return <Step8 />;
      case 8:
        return <Step9 />;
      case 9:
        return <Step10 />;
      case 10:
        return <Step11 />;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex flex-row items-start justify-between gap-1 bg-[#f8f8f8] px-4 py-2 sticky top-0 z-20">
        <div className="mt-1">
          <button
            onClick={() => {
              dispatch(resetStateNavUIState());
              dispatch(resetPdMatrixWfHelperData());
              window.location.href = "/";
            }}
            className={clsx(
              "text-gray-700 px-4 py-2 rounded disabled:opacity-50 inline-flex items-center gap-2 disabled:cursor-not-allowed hover:underline",
            )}
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-700" />
            Back
          </button>
        </div>

        {stepsCompletionStatus && stepsCompletionStatus.length > 0 && (
          <Stepper
            steps={stepsCompletionStatus}
            activeStep={currentStep}
            canContinue={currentStep === 1} // your existing visual cue for Step 2
            onApprovedStepChange={commitStepChange}
          />
        )}
      </div>

      <div className="w-full flex flex-row p-2">
        <div className="w-full min-h-[750px] bg-white p-4 shadow-md rounded">
          {renderStepComponent()}
        </div>
      </div>
    </div>
  );
};

export default PdTransitionMatrixWorkflow;
