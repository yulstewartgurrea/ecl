import clsx from "clsx";
import { useState, useEffect } from "react";
import {
  InformationCircleIcon,
  QuestionMarkCircleIcon,
  ChevronRightIcon,
  ChevronLeftIcon,
} from "@heroicons/react/24/outline";
import Stepper from "../../components/stepper/Stepper";
import StepNavigation from "../../components/stepper/StepNavigation";
import Step1 from "./steps/Step1";
import Step2 from "./steps/Step2";
import Step3 from "./steps/Step3";
import Step3Consolidation from "./steps/Step3Consolidation";
import Step4 from "./steps/Step4";
import Step5 from "./steps/Step5";
import Step6 from "./steps/Step6";
import Step7 from "./steps/Step7";
import Step8 from "./steps/Step8";
import Step9 from "./steps/Step9";
import Step10 from "./steps/Step10";
import Step11 from "./steps/Step11";

//redux toolkit
import { useAppDispatch } from "../../redux_toolkit/hooks";
import { resetStateNavUIState } from "../../redux_toolkit/features/general/navUIState";
import { resetPdTransitionMatrixWfHelperData } from "../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";

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
  const [currentStep, setCurrentStep] = useState(0);

  const [stepsCompletionStatus, setStepsCompletionStatus] = useState<
    { label: string; completed: boolean }[] | null
  >(null);

  // For two screens inside Step 2 (Data Consolidation)
  const [consolidationSubStep, setConsolidationSubStep] = useState<0 | 1>(0);

  useEffect(() => {
    if (!stepsCompletionStatus) {
      setStepsCompletionStatus(
        stepLabels.map((label) => ({
          label,
          completed: false,
        }))
      );
    }
  }, [stepsCompletionStatus]);

  const handleStepClick = (index: number) => {
    if (stepsCompletionStatus && stepsCompletionStatus[index].completed) {
      setCurrentStep(index);
    }
  };

  const handleContinue = () => {
    if (!stepsCompletionStatus) return;
    if (currentStep === 2 && consolidationSubStep === 0) {
      setConsolidationSubStep(1);
      return;
    }

    setStepsCompletionStatus((prev: any) =>
      prev?.map((step: any, idx: number) =>
        idx === currentStep ? { ...step, completed: true } : step
      )
    );

    setCurrentStep((prev) => prev + 1);
    setConsolidationSubStep(0);
  };

  const handleBack = () => {
    if (!stepsCompletionStatus) return;
    if (consolidationSubStep === 1) {
      setConsolidationSubStep(0);
      return;
    }
    setCurrentStep((prev) => Math.max(0, prev - 1));
  };

  const renderStepComponent = () => {
    switch (currentStep) {
      case 0:
        return <Step1 />;
      case 1:
        return <Step2 />;
      case 2:
        return consolidationSubStep === 0 ? <Step3 /> : <Step3Consolidation />;
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

  let stepDescriptionTitle = stepLabels[currentStep];
  let stepDescription = "Default description here";
  let continueLabel = "Continue";
  if (currentStep === 1) {
    stepDescriptionTitle = "";
    stepDescription = "";
    continueLabel = "Proceed";
  }
  if (currentStep === 2 && consolidationSubStep === 0) {
    stepDescriptionTitle = "Input data";
    stepDescription =
      "Contains monthly transactional-level data, including details such as transaction dates, amounts, and account identifiers";
    continueLabel = "Consolidate";
  } else if (currentStep === 2 && consolidationSubStep === 1) {
    stepDescriptionTitle = "Data consolidation";
    stepDescription =
      "Aggregates monthly data to provide a historical view of borrower payment behavior.";
    continueLabel = "Summarize";
  } else if (currentStep === 3) {
    stepDescriptionTitle = "Pivoting";
    stepDescription =
      "Summarizes monthly Days Past Due (DPD) for each account in a pivot table format.";
    continueLabel = "Map";
  } else if (currentStep === 4) {
    stepDescriptionTitle = "Bucketing";
    stepDescription =
      "Transforms the DPD of each account into predefined buckets (e.g., 0-30 days, 31-60 days, etc.) for ease of implementation once conducting transition matrices.";
    continueLabel = "Flag Accounts";
  } else if (currentStep === 5) {
    stepDescriptionTitle = "Everbad";
    stepDescription = "Flag accounts as permanently bad once a default occurs.";
    continueLabel = "Calculate Default Rate";
  } else if (currentStep === 6) {
    stepDescriptionTitle = "Default Rate";
    stepDescription =
      "Calculates the rate at which accounts transition from a 'good' status to 'bad' over a defined performance window, typically 12 months, based on historical behavior.";
    continueLabel = "Build transition matrices";
  } else if (currentStep === 7) {
    stepDescriptionTitle = "Matrix Construction";
    stepDescription =
      "Build transition matrices to track bucket-to-bucket migration over time.";
    continueLabel = "Use Markov property";
  } else if (currentStep === 8) {
    stepDescriptionTitle = "Markov Chain";
    stepDescription = "uses the Markov property to derive the 12-month TTC PD.";
    continueLabel = "Generate Output";
  } else if (currentStep === 9) {
    stepDescriptionTitle = "TTC PD";
    stepDescription = "Outputs the through cycle PD.";
    continueLabel = "Proceed";
  } else if (currentStep === 10) {
    stepDescriptionTitle = "Historical Default Rate";
    stepDescription = "Outputs the historical default rate.";
    continueLabel = "Complete";
  }

  return (
    <div>
      <div className="flex flex-row items-start justify-between gap-1 bg-[#f8f8f8] px-4 py-2 sticky top-0 z-20">
        <div className="mt-1">
          <button
            onClick={() => {
              dispatch(resetStateNavUIState());
              dispatch(resetPdTransitionMatrixWfHelperData());
              window.location.href = "/";
            }}
            className={clsx(
              "text-gray-700 px-4 py-2 rounded disabled:opacity-50 inline-flex items-center gap-2 disabled:cursor-not-allowed hover:underline"
            )}
          >
            <ChevronLeftIcon className="w-5 h-5 text-gray-700" />
            Back
          </button>
        </div>
        {stepsCompletionStatus && stepsCompletionStatus?.length > 0 && (
          <Stepper
            steps={stepsCompletionStatus}
            activeStep={currentStep}
            onStepClick={handleStepClick}
          />
        )}
        <div className="flex flex-row gap-2 items-center justify-center">
          <InformationCircleIcon className="text-gray-500 h-8 w-8 cursor-pointer" />
          <QuestionMarkCircleIcon className="text-gray-500 h-8 w-8 cursor-pointer" />
        </div>
      </div>
      <div className="w-full flex flex-row p-2">
        <div className="w-full min-h-[750px] bg-white p-4 shadow-md rounded">
          {currentStep === 0 ? (
            <div className="w-full inline-flex items-end justify-end gap-4">
              <button
                onClick={handleContinue}
                className="bg-[#fce404] cursor-pointer shadow-md font-normal px-4 py-1 rounded-lg inline-flex items-center justify-center"
              >
                Validate Data
                <ChevronRightIcon className="w-5 h-5 font-bold mt-0.5" />
              </button>
            </div>
          ) : (
            <StepNavigation
              currentStep={currentStep}
              totalSteps={stepLabels.length}
              descriptionTitle={stepDescriptionTitle}
              description={stepDescription}
              onBack={handleBack}
              onContinue={handleContinue}
              continueLabel={continueLabel}
              onFinish={() => {
                dispatch(resetStateNavUIState());
                dispatch(resetPdTransitionMatrixWfHelperData());
                window.location.href = "/";
              }}
            />
          )}

          {renderStepComponent()}
        </div>
      </div>
    </div>
  );
};

export default PdTransitionMatrixWorkflow;
