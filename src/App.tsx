import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import MissionReadiness from './pages/MissionReadiness';
import CoopLedger from './pages/CoopLedger';
import ExportCenter from './pages/ExportCenter';
import Admin from './pages/Admin';
import FinancialSetup from './pages/FinancialSetup';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { session, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-brand-bg dark:bg-brand-darkBg text-slate-600 dark:text-slate-300 font-medium">Loading session...</div>;
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
        <Route path="/mission-readiness" element={<MissionReadiness />} />
        <Route path="/coop-ledger" element={<CoopLedger />} />
        <Route path="/export-center" element={<ExportCenter />} />
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
        <Router>
          <AppRoutes />
        </Router>
      </ThemeProvider>
    </AuthProvider>
  );
}