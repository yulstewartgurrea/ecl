// import React from 'react';
import Updater from '../components/Updater';

const Settings = () => {
  return (
    <div className="w-full min-h-screen bg-gray-50 px-6 py-8">
      <div className="max-w-4xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Settings</h1>
        </div>

        <div className="space-y-8">
          {/* Application Updates Section */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Application Updates</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Keep your application up to date with the latest features and security patches.
                </p>
              </div>
            </div>
            
            <div className=" border-gray-200 pt-4">
              <Updater />
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Settings ;

