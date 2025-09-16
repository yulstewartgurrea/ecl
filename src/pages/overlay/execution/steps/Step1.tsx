import { useMemo, useState } from "react";
import UploadDropzone from "../../../../components/ui/UploadDropzone";
import { CheckCircleIcon, ExclamationTriangleIcon } from "@heroicons/react/24/outline";

export default function Step1() {
  const [monthlyFiles, setMonthlyFiles] = useState<File[]>([]);
  const [quarterlyFiles, setQuarterlyFiles] = useState<File[]>([]);
  const [validated, setValidated] = useState<null | "ok" | "error">(null);

  const accept = ".csv,.xlsx,.xls";
  const maxSizeMB = 20;

  const validate = () => {
    const ok = monthlyFiles.length > 0 && quarterlyFiles.length > 0;
    setValidated(ok ? "ok" : "error");
  };
  const clearAll = () => {
    setMonthlyFiles([]);
    setQuarterlyFiles([]);
    setValidated(null);
  };

  const summary = useMemo(() => {
    const parts: string[] = [];
    if (monthlyFiles.length) parts.push(`${monthlyFiles.length} monthly`);
    if (quarterlyFiles.length) parts.push(`${quarterlyFiles.length} quarterly`);
    return parts.join(" • ");
  }, [monthlyFiles.length, quarterlyFiles.length]);

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

        <div className="grid gap-5 p-5 md:grid-cols-2">
          <UploadDropzone
            label="Monthly Historical Macroeconomic Variables"
            description="CSV or Excel. Include all monthly indicators."
            required
            accept={accept}
            maxSizeMB={maxSizeMB}
            maxFiles={3}
            value={monthlyFiles}
            onChange={setMonthlyFiles}
            emptyHint="Waiting for monthly file(s)…"
            variant="card"
          />
          <UploadDropzone
            label="Quarterly Historical MEVs"
            description="CSV or Excel. Quarterly aggregates."
            required
            accept={accept}
            maxSizeMB={maxSizeMB}
            maxFiles={3}
            value={quarterlyFiles}
            onChange={setQuarterlyFiles}
            emptyHint="Waiting for quarterly file(s)…"
            variant="card"
          />
        </div>

        <div className="flex flex-col gap-3 border-t px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="text-xs text-gray-600">
            {!monthlyFiles.length && !quarterlyFiles.length
              ? "No files uploaded yet."
              : `Uploaded: ${summary}`}
          </div>
          <div className="flex gap-3">
            <button
              onClick={clearAll}
              className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              Clear all
            </button>
            <button
              onClick={validate}
              className="inline-flex items-center rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-black"
            >
              Validate files
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
