import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { FeedbackProvider } from './components/ui/Feedback';
import { MotionProvider, LedgerMotion } from './components/ui/Motion';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Reconciliation from './pages/Reconciliation'; // NEW IMPORT
import MissionReadiness from './pages/MissionReadiness';
import CoopLedger from './pages/CoopLedger';
import ExportCenter from './pages/ExportCenter';
import Admin from './pages/Admin';
import Tithers from './pages/Tithers';
import FinancialSetup from './pages/FinancialSetup';
import MissionaryReport from './pages/MissionaryReport'; 

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) return <div className="session-loading" role="status"><span className="session-loading-brand">JFCM-SL / Stewards</span><LedgerMotion variant="transition" /><h1>Opening your workspace.</h1><p>Retrieving your session</p><div className="session-loading-track"><span /></div></div>;
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/transactions" element={<Transactions />} />
        <Route path="/reconciliation" element={<Reconciliation />} /> {/* NEW ROUTE */}
        <Route path="/mission-readiness" element={<MissionReadiness />} />
        <Route path="/coop-ledger" element={<CoopLedger />} />
        <Route path="/export-center" element={<ExportCenter />} />
        <Route path="/tithers" element={<Tithers />} />
        <Route path="/missionary-report" element={<MissionaryReport />} /> 
        <Route path="/financial-setup" element={<FinancialSetup />} />
        <Route path="/admin" element={<Admin />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <MotionProvider><FeedbackProvider><Router>
          <AppRoutes />
        </Router></FeedbackProvider></MotionProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
