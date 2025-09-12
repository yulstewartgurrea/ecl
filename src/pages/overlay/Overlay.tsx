import { useState } from 'react';
import OverlayDevelopmentStep1 from './development/Development';
import OverlayExecutionStep1 from './execution/steps/Step1';
import Stepper from '../../components/stepper/Stepper';

const OverlayLandingPage = () => {
  const [activeStep, setActiveStep] = useState(0);
  
  const steps = [
    { label: "Development", completed: false },
    { label: "Execution", completed: false },
  ];

  const handleStepChange = (targetIndex: number) => {
    setActiveStep(targetIndex);
  };

  const renderStepComponent = () => {
    switch (activeStep) {
      case 0:
        return <OverlayDevelopmentStep1 />;
      case 1:
        return <OverlayExecutionStep1 />;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="flex flex-row items-start justify-between gap-1 bg-[#f8f8f8] px-4 py-2 sticky top-0 z-20">
        <Stepper
          steps={steps}
          activeStep={activeStep}
          onApprovedStepChange={handleStepChange}
          canContinue={true}
        />
      </div>

      <div className="w-full flex flex-row p-2">
        <div className="w-full min-h-[750px] bg-white p-4 shadow-md rounded">
          {renderStepComponent()}
        </div>
      </div>
    </div>
  );
};

export default OverlayLandingPage;
