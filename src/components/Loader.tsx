import React from "react";

const PulsingDotsLoader: React.FC<{ size?: number; color?: string }> = ({
  size = 12,
  color = "#fce404",
}) => {
  return (
    <div className="flex space-x-2">
      {[...Array(3)].map((_, i) => (
        <span
          key={i}
          className="inline-block rounded-full animate-pulse"
          style={{
            width: size,
            height: size,
            backgroundColor: color,
            animationDelay: `${i * 0.2}s`,
          }}
        />
      ))}
    </div>
  );
};

export default PulsingDotsLoader;
