import {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import clsx from "clsx";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

export type Step = { label: string; completed: boolean };

export type IssueMetrics = Record<
  string,
  { missing?: number; error?: number; duplicate?: number }
>;

export type StepperHandle = {
  /** Request a step change; Stepper will gate & show modal if needed */
  attemptStepChange: (targetIndex: number) => void;
};

type StepperProps = {
  steps: Step[];
  activeStep: number;

  /** Called ONLY after user confirms in modal (or when not gated) */
  onApprovedStepChange?: (targetIndex: number) => void;

  /** Metrics to display inside the modal */
  workflowMetrics?: IssueMetrics;

  /** Show a green “ready” segment from current -> next step */
  canContinue?: boolean;

  /** Which step index requires confirm when leaving forward (default: 1 = Step 2) */
  gateFromIndex?: number;

  /** Show modal only if metrics have issues (default: true) */
  onlyWhenIssues?: boolean;

  /** Optional: visual-only side-effects on step click (tooltip, hover etc.) */
  onStepClickVisualOnly?: (index: number) => void;
};

const Stepper = forwardRef<StepperHandle, StepperProps>(function Stepper(
  {
    steps,
    activeStep,
    onApprovedStepChange = () => {}, // no-op default to avoid crashes
    workflowMetrics,
    canContinue = false,
    gateFromIndex = 1,
    onlyWhenIssues = true,
    onStepClickVisualOnly,
  },
  ref
) {
  const segments = Math.max(steps.length - 1, 1);
  const progress = steps.length > 1 ? (activeStep / segments) * 100 : 0;
  const showGreen = canContinue && activeStep < steps.length - 1;
  const greenWidth = showGreen ? (1 / segments) * 100 : 0;

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<number | null>(null);

  const hasIssues = useMemo(() => {
    if (!workflowMetrics) return false;
    return Object.values(workflowMetrics).some((m: any) => {
      const missing = Number(m?.missing ?? 0);
      const error = Number(m?.error ?? 0);
      const duplicate = Number(m?.duplicate ?? 0);
      return missing > 0 || error > 0 || duplicate > 0;
    });
  }, [workflowMetrics]);

  const shouldGate = (from: number, to: number) => {
    const forward = to > from;
    const leavingGated = from === gateFromIndex && to >= gateFromIndex + 1;
    if (!forward || !leavingGated) return false;
    return onlyWhenIssues ? hasIssues : true;
  };

  const commit = (target: number) => {
    if (typeof onApprovedStepChange === "function") {
      onApprovedStepChange(target);
    } else {
      // dev safety
       
      console.warn("Stepper: onApprovedStepChange was not provided.");
    }
  };

  const attemptStepChange = (target: number) => {
    const clamped = Math.max(0, Math.min(target, steps.length - 1));
    if (shouldGate(activeStep, clamped)) {
      setPendingTarget(clamped);
      setShowConfirm(true);
    } else {
      commit(clamped);
    }
  };

  useImperativeHandle(ref, () => ({ attemptStepChange }));

  const handleStepClick = (index: number) => {
    onStepClickVisualOnly?.(index);
    attemptStepChange(index);
  };

  const handleConfirm = () => {
    if (pendingTarget == null) return;
    const next = pendingTarget;
    setShowConfirm(false);
    setPendingTarget(null);
    commit(next);
  };

  return (
    <div className="relative w-full">
      {/* Track */}
      <div className="absolute top-2 left-0 w-full">
        <div className="relative h-1 bg-gray-300 rounded overflow-hidden">
          {/* Completed (yellow) */}
          <div
            className="absolute inset-y-0 left-0 bg-yellow-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
          {/* Ready (green) */}
          {showGreen && (
            <div
              className={clsx(
                "absolute inset-y-0 bg-green-500 z-10 transition-all duration-300 animate-pulse",
                "min-w-[8px]"
              )}
              style={{ left: `${progress}%`, width: `${greenWidth}%` }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="flex justify-between relative mt-6">
        {steps.map((step, index) => {
          const isActive = index === activeStep;
          const isCompleted = index < activeStep || step.completed;
          const isNext = index === activeStep + 1;

          return (
            <button
              key={index}
              type="button"
              title={`Go to ${step.label}`}
              aria-current={isActive ? "step" : undefined}
              className={clsx(
                "group flex flex-col items-center w-full focus:outline-none cursor-pointer",
                "transition-transform hover:-translate-y-0.5"
              )}
              onClick={() => handleStepClick(index)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleStepClick(index);
                }
              }}
            >
              <div
                className={clsx(
                  "w-9 h-9 flex items-center justify-center rounded-md border text-sm font-bold transition-all",
                  isCompleted &&
                    "bg-yellow-500 text-white border-yellow-500 group-hover:ring-2 group-hover:ring-yellow-400",
                  !isCompleted &&
                    !isActive &&
                    "bg-gray-200 text-gray-600 border-gray-300 group-hover:ring-2 group-hover:ring-gray-300",
                  isActive &&
                    "bg-white text-yellow-700 border-yellow-500 ring-2 ring-yellow-500",
                  isNext && "ring-2 ring-yellow-400 animate-pulse"
                )}
              >
                {index + 1}
              </div>

              <span
                className={clsx(
                  "mt-2 text-xs font-medium text-center whitespace-nowrap",
                  isCompleted || isActive ? "text-black" : "text-gray-400"
                )}
              >
                {step.label}
              </span>

              {isNext && (
                <span className="mt-1 text-[10px] text-yellow-600 italic">
                  Click to continue
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Confirm Modal */}
      {showConfirm && (
        <div className="fixed inset-0 flex items-center justify-center backdrop-blur-sm bg-white/30 z-50">
          <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-8 w-[36rem] max-w-[90%]">
            <h2 className="text-lg font-semibold mb-3">
              Proceed to data consolidation?
            </h2>
            <p className="text-sm text-gray-600 mb-5">
              Some records still contain{" "}
              <span className="font-medium">missing data</span>,{" "}
              <span className="font-medium">errors</span>, or{" "}
              <span className="font-medium">duplicates</span>.
            </p>

            <div className="max-h-64 overflow-y-auto border rounded-md p-3 mb-5 bg-gray-50">
              {!workflowMetrics || Object.keys(workflowMetrics).length === 0 ? (
                <div className="text-sm text-gray-600">No issues detected.</div>
              ) : (
                Object.entries(workflowMetrics).map(([key, val]: any) => (
                  <div key={key} className="text-sm py-1 border-b last:border-b-0">
                    <strong>{key}</strong>: missing {val?.missing ?? "N/A"}, error{" "}
                    {val?.error ?? "N/A"}, duplicate {val?.duplicate ?? "N/A"}
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowConfirm(false);
                  setPendingTarget(null);
                }}
                className="bg-gray-200 hover:bg-gray-300 cursor-pointer shadow-md font-normal px-4 py-1 rounded-lg inline-flex items-center justify-center"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="bg-[#fce404] cursor-pointer shadow-md font-normal px-4 py-1 rounded-lg inline-flex items-center justify-center"
              >
                Continue
                <ChevronRightIcon className="w-5 h-5 font-bold mt-0.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default Stepper;
