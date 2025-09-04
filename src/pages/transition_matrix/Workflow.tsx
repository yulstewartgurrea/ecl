"use client";
import clsx from "clsx";
import { useState, useEffect } from "react";
import {
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

// redux toolkit
import { useAppDispatch, useAppSelector } from "../../redux_toolkit/hooks";
import { resetStateNavUIState } from "../../redux_toolkit/features/general/navUIState";
import {
  resetPdTransitionMatrixWfHelperData,
  setPdTransitionMatrixCurrentStep,
} from "../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";
import {
  resetPdMatrixWfHelperData
} from "../../redux_toolkit/features/probability_of_default/transition_matrix/pdMatrixWfHelper";
import { useSelector } from "react-redux";
import type { RootState } from "../../redux_toolkit/store";

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
  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const directoryPath = `/${entity}/${period}/${workflowName}`;
  // Redux current step
  const currentStep = useSelector(
    (state: RootState) => state.pdTransitionMatrixWfHelper.currentStep
  );
  const setCurrentStepRedux = (step: number) => {
    dispatch(setPdTransitionMatrixCurrentStep({ step }));
  };

  const [stepsCompletionStatus, setStepsCompletionStatus] = useState<
    { label: string; completed: boolean }[] | null
  >(null);
  const workflowMetrics = useAppSelector(
    (state: RootState) =>
      state.pdMatrixWfHelper.workflowMetrics[
        directoryPath
      ] || {}
  );

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

  const handleContinue = () => {
    if (!stepsCompletionStatus) return;

    // If in Step 2 ("Data Validation"), open modal first
    if (currentStep === 1) {
      setShowConfirmModal(true);
      return;
    }

    if (currentStep === 2 && consolidationSubStep === 0) {
      setConsolidationSubStep(1);
      return;
    }

    setStepsCompletionStatus((prev: any) =>
      prev?.map((step: any, idx: number) =>
        idx === currentStep ? { ...step, completed: true } : step
      )
    );

    setCurrentStepRedux(currentStep + 1);
    setConsolidationSubStep(0);
  };

  const handleBack = () => {
    if (!stepsCompletionStatus) return;
    if (consolidationSubStep === 1) {
      setConsolidationSubStep(0);
      return;
    }
    setCurrentStepRedux(Math.max(0, currentStep - 1));
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
    stepDescriptionTitle = "Monthly transactional dataset";
    stepDescription = "Validates the uploaded dataset for completeness, accuracy, and consistency.";
    continueLabel = "Proceed";
  }
  if (currentStep === 2 && consolidationSubStep === 0) {
    stepDescriptionTitle = "Input data";
    stepDescription =
      "Consolidates multiple months of data into a single dataset for analysis.";
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
    stepDescription = "Uses the Markov property to derive the 12-month TTC PD.";
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

  // ----------------------
  // Sorting helper for modal
  // ----------------------
  // const MONTH_ORDER = [
  //   "jan",
  //   "feb",
  //   "mar",
  //   "apr",
  //   "may",
  //   "jun",
  //   "jul",
  //   "aug",
  //   "sep",
  //   "oct",
  //   "nov",
  //   "dec",
  // ];

  // const getSortedMetricKeys = (): string[] => {
  //   try {
  //     const metricsObj = JSON.parse(localStorage.getItem("metrics") || "{}");
  //     const keys = Object.keys(metricsObj);

  //     // quick return if no keys
  //     if (!keys.length) return keys;

  //     // regex covers full month names and 3-letter abbreviations followed by optional separators then 4-digit year
  //     const regex =
  //       /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[ _-]*[_\s-]*(\d{4})\b/i;

  //     const parsed = keys.map((k, idx) => {
  //       const lower = k.toLowerCase();
  //       const m = lower.match(regex);
  //       if (m) {
  //         const monthStr = m[1].slice(0, 3);
  //         const monthIdx = MONTH_ORDER.indexOf(monthStr);
  //         const year = parseInt(m[2], 10);
  //         return { key: k, year: Number.isFinite(year) ? year : null, monthIdx: monthIdx >= 0 ? monthIdx : null, idx };
  //       }
  //       // fallback: try find year and month contained anywhere
  //       const yearMatch = lower.match(/(\d{4})/);
  //       const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
  //       const monthIdx = MONTH_ORDER.findIndex((m) => lower.includes(m));
  //       return { key: k, year: Number.isFinite(year) ? year : null, monthIdx: monthIdx >= 0 ? monthIdx : null, idx };
  //     });

  //     parsed.sort((a, b) => {
  //       // both have years
  //       if (a.year !== null && b.year !== null) {
  //         if (a.year !== b.year) return a.year - b.year;
  //         // same year: compare months if both available
  //         if (a.monthIdx !== null && b.monthIdx !== null) return a.monthIdx - b.monthIdx;
  //         if (a.monthIdx !== null) return -1; // a has month, b doesn't -> a first
  //         if (b.monthIdx !== null) return 1;
  //         return a.idx - b.idx; // stable fallback
  //       }

  //       // one has year -> it goes first
  //       if (a.year !== null) return -1;
  //       if (b.year !== null) return 1;

  //       // neither has year -> try months only
  //       if (a.monthIdx !== null && b.monthIdx !== null) return a.monthIdx - b.monthIdx;
  //       if (a.monthIdx !== null) return -1;
  //       if (b.monthIdx !== null) return 1;

  //       // final stable fallback
  //       return a.idx - b.idx;
  //     });

  //     return parsed.map((p) => p.key);
  //   } catch (err) {
  //     // parsing error, fallback to raw keys
  //     console.error("Failed to parse metrics from localStorage:", err);
  //     return Object.keys(JSON.parse(localStorage.getItem("metrics") || "{}"));
  //   }
  // };

  // const hasIssues = Object.values(workflowMetrics).some(
  //   (m: any) => (m.missing ?? 0) > 0 || (m.error ?? 0) > 0 || (m.duplicate ?? 0) > 0
  // );
  // console.log('hasIssues: ', hasIssues, getSortedMetricKeys)
  return (
    <div>
      {showConfirmModal && (
              <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm bg-white/30 z-50">
                <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-8 w-[36rem] max-w-[90%]">
                  <h2 className="text-lg font-semibold mb-3">
                    Proceed to data consolidation?
                  </h2>
                  <p className="text-sm text-gray-600 mb-5">
                    Some records still contain{" "}
                    <span className="font-medium">missing data</span>,{" "}
                    <span className="font-medium">errors</span>, or{" "}
                    <span className="font-medium">duplicate</span> status that have
                    been detected.
                  </p>

                  <div className="max-h-64 overflow-y-auto border rounded-md p-3 mb-5 bg-gray-50">
                    {Object.keys(workflowMetrics).length === 0 && (
                      <div className="text-sm text-gray-600">No issues detected.</div>
                    )}
                    {Object.entries(workflowMetrics).map(([key, val]: any) => (
                      <div
                        key={key}
                        className="text-sm py-1 border-b last:border-b-0"
                      >
                        <strong>{key}</strong>: missing {val.missing ?? "N/A"}, error{" "}
                        {val.error ?? "N/A"}, duplicate {val.duplicate ?? "N/A"}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowConfirmModal(false)}
                      className="bg-gray-200 hover:bg-gray-300 cursor-pointer shadow-md font-normal px-4 py-1 rounded-lg inline-flex items-center justify-center"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        setShowConfirmModal(false);
                        setStepsCompletionStatus((prev: any) =>
                          prev?.map((step: any, idx: number) =>
                            idx === currentStep ? { ...step, completed: true } : step
                          )
                        );
                        setCurrentStepRedux(currentStep + 1);
                        setConsolidationSubStep(0);
                      }}
                     // disabled={hasIssues} uncomment if need to block continue when issues exist
                      className="bg-[#fce404] cursor-pointer shadow-md font-normal px-4 py-1 rounded-lg inline-flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Continue
                      <ChevronRightIcon className="w-5 h-5 font-bold mt-0.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

      <div className="flex flex-row items-start justify-between gap-1 bg-[#f8f8f8] px-4 py-2 sticky top-0 z-20">
        <div className="mt-1">
          <button
            onClick={() => {
              dispatch(resetStateNavUIState());
              // dispatch(resetPdTransitionMatrixWfHelperData());
              dispatch(resetPdMatrixWfHelperData());
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
            onStepClick={(index) => setCurrentStepRedux(index)}
          />
        )}
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
