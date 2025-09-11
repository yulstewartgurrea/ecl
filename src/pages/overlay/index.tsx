import React, { useState } from 'react';
import OverlayDevelopmentStep1 from './development/steps/Step1';
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
    };
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Main Content */}
      <main className="bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stepper Component */}
          <div className="mb-8">
            <Stepper
              steps={steps}
              activeStep={activeStep}
              onApprovedStepChange={handleStepChange}
              canContinue={true}
            />
          </div>
          
          {/* Step Content */}
          { renderStepComponent() }
        </div>
      </main>

    </div>
  );
};

export default OverlayLandingPage;
