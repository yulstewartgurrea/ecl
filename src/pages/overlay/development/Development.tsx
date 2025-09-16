import { useState } from 'react';
import Stepper from '../../../components/stepper/Stepper';
import Step1 from './steps/Step1';
import Step2 from './steps/Step2';
import Step3 from './steps/Step3';
import Step4 from './steps/Step4';
import Step5 from './steps/Step5';
import Step6 from './steps/Step6';
import Step7 from './steps/Step7';

const OverlayDevelopmentStep1 = () => {
  const [activeSubStep, setActiveSubStep] = useState(0);
  
  const developmentSteps = [
    { label: "Inputs", completed: false },
    { label: "Interpolation", completed: false },
    { label: "Data Transformation", completed: false },
    { label: "Multi Factor Analysis", completed: false },
    { label: "Filtering of Models", completed: false },
    { label: "Candidate Models", completed: false },
    { label: "Final Model", completed: false },
  ];

  const handleSubStepChange = (targetIndex: number) => {
    setActiveSubStep(targetIndex);
  };

  const renderSubStepContent = () => {
    switch (activeSubStep) {
      case 0:
        return <Step1 />;
      case 1:
        return <Step2 />;
      case 2:
        return <Step3 />;
      case 3:
        return <Step4 />;
      case 4:
        return <Step5 />;
      case 5:
        return <Step6 />;
      case 6:
        return <Step7 />;
      default:
        return null;
    }
  };

  return (
    <div className="w-full min-h-screen bg-gray-50">
      {/* Development Sub-Stepper */}
      <div className="flex flex-row items-start justify-between gap-1 bg-[#f8f8f8] px-4 py-2 sticky top-0 z-20">
        <Stepper
          steps={developmentSteps}
          activeStep={activeSubStep}
          onApprovedStepChange={handleSubStepChange}
          canContinue={true}
        />
      </div>

      {/* Development Content */}
      <div className="max-w-7xl mx-auto lg:px-4 py-8">
        {renderSubStepContent()}
      </div>
    </div>
  );
};

export default OverlayDevelopmentStep1;
