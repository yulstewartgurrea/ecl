import { useEffect } from "react";
import {
  CheckCircleIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/24/solid";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import clsx from "clsx";

type StatusType = "idle" | "loading" | "success" | "error";

interface ApiStatusIndicatorProps {
  status: StatusType;
  message?: string;
  autoHide?: boolean;
  onHide?: () => void;
}

const ApiStatusIndicator = ({
  status,
  message,
  autoHide = true,
  onHide,
}: ApiStatusIndicatorProps) => {
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (autoHide && (status === "success" || status === "error")) {
      timer = setTimeout(() => {
        onHide?.(); // 🔹 tell parent to reset status
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [status, autoHide, onHide]);

  if (status === "idle") return null;

  return (
    <div
      className={clsx(
        "fixed top-4 right-4 flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg text-white text-sm transition-all z-50",
        {
          "bg-blue-500": status === "loading",
          "bg-green-500": status === "success",
          "bg-red-500": status === "error",
        }
      )}
    >
      {status === "loading" && (
        <ArrowPathIcon className="w-5 h-5 animate-spin" />
      )}
      {status === "success" && <CheckCircleIcon className="w-5 h-5" />}
      {status === "error" && <ExclamationCircleIcon className="w-5 h-5" />}
      <span>{message}</span>
    </div>
  );
};

export default ApiStatusIndicator;
