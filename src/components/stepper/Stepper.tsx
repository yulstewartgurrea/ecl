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
  return (
    <div className="relative w-full">
      {/* Top Line */}
      <div className="absolute top-2 left-0 w-full h-1 bg-gray-300">
        <div
          className="h-0.5 bg-yellow-500 transition-all duration-300"
          style={{ width: `${(activeStep / (steps.length - 1)) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <div className="flex justify-between relative mt-6">
        {steps.map((step, index) => (
          <div
            key={index}
            className="flex flex-col items-center w-full cursor-pointer"
            onClick={() => onStepClick?.(index)}
          >
            {/* Rectangle Step */}
            <div
              className={clsx(
                "w-8 h-8 flex items-center justify-center rounded-md border text-sm font-bold",
                index <= activeStep
                  ? "bg-yellow-500 text-white border-yellow-500"
                  : "bg-gray-200 text-gray-600 border-gray-300"
              )}
            >
              {index + 1}
            </div>

            {/* Label */}
            <span
              className={clsx(
                "mt-2 text-xs font-medium text-center",
                index <= activeStep ? "text-black" : "text-gray-400"
              )}
            >
              {step.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Stepper;
