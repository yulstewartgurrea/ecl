import { useMemo, useState } from "react";
import UploadDropzone from "../../../components/ui/UploadDropzone";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export default function Step1() {
  const [agingFiles, setAgingFiles] = useState<File[]>([]);
  const [validated, setValidated] = useState<null | "ok" | "error">(null);

  const accept = ".csv,.xlsx,.xls";
  const maxSizeMB = 20;

  const validate = () => {
    const ok = agingFiles.length > 0;
    setValidated(ok ? "ok" : "error");
  };
  const clearAll = () => {
    setAgingFiles([]);
    setValidated(null);
  };

  const summary = useMemo(() => {
    if (agingFiles.length) return `${agingFiles.length} aging report`;
    return "";
  }, [agingFiles.length]);

  return (
    <div className="mx-auto max-w-8xl">
      <div className="rounded-3xl border border-gray-200 bg-white/80 backdrop-blur shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="text-lg font-bold tracking-tight text-gray-900">Input Files</h3>
            <p className="text-xs text-gray-500">
              Upload your datasets. Accepted types: <span className="font-medium">{accept}</span>
            </p>
          </div>
          {validated === "ok" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
              <CheckCircleIcon className="h-4 w-4" />
              Ready
            </span>
          )}
          {validated === "error" && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
              <ExclamationTriangleIcon className="h-4 w-4" />
              Missing required files
            </span>
          )}
        </div>

        <div className="p-5">
          <div className="max-w-md">
            <UploadDropzone
              label="Aging Report"
              description="CSV or Excel. Upload your aging report data."
              required
              accept={accept}
              maxSizeMB={maxSizeMB}
              maxFiles={1}
              value={agingFiles}
              onChange={setAgingFiles}
              emptyHint="Waiting for aging report file…"
              variant="card"
            />
          </div>
        </div>

      </div>
    </div>
  );
}
