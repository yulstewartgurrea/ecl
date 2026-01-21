"use client";

import React, { useState, useEffect } from "react";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { invoke } from "@tauri-apps/api/core";

interface FileInfo {
  name: string;
  is_folder: boolean;
  is_sync?: boolean;
}

interface WorkflowFolderListProps {
  onWorkflowSelect?: (
    entity: string,
    reportingPeriod: string,
    workflowName: string
  ) => void;
}

const WorkflowFolderList: React.FC<WorkflowFolderListProps> = ({
  onWorkflowSelect,
}) => {
  const [currentPath, setCurrentPath] = useState("");
  const [contents, setContents] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<{
    folderOrFileName: string;
  } | null>(null);

  const fetchContents = async (path: string) => {
    setLoading(true);
    try {
      const res = await invoke<{ items: FileInfo[] }>("get_folder_contents", {
        relativePath: path || "",
      });
      setContents(res.items);
    } catch (err) {
      console.error("Error fetching contents:", err);
      setContents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContents(currentPath);
  }, [currentPath]);

  const handleFolderClick = async (folderName: string) => {
    const newPath = currentPath ? `${currentPath}/${folderName}` : folderName;

    try {
      setLoading(true);
      const res = await invoke<{ items: FileInfo[] }>("get_folder_contents", {
        relativePath: newPath,
      });

      const hasSubfolders = res.items.some((item) => item.is_folder);

      if (!hasSubfolders) {
        // This is last folder (WorkflowName)
        // Extract Entity, ReportingPeriod, WorkflowName from path parts
        const parts = newPath.split("/");
        if (parts.length === 3) {
          const [entity, reportingPeriod, workflowName] = parts;
          if (onWorkflowSelect) {
            onWorkflowSelect(entity, reportingPeriod, workflowName);
          }
        } else {
          // fallback if path not exactly 3 parts
          if (onWorkflowSelect) {
            onWorkflowSelect("", "", newPath);
          }
        }
      } else {
        // not last folder  drill down
        setCurrentPath(newPath);
      }
      setContents(res.items);
    } catch (error) {
      console.error("Error checking folder contents:", error);
      setContents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (!currentPath) return;
    const newPath = currentPath.split("/").slice(0, -1).join("/");
    setCurrentPath(newPath);
  };

  const handleContextMenu = (
    event: React.MouseEvent,
    folderOrFileName: string
  ) => {
    event.preventDefault();
    setContextMenu({ folderOrFileName });
  };

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
                  onContextMenu={(event) => handleContextMenu(event, item.name)}
                  className={`relative flex flex-col items-center p-2 cursor-pointer ${
                    contextMenu && contextMenu.folderOrFileName === item.name
                      ? ""
                      : "hover:bg-gray-100"
                  }`}
                >
                  <span className="text-3xl">
                    {item.is_folder ? "ðŸ“" : "ðŸ“„"}
                  </span>
                  <span
                    className="mt-2 text-xs text-center w-full break-words"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  {contextMenu &&
                    contextMenu.folderOrFileName === item.name && (
                      <div className="absolute transform translate-y-14 z-10">
                        <div className="relative">
                          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-l-transparent   border-r-8 border-r-transparent"></div>
                          <ul className="bg-white border border-gray-200 rounded shadow-md z-20 mt-2 bottom-6 -right-2">
                            <li className="px-4 py-2 cursor-pointer hover:bg-blue-50 text-xs">
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
          <div className="text-center text-gray-500">
            No files or folders found.
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowFolderList;

