import React from "react";

const BGContainer: React.FC = () => {
  return (
    <div className="absolute inset-0 w-screen h-screen z-0 pointer-events-none">
      <div className="relative w-full h-full overflow-hidden">
        <svg
          className="absolute top-0 right-0 w-[1100px] h-[1500px] -translate-y-6 opacity-100"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path
            fill="#facc15"
            d="M44.5,-33.2C56.8,-23.7,65.2,-11.9,65.2,0.5C65.3,12.9,56.9,25.8,44.6,35.5C32.2,45.2,16.1,51.8,1.9,50.5C-12.2,49.2,-24.5,40,-35.4,29.4C-46.3,18.8,-55.9,6.8,-54.5,-4C-53.2,-14.9,-40.8,-24.8,-28.7,-34.3C-16.6,-43.9,-8.3,-53.2,2.5,-56.2C13.3,-59.2,26.7,-55.6,44.5,-33.2Z"
            transform="translate(70 50)"
          />
        </svg>
      </div>
    </div>
  );
};

export default BGContainer;
