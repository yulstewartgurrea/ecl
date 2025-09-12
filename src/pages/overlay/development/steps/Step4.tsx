import React from 'react';

const Step4 = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-2xl font-bold text-gray-800 mb-4">Multi Factor Analysis</h3>
      <p className="text-gray-700 mb-4">
        Analyze multiple factors and their relationships to understand the underlying patterns in your data.
      </p>
      <div className="flex gap-4">
        <button className="bg-orange-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-orange-700 transition-colors">
          Run Analysis
        </button>
        <button className="bg-gray-200 text-gray-800 px-6 py-3 rounded-md font-semibold hover:bg-gray-300 transition-colors">
          View Factors
        </button>
      </div>
    </div>
  );
};

export default Step4;
