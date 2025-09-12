// import React from 'react';

const Step2 = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-2xl font-bold text-gray-800 mb-4">Interpolation</h3>
      <p className="text-gray-700 mb-4">
        Perform data interpolation to fill missing values and ensure data continuity for analysis.
      </p>
      <div className="flex gap-4">
        <button className="bg-green-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-green-700 transition-colors">
          Start Interpolation
        </button>
        <button className="bg-gray-200 text-gray-800 px-6 py-3 rounded-md font-semibold hover:bg-gray-300 transition-colors">
          Configure Settings
        </button>
      </div>
    </div>
  );
};

export default Step2;

