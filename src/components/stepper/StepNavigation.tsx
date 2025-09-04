import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

type StepNavigationProps = {
  currentStep: number;
  totalSteps: number;
  descriptionTitle: string;
  description: string;
  onBack: () => void;
  onContinue: () => void;
  onFinish: () => void;
  backLabel?: string;
  continueLabel?: string;
  hideBackButton?: boolean;
};

const StepNavigation = ({
  currentStep,
  totalSteps,
  descriptionTitle,
  description,
  onBack,
  onContinue,
  onFinish,
  backLabel = "Previous",
  continueLabel = "Continue",
  hideBackButton = false,
}: StepNavigationProps) => {
  return (
    <div className="w-full flex flex-row justify-between items-center gap-4 p-2 bg-gray-50 rounded-lg shadow-sm mb-4">
      {/* Description (can wrap) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 text-gray-700">
        {descriptionTitle && <span className="font-semibold">{descriptionTitle}:</span>}
        <span className="italic text-gray-500">{description}</span>
      </div>

      {/* Buttons (never wrap) */}
      <div className="flex items-center gap-3 flex-nowrap">
        {!hideBackButton && (
          <button
            onClick={onBack}
            disabled={currentStep === 0}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200",
              "bg-gray-200 hover:bg-gray-300 shadow focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <ChevronLeftIcon className="w-5 h-5" />
            {backLabel}
          </button>
        )}

    {currentStep < totalSteps - 1 ? (
      <button
        onClick={onContinue}
        className="flex items-center gap-2 px-3 py-2 rounded-lg font-semibold bg-gradient-to-br cursor-pointer from-yellow-400 to-yellow-300 hover:from-yellow-500 hover:to-yellow-400 text-gray-900 shadow-lg transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-300 whitespace-nowrap"
      >
        {continueLabel}
        <ChevronRightIcon className="w-5 h-5" />
      </button>
    ) : (
      <button
        onClick={onFinish}
        className="flex items-center gap-2 px-3 py-2 rounded-lg font-semibold bg-gradient-to-br cursor-pointer from-yellow-500 to-yellow-400 hover:from-yellow-600 hover:to-yellow-500 text-gray-900 shadow-lg transform hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-yellow-300 whitespace-nowrap"
      >
        {continueLabel}
        <ChevronRightIcon className="w-5 h-5" />
      </button>
    )}
      </div>
    </div>
  );
};

export default StepNavigation;
