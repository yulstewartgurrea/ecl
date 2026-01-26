// src/components/BackendLoader.tsx
import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

type BackendStatusPayload = {
  step: string;
  message: string;
  error?: string | null;
};

export default function BackendLoader() {
  const [status, setStatus] = useState<BackendStatusPayload>({
    step: "init",
    message: "Initializing",
    error: null,
  });

// inside BackendLoader.tsx
useEffect(() => {
  const unlistenPromise = listen<{
    step: string;
    message: string;
    error?: string | null;
  }>("backend-status", (event) => {
    console.log("[BackendLoader] status:", event.payload, setStatus);
    // you can update local UI state here using event.payload.step/message/error
  });

  return () => {
    unlistenPromise.then((unlisten) => unlisten());
  };
}, []);


  const isError = status.step === "error";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 text-slate-50">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-slate-900/70 p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          {!isError ? (
            <div className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse" />
          ) : (
            <div className="h-3 w-3 rounded-full bg-red-500" />
          )}
          <h1 className="text-lg font-semibold">
            {isError ? "Backend error" : "Starting backend"}
          </h1>
        </div>

        <p className="text-sm text-slate-200 mb-2">{status.message}</p>

        {status.error && (
          <p className="mt-2 text-xs text-red-300 whitespace-pre-wrap">
            {status.error}
          </p>
        )}

        {!isError && (
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-500 -transparent" />
            <span>Please wait while we prepare Python & FastAPI</span>
          </div>
        )}
      </div>
    </div>
  );
}

