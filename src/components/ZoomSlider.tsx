import React from "react";

interface ZoomSliderProps {
  zoom: number;
  setZoom: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

const ZoomSlider: React.FC<ZoomSliderProps> = ({
  zoom,
  setZoom,
  min = 0.5,
  max = 2,
  step = 0.1,
  className = "w-1/4",
}) => {
  return (
    <div className={className}>
      <div className="flex justify-center items-center gap-2">
        <span className="text-xl mb-1.5">−</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={zoom}
          onChange={(e) => setZoom(parseFloat(e.target.value))}
          className="w-full h-1.5 cursor-pointer"
        />
        <span className="text-xl mb-1.5">+</span>
      </div>
    </div>
  );
};

export default ZoomSlider;