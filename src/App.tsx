import './App.css'

//components
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import TransitionMatrixLanding from './pages/transition_matrix';
import PdTransitionMatrixWorkflow from './pages/transition_matrix/Workflow';
import Settings from './pages/Settings';

//redux toolkit
import { useAppSelector } from './redux_toolkit/hooks'
import { Navigate, Route, Routes } from 'react-router-dom';
import PdLandingPage from './pages/PdLandingPage';
import EclLandingPage from './pages/EclLandingPage';

function App() {
  const { isLoggedIn } = useAppSelector(state => state.auth);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={isLoggedIn ? <Sidebar /> : <Navigate to="/login" />}>
        <Route index element={<EclLandingPage />} />
        <Route path="pd_landing" element={<PdLandingPage />} />      
        <Route path="settings" element={<Settings />} />
        {/* Transition Matrix Routes */}
        <Route path="transition_matrix" element={<TransitionMatrixLanding />} />
        <Route path="transition_matrix/workflow" element={<PdTransitionMatrixWorkflow />} />          
      </Route>
      <Route path="*" element={<Navigate to={isLoggedIn ? '/' : '/login'} />} />
    </Routes>
  )
}

export default App
