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
  backLabel = "Back",
  continueLabel = "Continue",
  hideBackButton = false,
}: StepNavigationProps) => {
  return (
    <div className="w-full flex flex-row justify-between gap-4">
      <div className="inline-flex gap-2">
        <span className="font-bold text-nowrap">{`${descriptionTitle? `${descriptionTitle}: `: ""}`}</span>
        <div className="italic">{description}</div>
      </div>

      <div className="inline-flex items-center justify-center gap-4">
        <button
          onClick={onBack}
          className={clsx(
            "disabled:bg-[#b4b4b4]/40 bg-[#b4b4b4] cursor-pointer shadow-md font-bold px-4 py-1 rounded-lg  items-center justify-center disabled:cursor-not-allowed",
            {
              hidden: hideBackButton,
              "inline-flex": !hideBackButton,
            }
          )}
          disabled={currentStep === 0}
        >
          <ChevronLeftIcon className="w-5 h-5 font-bold mt-0.5" />
          {backLabel}
        </button>

        <div className="flex justify-between">
          {currentStep < totalSteps - 1 ? (
            <button
              onClick={onContinue}
              className="bg-[#fce404] max-w-60 text-nowrap cursor-pointer shadow-md font-bold px-4 py-1 rounded-lg inline-flex items-center justify-center"
            >
              {continueLabel}
              <ChevronRightIcon className="w-5 h-5 font-bold mt-0.5" />
            </button>
          ) : (
            <button
              onClick={onFinish}
              className="bg-[#fce404] cursor-pointer shadow-md font-bold px-4 py-1 rounded-lg inline-flex items-center justify-center"
            >
              {continueLabel}
              <ChevronRightIcon className="w-5 h-5 font-bold mt-0.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StepNavigation;
