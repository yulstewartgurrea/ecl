// import React from "react";
// import clsx from "clsx";

// type Step = {
//   label: string;
//   completed: boolean;
// };

// type StepperProps = {
//   steps: Step[];
//   activeStep: number;
//   onStepClick?: (index: number) => void;
// };

// const Stepper: React.FC<StepperProps> = ({
//   steps,
//   activeStep,
//   onStepClick,
// }) => {

//   if (!steps || steps.length === 0) return <>No stepper found</>;

//   return (
//     <div className="mt-2 relative w-full flex flex-row items-center py-1 flex-wrap gap-2 justify-between md:flex-nowrap">
//       {steps.map((step, index) => {
//         const isCurrent = index === activeStep;
//         const isCompleted = step.completed;
//         const isFuture = !isCompleted && !isCurrent;
//         const canClick = isCompleted || isCurrent;

//         return (
//           <div key={index} className="relative flex-1 flex flex-col items-center">
//             {/* Connector line */}
//             {index !== 0 && (
//               <div
//                 className={clsx(
//                   "absolute top-4 -left-1/2 w-full h-1 z-0",
//                   steps[index - 1].completed && (step.completed || activeStep === index)
//                     ? "bg-yellow-600"
//                     : "bg-gray-200"
//                 )}
//               />
//             )}

//             {/* Step Circle */}
//             <div
//               onClick={() => canClick && onStepClick?.(index)}
//               className={clsx(
//                 "z-10 flex flex-col items-center",
//                 canClick ? "cursor-pointer" : "cursor-default"
//               )}
//             >
//                <div
//                 className={clsx(
//                   "w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition-all duration-200 ease-in-out transform",
//                   {
//                     "scale-110": isCurrent,
//                     "bg-yellow-200 text-gray-600": isCompleted && !isCurrent,
//                     "bg-gray-300 border-2 text-gray-600 border-yellow-500": isCurrent && isCompleted,
//                     "bg-purple-50 border-2 border-yellow-500 text-gray-500": isCurrent && !isCompleted,
//                     "bg-gray-200 text-gray-400 border-2 border-gray-500 cursor-not-allowed": isFuture,
//                   }
//                 )}
//               >
//                 {index + 1}
//               </div>

//               <div className={clsx("text-xs mt-2 leading-tight min-h-[2.5rem] max-w-[5rem] text-center whitespace-normal break-words")}>
//                 {step.label}
//               </div>
//             </div>

//           </div>
//         );
//       })}
//     </div>
//   );
// };

// export default Stepper;


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
    <div className="mt-2 relative w-full flex flex-row items-center py-1 flex-wrap gap-2 justify-between md:flex-nowrap">
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
                  "absolute top-4 -left-1/2 w-full h-1 z-0",
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
                  "w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition-all duration-200 ease-in-out transform",
                  {
                    "scale-110": isCurrent,
                    "bg-yellow-200 text-gray-600": isCompleted && !isCurrent,
                    "bg-gray-300 text-gray-600 border-yellow-500": isCurrent && isCompleted,
                    "bg-purple-50 text-gray-500": isCurrent && !isCompleted,
                    "bg-gray-200 text-gray-400 border-2 border-gray-500 cursor-not-allowed": isFuture,
                    // Add these new classes for the animated border
                    // "animated-border border-yellow-500": isCurrent,
                    "moderate-pulse border-yellow-500": isCurrent,
                    // "strong-pulse border-yellow-500": isCurrent,                    
                  }
                )}
              >
                {index + 1}
              </div>
              {/* <div
                className={clsx(
                  "w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs transition-all duration-200 ease-in-out transform relative",
                  {
                    "scale-110": isCurrent,
                    "bg-yellow-200 text-gray-600": isCompleted && !isCurrent,
                    "bg-gray-300 text-gray-600": isCurrent && isCompleted,
                    "bg-purple-50 text-gray-500": isCurrent && !isCompleted,
                    "bg-gray-200 text-gray-400 border-2 border-gray-500 cursor-not-allowed": isFuture,
                    // Enhanced animated border
                    "border-2": isCurrent,
                  }
                )}
              >
         
                <span className="relative z-10">{index + 1}</span>
                
                {isCurrent && (
                  <span className={clsx(
                    "absolute inset-0 rounded-xl border-2",
                    "animated-border border-yellow-500"
                  )}></span>
                )}
              </div>               */}

              <div className={clsx("text-xs mt-2 leading-tight min-h-[2.5rem] max-w-[5rem] text-center whitespace-normal break-words")}>
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