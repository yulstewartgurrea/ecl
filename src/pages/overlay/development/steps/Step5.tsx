import React from 'react';

const Step5 = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-2xl font-bold text-gray-800 mb-4">Filtering of Models</h3>
      <p className="text-gray-700 mb-4">
        Filter and evaluate different model candidates based on performance criteria and business requirements.
      </p>
      <div className="flex gap-4">
        <button className="bg-red-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-red-700 transition-colors">
          Apply Filters
        </button>
        <button className="bg-gray-200 text-gray-800 px-6 py-3 rounded-md font-semibold hover:bg-gray-300 transition-colors">
          Review Criteria
        </button>
      </div>
    </div>
  );
};

export default Step5;
