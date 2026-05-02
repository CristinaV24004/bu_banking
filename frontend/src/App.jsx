// src/App.jsx (relevant part)
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleRoute } from './components/RoleRoute';
import Layout from './components/Layout';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import UnauthorizedPage from './pages/UnauthorizedPage';
import AccHolderDashboard from './pages/AccHolderDashboard';
import TransactionsPage from './pages/TransactionsPage';
import NewPaymentPage from './pages/NewPaymentPage';
import PendingPage from './pages/PendingPage';
import GuardianDashboard from './pages/GuardianDashboard';
import GuardianApprovalsPage from './pages/GuardianApprovalsPage';
import GuardianWhitelistPage from './pages/GuardianWhitelistPage';
import GuardianLimitsPage from './pages/GuardianLimitsPage';
import GuardianTransactionsPage from './pages/GuardianTransactionsPage';
import CardBalancePage from './pages/CardBalancePage';

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes – no Layout */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/unauthorized" element={<UnauthorizedPage />} />
      <Route path="/cards/:card_number" element={<CardBalancePage />} />

      {/* Account Holder routes – wrapped in Layout */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <RoleRoute requiredRole="account_holder">
              <Layout>
                <AccHolderDashboard />
              </Layout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/payment/new"
        element={
          <ProtectedRoute>
            <RoleRoute requiredRole="account_holder">
              <Layout>
                <NewPaymentPage />
              </Layout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pending"
        element={
          <ProtectedRoute>
            <RoleRoute requiredRole="account_holder">
              <Layout>
                <PendingPage />
              </Layout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      {/* Guardian routes – wrapped in Layout */}
      <Route
        path="/guardian"
        element={
          <ProtectedRoute>
            <RoleRoute requiredRole="guardian">
              <Layout>
                <GuardianDashboard />
              </Layout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/guardian/approvals"
        element={
          <ProtectedRoute>
            <RoleRoute requiredRole="guardian">
              <Layout>
                <GuardianApprovalsPage />
              </Layout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/guardian/whitelist"
        element={
          <ProtectedRoute>
            <RoleRoute requiredRole="guardian">
              <Layout>
                <GuardianWhitelistPage />
              </Layout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/guardian/limits"
        element={
          <ProtectedRoute>
            <RoleRoute requiredRole="guardian">
              <Layout>
                <GuardianLimitsPage />
              </Layout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/guardian/transactions"
        element={
          <ProtectedRoute>
            <RoleRoute requiredRole="guardian">
              <Layout>
                <GuardianTransactionsPage />
              </Layout>
            </RoleRoute>
          </ProtectedRoute>
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