import React from 'react';

const Step6 = () => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-2xl font-bold text-gray-800 mb-4">Candidate Models</h3>
      <p className="text-gray-700 mb-4">
        Review and compare candidate models that have passed the initial filtering criteria.
      </p>
      <div className="flex gap-4">
        <button className="bg-indigo-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-indigo-700 transition-colors">
          Compare Models
        </button>
        <button className="bg-gray-200 text-gray-800 px-6 py-3 rounded-md font-semibold hover:bg-gray-300 transition-colors">
          View Details
        </button>
      </div>
    </div>
  );
};

export default Step6;
