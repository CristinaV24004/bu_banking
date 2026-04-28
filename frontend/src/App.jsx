// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RoleRoute } from './components/RoleRoute';

// Import placeholder page components (defined below)
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AccHolderDashboard from './pages/AccHolderDashboard';
import GuardianDashboard from './pages/GuardianDashboard';
import UnauthorizedPage from './pages/UnauthorizedPage';
import TransactionsPage from './pages/TransactionsPage';
import PendingPage from './pages/PendingPage';
import GuardianApprovalsPage from './pages/GuardianApprovalsPage';
import GuardianWhitelistPage from './pages/GuardianWhitelistPage';
import GuardianLimitsPage from './pages/GuardianLimitsPage';

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />

      {/* Account_holder routes */}
      <Route
        path="/dashboard"
        element={
            <RoleRoute requiredRole="account_holder">
              <AccHolderDashboard />
            </RoleRoute>
        }
      />
      <Route
        path="/transactions"
        element={
            <RoleRoute requiredRole="account_holder">
              <TransactionsPage />
            </RoleRoute>
        }
      />
      <Route
        path="/pending"
        element={
            <RoleRoute requiredRole="account_holder">
              <PendingPage />
            </RoleRoute>
        }
      />

      {/* Guardian routes */}
      <Route
        path="/guardian"
        element={
            <RoleRoute requiredRole="guardian">
              <GuardianDashboard />
            </RoleRoute>
        }
      />
      <Route
        path="/guardian/approvals"
        element={
            <RoleRoute requiredRole="guardian">
              <GuardianApprovalsPage />
            </RoleRoute>
        }
      />
      <Route
        path="/guardian/whitelist"
        element={
            <RoleRoute requiredRole="guardian">
              <GuardianWhitelistPage />
            </RoleRoute>
        }
      />
      <Route
        path="/guardian/limits"
        element={
            <RoleRoute requiredRole="guardian">
              <GuardianLimitsPage />
            </RoleRoute>
        }
      />

      {/* Default redirect */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;