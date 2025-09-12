import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useAppDispatch, useAppSelector } from "../../redux_toolkit/hooks";
import type { RootState } from "../../redux_toolkit/store";
import { setPdTransitionMatrixCurrentStep } from "../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";

type StepNavigationProps = {
  currentStep: number;
  totalSteps: number;
  descriptionTitle: string;
  description: string;
  onBack: () => void;
  onContinue: () => void;   // keep if you need side-effects; do NOT increment step here anymore
  onFinish: () => void;
  backLabel?: string;
  continueLabel?: string;
  hideBackButton?: boolean;
};

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

const StepNavigation = ({
  currentStep,
  totalSteps,
  descriptionTitle,
  description,
  // onBack,
  onContinue,
  onFinish,
  backLabel = "Previous",
  continueLabel = "Continue",
  hideBackButton = false,
}: StepNavigationProps) => {
  const dispatch = useAppDispatch();

  // --- Get context first ---
  const {
    selectedPdTransitionMatrixEntity: entity,
    selectedPdTransitionMatrixReportingPeriod: period,
    pdTransitionMatrixWfName: workflowName,
  } = useSelector((state: RootState) => state.pdTransitionMatrixWfHelper);

  const directoryPath = `/${entity}/${period}/${workflowName}`;

  // Now it's safe to read metrics using directoryPath
  const workflowMetrics = useAppSelector(
    (state: RootState) => state.pdMatrixWfHelper.workflowMetrics[directoryPath] || {}
  );

  // const hasIssues = Object.values(workflowMetrics ?? {}).some((m: any) =>
  //   (m?.missing ?? 0) > 0 || (m?.error ?? 0) > 0 || (m?.duplicate ?? 0) > 0
  // );

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<number | null>(null);

  const [stepsCompletionStatus, setStepsCompletionStatus] = useState<
    { label: string; completed: boolean }[] | null
  >(null);

  useEffect(() => {
    if (!stepsCompletionStatus) {
      setStepsCompletionStatus(
        stepLabels.map((label) => ({ label, completed: false }))
      );
    }
  }, [stepsCompletionStatus]);

  const setCurrentStepRedux = (step: number) => {
    dispatch(setPdTransitionMatrixCurrentStep({ step }));
  };

  // Gate leaving Step 2 (index 1). If you want to show modal only when issues exist, add && hasIssues.
  const shouldConfirm = (from: number, to: number) => {
    const forward = to > from;
    const leavingStep2 = from === 1 && to >= 2;
    return forward && leavingStep2 /* && hasIssues */;
  };

  const attemptStepChange = (target: number) => {
    const clamped = Math.max(0, Math.min(target, totalSteps - 1));
    if (shouldConfirm(currentStep, clamped)) {
      setPendingTarget(clamped);
      setShowConfirmModal(true);
      return;
    }
    // Commit navigation immediately
    setStepsCompletionStatus((prev) =>
      prev?.map((s, idx) => (idx === currentStep ? { ...s, completed: true } : s)) ?? prev
    );
    setCurrentStepRedux(clamped);
  };

  const handleBack = () => attemptStepChange(currentStep - 1);
  const handleContinue = () => attemptStepChange(currentStep + 1);

  const handleModalConfirm = () => {
    const next = pendingTarget ?? currentStep + 1;
    setShowConfirmModal(false);
    setPendingTarget(null);

    setStepsCompletionStatus((prev) =>
      prev?.map((s, idx) => (idx === currentStep ? { ...s, completed: true } : s)) ?? prev
    );
    setCurrentStepRedux(next);

    // Optional: fire side-effects
    onContinue?.();
  };

  return (
    <div className="w-full flex flex-row justify-between items-center gap-4 p-2 bg-gray-50 rounded-lg shadow-sm mb-4">
      {/* Description */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 text-gray-700">
        {descriptionTitle && <span className="font-semibold">{descriptionTitle}:</span>}
        <span className="italic text-gray-500">{description}</span>
      </div>

      <div className="flex items-center gap-3 flex-nowrap">
        {/* Confirm modal */}
        {showConfirmModal && (
          <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm bg-white/30 z-50">
            <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-8 w-[36rem] max-w-[90%]">
              <h2 className="text-lg font-semibold mb-3">
                Proceed to data consolidation?
              </h2>
              <p className="text-sm text-gray-600 mb-5">
                Some records still contain <span className="font-medium">missing data</span>,{" "}
                <span className="font-medium">errors</span>, or{" "}
                <span className="font-medium">duplicates</span>.
              </p>

              <div className="max-h-64 overflow-y-auto border rounded-md p-3 mb-5 bg-gray-50">
                {Object.keys(workflowMetrics).length === 0 && (
                  <div className="text-sm text-gray-600">No issues detected.</div>
                )}
                {Object.entries(workflowMetrics).map(([key, val]: any) => (
                  <div key={key} className="text-sm py-1 border-b last:border-b-0">
                    <strong>{key}</strong>: missing {val.missing ?? "N/A"}, error {val.error ?? "N/A"}, duplicate {val.duplicate ?? "N/A"}
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => { setShowConfirmModal(false); setPendingTarget(null); }}
                  className="bg-gray-200 hover:bg-gray-300 cursor-pointer shadow-md font-normal px-4 py-1 rounded-lg inline-flex items-center justify-center"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModalConfirm}
                  className="bg-[#fce404] cursor-pointer shadow-md font-normal px-4 py-1 rounded-lg inline-flex items-center justify-center"
                >
                  Continue
                  <ChevronRightIcon className="w-5 h-5 font-bold mt-0.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {!hideBackButton && (
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            className={clsx(
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap",
              "bg-gray-100 text-gray-700 border border-gray-200 shadow-sm",
              "hover:bg-gray-200 hover:text-blue-700",
              "focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <ChevronLeftIcon className="w-5 h-5 shrink-0" />
            <span className="whitespace-nowrap">{backLabel}</span>
          </button>
        )}

        {currentStep < totalSteps - 1 ? (
          <button
            onClick={handleContinue}
            className={clsx(
              "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap",
              "bg-gray-100 text-gray-700 border border-gray-200 shadow-sm",
              "hover:bg-yellow-50 hover:text-yellow-700",
              "focus:outline-none focus:ring-2 focus:ring-yellow-300"
            )}
          >
            <span className="whitespace-nowrap">{continueLabel}</span>
            <ChevronRightIcon className="w-5 h-5 shrink-0" />
          </button>
        ) : (
          <button
            onClick={onFinish}
            className={clsx(
              "inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap",
              "bg-gray-100 text-gray-700 border border-gray-200 shadow-sm",
              "hover:bg-yellow-700 hover:text-white",
              "focus:outline-none focus:ring-2 focus:ring-yellow-300"
            )}
          >
            <span className="whitespace-nowrap">{continueLabel}</span>
            <ChevronRightIcon className="w-5 h-5 shrink-0" />
          </button>
        )}
      </div>
    </div>
  );
};

export default StepNavigation;
