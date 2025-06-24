"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ChevronLeftIcon, CheckCircleIcon, CloudArrowUpIcon } from "@heroicons/react/24/outline";

interface FileInfo {
  name: string;
  is_folder: boolean;
  is_sync?: boolean;
}

const WorkflowFolderList: React.FC = () => {

  const [currentPath, setCurrentPath] = useState("");
  const [contents, setContents] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ folderOrFileName: string } | null>(null);

  const isSpecialPath = (path: string) => {
    const parts = path.split("/");
    return (
      parts.length >= 3 &&
      /^\d{4}$/.test(parts[0]) &&
      parts[1] === "CAPITAL_MANAGEMENT" &&
      parts[2] === "FORECASTING"
    );
  };

  const handleFolderClick = (folderName: string) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;
    setCurrentPath(newPath);
    // Here you can fetch folder contents if you want
  };

  const handleBack = () => {
    if (!currentPath) return;
    const newPath = currentPath.split("/").slice(0, -1).join("/");
    setCurrentPath(newPath);
    // Here you can fetch folder contents if you want
  };

  const handleContextMenu = (event: React.MouseEvent, folderOrFileName: string) => {
    event.preventDefault();
    setContextMenu({ folderOrFileName });
  };

  const dummyData = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => ({
      name: `Item ${i + 1}`,
      is_folder: true,
      is_sync: i % 2 === 0, // just some dummy sync status
    }));
  }, []);

  useEffect(() => {
    setContents(dummyData);
    setLoading(false);
  }, [dummyData]);

  return (
    <div className="z-10 min-h-screen max-h-screen pb-4 mb-4">
      <div
        className="bg-white shadow-lg rounded-md p-2 min-h-dvh"
        onClick={() => setContextMenu(null)}
      >
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBack}
            disabled={!currentPath}
            className={`text-sm px-4 py-2 rounded ${
              currentPath
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <h1>Workflows</h1>
        </div>
        <div className="text-gray-700 font-semibold text-sm break-words px-2">
          {currentPath || "Root"}
        </div>
        {loading ? (
          <div className="text-center text-gray-500">Loading...</div>
        ) : contents.length > 0 ? (
          <div className="min-h-[520px] max-h-[720px] overflow-y-auto py-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-4 gap-4">
              {contents.map((item, index) => (
                <div
                  key={index}
                  onClick={() => item.is_folder && handleFolderClick(item.name)}
                  onContextMenu={(event) => {
                    if (isSpecialPath(currentPath)) handleContextMenu(event, item.name);
                  }}
                  className={`relative flex flex-col items-center p-2 cursor-pointer ${
                    contextMenu && contextMenu.folderOrFileName === item.name
                      ? ""
                      : "hover:bg-gray-100"
                  }`}
                >
                  <span className="text-3xl">{item.is_folder ? "📁" : "📄"}</span>
                  <span
                    className="mt-2 text-xs text-center w-full break-words"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  {isSpecialPath(currentPath) && (
                    <span className="absolute top-0 right-0 mt-1 mr-1">
                      {item.is_sync ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <CloudArrowUpIcon className="h-5 w-5 text-blue-500" />
                      )}
                    </span>
                  )}
                  {contextMenu && contextMenu.folderOrFileName === item.name && (
                    <div className="absolute transform translate-y-14 z-10">
                      <div className="relative">
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent border-b-8 border-b-gray-200 border-r-8 border-r-transparent"></div>
                        <ul className="bg-white border border-gray-200 rounded shadow-md z-20 mt-2 bottom-6 -right-2">
                          <li className="px-4 py-2 cursor-pointer hover:bg-blue-50 text-xs">
                            {/* Just dummy items for context menu */}
                            Option 1
                          </li>
                          <li className="px-4 py-2 cursor-pointer hover:bg-blue-50 text-xs border-t">
                            Option 2
                          </li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-gray-500">No files or folders found.</div>
        )}
      </div>
    </div>
  );
};

export default WorkflowFolderList;
