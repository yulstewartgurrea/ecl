import { useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import OverlayDevelopmentStep1 from './development/Development';
import OverlayExecutionStep1 from './execution/steps/Step1';

const OverlayLandingPage = () => {
  const [activeStep, setActiveStep] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const steps = [
    { label: "Development", completed: false },
    { label: "Execution", completed: false },
  ];

  const handleStepChange = (targetIndex: number) => {
    setActiveStep(targetIndex);
    setIsDropdownOpen(false);
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
      {/* Header with Dropdown */}
      <div className="bg-white px-6 py-4">
        <div className="flex flex-col ">
          {/* Main Header */}
          {/* add title overlay here */}
          <h1 className="text-3xl font-bold text-gray-800">Overlay</h1>
         
        </div>
      </div>
      <div className="bg-white px-6 py-4">
        <div className="flex flex-col gap-4">
          {/* Main Header */}
          {/* Dropdown Button */}
          <div className="relative self-start">
            <div className="flex items-center gap-3">
              <div
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="bg-[#F9D949] hover:bg-[#F7D73A] text-black p-3 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl cursor-pointer"
              >
                <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </div>
              <span className="font-bold text-lg text-gray-800">{steps[activeStep].label}</span>
            </div>
            
            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute left-0 mt-3 w-56 bg-gradient-to-b from-white to-gray-50 rounded-2xl shadow-2xl border-2 border-yellow-200 z-50 overflow-hidden backdrop-blur-sm">
                {steps.map((step, index) => (
                  <button
                    key={index}
                    onClick={() => handleStepChange(index)}
                    className={`w-full text-left px-6 py-4 hover:bg-gradient-to-r hover:from-yellow-50 hover:to-gray-100 transition-all duration-300 border-b border-gray-200 last:border-b-0 ${
                      index === activeStep 
                        ? 'bg-gradient-to-r from-yellow-200 to-yellow-100 text-black font-bold shadow-inner' 
                        : 'text-gray-800 hover:text-black font-medium'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-lg">{step.label}</span>
                      {index === activeStep && (
                        <div className="w-3 h-3 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-full shadow-lg"></div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full flex flex-row p-2">
        <div className="w-full min-h-[750px] bg-white p-4 shadow-md rounded">
          {renderStepComponent()}
        </div>
      </div>
    </div>
  );
};

export default OverlayLandingPage;
