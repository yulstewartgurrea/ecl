import React from "react";
import clsx from "clsx";

type Step = {
  label: string;
  completed: boolean;
};

type StepperProps = {
  steps: Step[];
  activeStep: number;
  onStepClick?: (index: number) => void;
};

const Stepper: React.FC<StepperProps> = ({
  steps,
  activeStep,
  onStepClick,
}) => {

  if (!steps || steps.length === 0) return <>No stepper found</>;

  return (
    <div className="mt-2 relative w-full flex flex-row items-center py-2 flex-wrap gap-2 justify-between md:flex-nowrap">
      {steps.map((step, index) => {
        const isCurrent = index === activeStep;
        const isCompleted = step.completed;
        const isFuture = !isCompleted && !isCurrent;
        const canClick = isCompleted || isCurrent;

        return (
          <div key={index} className="relative flex-1 flex flex-col items-center">
            {/* Connector line */}
            {index !== 0 && (
              <div
                className={clsx(
                  "absolute top-5 -left-1/2 w-full h-1 z-0",
                  steps[index - 1].completed && (step.completed || activeStep === index)
                    ? "bg-yellow-600"
                    : "bg-gray-200"
                )}
              />
            )}

            {/* Step Circle */}
            <div
              onClick={() => canClick && onStepClick?.(index)}
              className={clsx(
                "z-10 flex flex-col items-center",
                canClick ? "cursor-pointer" : "cursor-default"
              )}
            >
              <div
                className={clsx(
                  "w-10 h-10 rounded-2xl flex items-center justify-center font-bold transition-all",
                  {
                    "bg-yellow-200 text-gray-600": isCompleted,
                    "bg-gray-300 border-2 text-gray-600 border-yellow-500":
                      isCurrent && isCompleted,
                    "bg-purple-50 border-2  border-yellow-500 text-gray-500":
                      isCurrent && !isCompleted,
                    "bg-gray-200 text-gray-400 border-2 border-gray-500 cursor-not-allowed":
                      isFuture,
                  }
                )}
              >
                {index + 1}
              </div>

              <div className={clsx("text-xs  mt-2 leading-tight min-h-[2.5rem] max-w-[5rem] text-center whitespace-normal break-words")}>
                {step.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Stepper;






