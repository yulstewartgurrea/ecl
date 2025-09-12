import "./App.css";

//components
import Sidebar from "./components/Sidebar";
import Login from "./pages/Login";
import TransitionMatrixLanding from "./pages/transition_matrix";
import PdTransitionMatrixWorkflow from "./pages/transition_matrix/Workflow";
import Settings from "./pages/Settings";
import Configuration from "./pages/Configuration";
//redux toolkit
import { useAppSelector, useAppDispatch } from "./redux_toolkit/hooks";
import { Navigate, Route, Routes } from "react-router-dom";
import PdLandingPage from "./pages/PdLandingPage";
import EclLandingPage from "./pages/EclLandingPage";
import OverlayLandingPage from "./pages/overlay/Overlay";
import { login as loginAction } from "./redux_toolkit/features/general/auth";
import { useEffect } from "react";

function App() {
  const { isLoggedIn } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username") || "";
    const role = localStorage.getItem("role") || "";
    if (token && !isLoggedIn) {
      dispatch(loginAction({ username, token, role }));
    }
  }, [dispatch, isLoggedIn]);
  console.log('isLoggedIn: ', isLoggedIn)
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={isLoggedIn ? <Sidebar /> : <Navigate to="/login" />}
      >
        <Route index element={<EclLandingPage />} />
        <Route path="pd_landing" element={<PdLandingPage />} />
        <Route path="overlay" element={<OverlayLandingPage />} />
        <Route path="settings" element={<Settings />} />
         <Route path="ecl_configuration" element={<Configuration />} />
        <Route path="transition_matrix" element={<TransitionMatrixLanding />} />
        <Route
          path="transition_matrix/workflow"
          element={<PdTransitionMatrixWorkflow />}
        />
      </Route>
      <Route path="*" element={<Navigate to={isLoggedIn ? "/" : "/login"} />} />
    </Routes>
  );
}

export default App;
