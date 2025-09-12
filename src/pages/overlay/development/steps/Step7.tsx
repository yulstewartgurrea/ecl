// import React from 'react';

const Step7 = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-2xl font-bold text-gray-800 mb-4">Final Model</h3>
      <p className="text-gray-700 mb-4">
        Select and finalize the best performing model for your overlay implementation.
      </p>
      <div className="flex gap-4">
        <button className="bg-emerald-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-emerald-700 transition-colors">
          Finalize Model
        </button>
        <button className="bg-gray-200 text-gray-800 px-6 py-3 rounded-md font-semibold hover:bg-gray-300 transition-colors">
          Export Results
        </button>
      </div>
    </div>
  );
};

export default Step7;

