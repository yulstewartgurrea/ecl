// ==========================
// pages/flowrate/FlowrateApproachPage.tsx (UPDATED background)
// ==========================
import { useState } from "react";
import Stepper from "../../components/stepper/Stepper";
import Step1 from "./steps/Step1";
import Step4 from "./steps/Step4";
import Step5 from "./steps/Step5";
import Step6 from "./steps/Step6";

const FlowrateApproachPage = () => {
  const [activeSubStep, setActiveSubStep] = useState(0);

  const developmentSteps = [
    { label: "Inputs", completed: false },
    { label: "Flowrate Approach", completed: false },
    { label: "Credit Loss Rate Approach", completed: false },
    { label: "Output", completed: false },
  ];

  const handleSubStepChange = (targetIndex: number) => setActiveSubStep(targetIndex);

  const renderSubStepContent = () => {
    switch (activeSubStep) {
      case 0: return <Step1 />;
      case 1: return <Step4 />;
      case 2: return <Step5 />;
      case 3: return <Step6 />;
      default: return null;
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 ">
        <div className="mx-auto px-6 py-4 flex items-center justify-between bg-white">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Flowrate Approach</h1>
            <p className="text-xs text-gray-800">A structured and dynamic framework for estimating credit losses.</p>
          </div>
        </div>
      </header>

      <div className="flex flex-row items-start justify-between px-4 py-2 sticky top-16 z-30 bg-white">
        <Stepper steps={developmentSteps} activeStep={activeSubStep} onApprovedStepChange={handleSubStepChange} canContinue={true} />
      </div>

      <div className="mx-auto lg:px-4 ">
        {renderSubStepContent()}
      </div>
    </div>
  );
};

export default FlowrateApproachPage;
