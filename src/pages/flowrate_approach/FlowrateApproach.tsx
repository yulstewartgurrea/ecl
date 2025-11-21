// ==========================
// pages/flowrate/FlowrateApproachPage.tsx
// ==========================
import { useEffect, useState } from "react";
import Stepper from "../../components/stepper/Stepper";
import Step1 from "./steps/Step1";
import Step4 from "./steps/Step4";
import Step5 from "./steps/Step5";
import Step6 from "./steps/Step6";

import { useAppDispatch, useAppSelector } from "../../redux_toolkit/hooks";
import type { RootState } from "../../redux_toolkit/store";
import {
  setPdTransitionMatrixCurrentStep,
} from "../../redux_toolkit/features/probability_of_default/transition_matrix/pdTransitionMatrixWfHelper";

const FlowrateApproachPage = () => {
  const dispatch = useAppDispatch();

  // read current step from Redux (default to 0)
  const currentStep = useAppSelector(
    (state: RootState) => state.pdTransitionMatrixWfHelper.currentStep ?? 0
  );

  const [activeSubStep, setActiveSubStep] = useState<number>(currentStep);

  // keep local state in sync if Redux changes (e.g. restored workflow)
  useEffect(() => {
    setActiveSubStep(currentStep);
  }, [currentStep]);

  const developmentSteps = [
    { label: "Inputs", completed: false },
    { label: "Flowrate Approach", completed: false },
    { label: "Credit Loss Rate Approach", completed: false },
    { label: "Output", completed: false },
  ];

  const commitStepChange = (targetIndex: number) => {
    setActiveSubStep(targetIndex);
    // persist step in Redux so when you come back from the landing page
    // it re-opens on the same step
    dispatch(setPdTransitionMatrixCurrentStep({ step: targetIndex }));
  };

  const renderSubStepContent = () => {
    switch (activeSubStep) {
      case 0:
        return <Step1 />;
      case 1:
        return <Step4 />;
      case 2:
        return <Step5 />;
      case 3:
        return <Step6 />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 ">
        <div className="mx-auto px-6 py-4 flex items-center justify-between bg-white">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              Flowrate Approach
            </h1>
            <p className="text-xs text-gray-800">
              A structured and dynamic framework for estimating credit losses.
            </p>
          </div>
        </div>
      </header>

      <div className="flex flex-row items-start justify-between px-4 py-2 sticky top-16 z-30 bg-white">
        <Stepper
          steps={developmentSteps}
          activeStep={activeSubStep}
          onApprovedStepChange={commitStepChange}
          canContinue={true}
        />
      </div>

      <div className="mx-auto lg:px-4 ">
        {renderSubStepContent()}
      </div>
    </div>
  );
};

export default FlowrateApproachPage;
