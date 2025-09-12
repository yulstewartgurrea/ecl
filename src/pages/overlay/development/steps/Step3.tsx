import React from 'react';

const Step3 = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-2xl font-bold text-gray-800 mb-4">Data Transformation</h3>
      <p className="text-gray-700 mb-4">
        Transform your data using various mathematical and statistical operations to prepare it for analysis.
      </p>
      <div className="flex gap-4">
        <button className="bg-purple-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-purple-700 transition-colors">
          Apply Transformations
        </button>
        <button className="bg-gray-200 text-gray-800 px-6 py-3 rounded-md font-semibold hover:bg-gray-300 transition-colors">
          Preview Results
        </button>
      </div>
    </div>
  );
};

export default Step3;
