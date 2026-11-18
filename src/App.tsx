import "./App.css";

// components
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import Configuration from "./pages/Configuration";
import WorkflowLists from "./pages/flowrate_approach/index";
import OverlayLandingPage from "./pages/overlay/Overlay";
import FlowrateApproachPage from "./pages/flowrate_approach/FlowrateApproach";
import WorkflowFolderList from "./pages/flowrate_approach/WorkflowFolderList";
import EclUpload from "./pages/ecl/EclUpload";
import BackendLoader from "./components/BackendLoader";
import TermsGate from "./components/terms/TermsGate";
import Workflows from "./pages/workflows/Workflows";
import Chatbot from "./pages/chatbot/ChatbotPage";
import PdLandingPage from "./pages/transition_matrix/Workflow";
// redux toolkit
import { useAppSelector } from "./redux_toolkit/hooks";
import { resetInterpolationClient } from "./services/interpolation";
import { Navigate, Route, Routes } from "react-router-dom";

import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { IS_DESKTOP, WEB_HOME } from "./lib/runtime";

function App() {
  const { isLoggedIn: loggedInDesktop } = useAppSelector((state) => state.auth);
  // The web build has no backend or login: treat the visitor as signed in
  const isLoggedIn = IS_DESKTOP ? loggedInDesktop : true;

  // Only the desktop app waits for its local backend to start
  const [backendReady, setBackendReady] = useState(!IS_DESKTOP);

  // Listen for backend-ready from Tauri (event-based)
  useEffect(() => {
    if (!IS_DESKTOP) return;
    const unlistenPromise = listen("backend-ready", () => {
      console.log("[App] Received backend-ready event");
      setBackendReady(true);
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;
    resetInterpolationClient();
    const g: any = window as any;
    if (g.__MCU_CACHE__ && typeof g.__MCU_CACHE__.clear === "function") {
      g.__MCU_CACHE__.clear();
    }
  }, [isLoggedIn]);

  // Poll backend_is_ready as a fallback — stops automatically once true
  useEffect(() => {
    // if already ready (or not the desktop app), don't start polling
    if (!IS_DESKTOP || backendReady) return;

    let cancelled = false;

    const check = async () => {
      if (cancelled) return;
      try {
        const ok = await invoke<boolean>("backend_is_ready");
        if (!cancelled && ok) {
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

  // Block the whole app until FastAPI/backend is ready
  if (!backendReady) {
    return <BackendLoader />;
  }

  // Web build: no login or terms gate, every route opens inside the dashboard
  if (!IS_DESKTOP) {
    return (
      <Routes>
        <Route path="/" element={<Sidebar />}>
          <Route index element={<Navigate to={WEB_HOME} replace />} />
          <Route path="workflows" element={<Workflows />} />
          <Route path="flowrate" element={<FlowrateApproachPage />} />
          <Route path="WorkflowFolderList" element={<WorkflowFolderList />} />
          <Route path="pd_landing" element={<PdLandingPage />} />
          <Route path="overlay" element={<OverlayLandingPage />} />
          <Route path="settings" element={<Settings />} />
          <Route path="ecl_configuration" element={<Configuration />} />
          <Route path="page/flowrate" element={<FlowrateApproachPage />} />
          <Route path="page/upload" element={<EclUpload />} />
          <Route path="ecl" element={<EclUpload />} />
          <Route path="chatbot" element={<Chatbot />} />
        </Route>
        <Route path="*" element={<Navigate to={WEB_HOME} replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          isLoggedIn ? (
            <TermsGate>
              <Sidebar />
            </TermsGate>
          ) : (
            <Navigate to="/login" />
          )
        }
      >
        <Route index element={<WorkflowLists />} />
        <Route path="workflows" element={<Workflows />} />
        <Route path="flowrate" element={<FlowrateApproachPage />} />
        <Route path="WorkflowFolderList" element={<WorkflowFolderList />} />
        <Route path="pd_landing" element={<PdLandingPage />} />
        <Route path="overlay" element={<OverlayLandingPage />} />
        <Route path="settings" element={<Settings />} />
        <Route path="ecl_configuration" element={<Configuration />} />
        <Route path="page/flowrate" element={<FlowrateApproachPage />} />
        <Route path="page/upload" element={<EclUpload />} />
        <Route path="ecl" element={<EclUpload />} />
           <Route path="/chatbot" element={<Chatbot />} />
      </Route>
      <Route path="*" element={<Navigate to={isLoggedIn ? "/" : "/login"} />} />
    </Routes>
  );
}

export default App;
