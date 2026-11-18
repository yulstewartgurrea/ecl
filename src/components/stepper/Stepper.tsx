import { forwardRef, useImperativeHandle } from "react";
import clsx from "clsx";

/** `label` is kept for page headings; the stepper itself shows a generic "Process N" name. */
export type Step = { label: string; completed: boolean };

export type StepperHandle = {
  /** Go to a step (clamped to the valid range). */
  attemptStepChange: (targetIndex: number) => void;
};

type StepperProps = {
  steps: Step[];
  activeStep: number;

  /** Called when the user picks a step. Any step can be selected. */
  onApprovedStepChange?: (targetIndex: number) => void;

  /** Show a green ready segment from current -> next step */
  canContinue?: boolean;
};

const Stepper = forwardRef<StepperHandle, StepperProps>(function Stepper(
  {
    steps,
    activeStep,
    onApprovedStepChange = () => {}, // no-op default to avoid crashes
    canContinue = false,
  },
  ref
) {
  const segments = Math.max(steps.length - 1, 1);
  const progress = steps.length > 1 ? (activeStep / segments) * 100 : 0;
  const showGreen = canContinue && activeStep < steps.length - 1;
  const greenWidth = showGreen ? (1 / segments) * 100 : 0;

  const attemptStepChange = (target: number) => {
    const clamped = Math.max(0, Math.min(target, steps.length - 1));
    onApprovedStepChange(clamped);
  };

  useImperativeHandle(ref, () => ({ attemptStepChange }));

  const handleStepClick = (index: number) => attemptStepChange(index);

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
          const name = `Process ${index + 1}`;

          return (
            <button
              key={index}
              type="button"
              title={`Go to ${name}`}
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
                  "mt-2 text-xs font-medium text-center truncate max-w-[120px] block",
                  isCompleted || isActive ? "text-black" : "text-gray-400"
                )}
                title={name}
              >
                {name}
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
    </div>
  );
});

export default Stepper;

