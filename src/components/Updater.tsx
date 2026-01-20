import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface UpdateInfo {
  version: string;
  date: string;
  body: string;
}

interface UpdaterProps {
  className?: string;
}

const Updater: React.FC<UpdaterProps> = ({ className = "" }) => {
  const [isChecking, setIsChecking] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  // Get current version on component mount
  useEffect(() => {
    getCurrentVersion();
  }, []);

  const getCurrentVersion = async () => {
    try {
      const version = await invoke<string>('get_app_version');
      setCurrentVersion(version);
    } catch (err) {
      console.error('Failed to get app version:', err);
    }
  };

  const checkForUpdates = async () => {
    setIsChecking(true);
    setError("");
    
    try {
      const update = await invoke<{
        version: string;
        date: string;
        body: string;
      }>('check_for_updates');
      
      setUpdateInfo(update);
      setShowUpdateDialog(true);
    } catch (err) {
      const errorMessage = err as string;
      if (errorMessage.includes("No updates available")) {
        setError("You're already running the latest version!");
      } else {
        setError(`Update check failed: ${errorMessage}`);
      }
    } finally {
      setIsChecking(false);
    }
  };

  const installUpdate = async () => {
    setIsInstalling(true);
    setError("");
    
    try {
      await invoke('install_update');
      // The app will restart automatically after successful update
    } catch (err) {
      setError(`Update installation failed: ${err}`);
      setIsInstalling(false);
    }
  };

  const dismissUpdate = () => {
    setShowUpdateDialog(false);
    setUpdateInfo(null);
  };

  return (
    <div className={className}>
      {/* Update Button */}
      <button
        onClick={checkForUpdates}
        disabled={isChecking || isInstalling}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg shadow-sm font-medium bg-white border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isChecking ? (
          <>
            <ArrowPathIcon className="w-4 h-4 animate-spin" />
            Checking...
          </>
        ) : (
          <>
            <ArrowPathIcon className="w-4 h-4" />
            Check for Updates
          </>
        )}
      </button>

      {/* Current Version Display */}
      {currentVersion && (
        <div className="text-xs text-gray-500 mt-1">
          Version {currentVersion}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Update Available Dialog */}
      {showUpdateDialog && updateInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-100/80">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-full">
                  <ArrowPathIcon className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">
                    Update Available
                  </h3>
                  <p className="text-sm text-gray-500">
                    Version {updateInfo.version}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  What's New:
                </h4>
                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg max-h-32 overflow-y-auto">
                  {updateInfo.body || "Bug fixes and improvements"}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={dismissUpdate}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200"
                >
                  Later
                </button>
                <button
                  onClick={installUpdate}
                  disabled={isInstalling}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isInstalling ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                      Installing...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-4 h-4" />
                      Install Update
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Updater;

