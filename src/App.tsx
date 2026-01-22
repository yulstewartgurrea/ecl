import "./App.css";

// components
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import Configuration from "./pages/Configuration";
import WorkflowLists from "./pages/flowrate_approach";
import OverlayLandingPage from "./pages/overlay/Overlay";
import FlowrateApproachPage from "./pages/flowrate_approach/FlowrateApproach";
import EclUpload from "./pages/ecl/EclUpload";
import BackendLoader from "./components/BackendLoader";

// redux toolkit
import { useAppSelector } from "./redux_toolkit/hooks";
import { Navigate, Route, Routes } from "react-router-dom";

import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

function App() {
  const { isLoggedIn } = useAppSelector((state) => state.auth);

  const [backendReady, setBackendReady] = useState(false);

  // Listen for backend-ready from Tauri (event-based)
  useEffect(() => {
    const unlistenPromise = listen("backend-ready", () => {
      console.log("[App] Received backend-ready event");
      setBackendReady(true);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  // ✅ Poll backend_is_ready as a fallback — stops automatically once true
  useEffect(() => {
    // if already ready, don't start polling
    if (backendReady) return;

    let cancelled = false;

    const check = async () => {
      if (cancelled) return;
      try {
        const ok = await invoke<boolean>("backend_is_ready");
        if (!cancelled && ok) {
          console.log("[App] backend_is_ready() returned true");
          setBackendReady(true); // triggers cleanup below (clears interval)
        }
      } catch (e) {
        console.warn("[App] backend_is_ready() failed:", e);
      }
    };

    // initial check
    check();

    // repeat every 2s until ready
    const id = setInterval(check, 2000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [backendReady]);

  console.log("isLoggedIn: ", isLoggedIn);
  console.log("backendReady: ", backendReady);

  // Block the whole app until FastAPI/backend is ready
  if (!backendReady) {
    return <BackendLoader />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={isLoggedIn ? <Sidebar /> : <Navigate to="/login" />}
      >
        <Route index element={<WorkflowLists />} />
        <Route path="flowrate" element={<WorkflowLists />} />
        <Route path="pd_landing" element={<FlowrateApproachPage />} />
        <Route path="overlay" element={<OverlayLandingPage />} />
        <Route path="settings" element={<Settings />} />
        <Route path="ecl_configuration" element={<Configuration />} />
        <Route path="page/flowrate" element={<FlowrateApproachPage />} />
        <Route path="page/upload" element={<EclUpload />} />
        <Route path="ecl" element={<EclUpload />} />
      </Route>
      <Route path="*" element={<Navigate to={isLoggedIn ? "/" : "/login"} />} />
    </Routes>
  );
}

export default App;
