import { useState } from "react";
import StepSwitch from "../../components/ui/StepSwitch";
import type { StepItem } from "../../components/ui/StepSwitch";
import OverlayDevelopmentStep1 from "./development/Development";
import OverlayExecutionStep1 from "./execution/Development";

export default function OverlayLandingPage() {
  const [activeStep, setActiveStep] = useState(0);

  const steps: StepItem[] = [
    { label: "Development", completed: false },
    { label: "Execution", completed: false },
  ];

  return (
    <div className="min-h-dvh bg-gradient-to-b from-gray-50 to-white">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Overlay</h1>
            <p className="text-xs text-gray-600">
              Configure development and run execution.
            </p>
          </div>
          <StepSwitch
            steps={steps}
            activeIndex={activeStep}
            onChange={setActiveStep}
          />
        </div>
      </header>

      {/* Content */}
      <main className="mx-full ">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="p-4 sm:p-2">
            {activeStep === 0 ? <OverlayDevelopmentStep1 /> : <OverlayExecutionStep1 />}
          </div>
        </div>
      </main>
    </div>
  );
}
