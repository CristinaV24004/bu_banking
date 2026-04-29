// src/pages/GuardianDashboard.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { axiosInstance } from '../api/axiosInstance';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

const GuardianDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setError(null);
        setLoading(true);

        // Fetch pending transactions for this guardian
        const pendingRes = await axiosInstance.get('/guardian/pending-reviews/');
        const transactions = pendingRes.data.pending_transactions || [];
        setPendingTransactions(transactions);
      } catch (err) {
        console.error('Failed to fetch guardian dashboard data:', err);
        setError('Unable to load dashboard. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatCurrency = (amount) => {
    const num = Number.parseFloat(amount);
    if (Number.isNaN(num)) return '£0.00';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(num);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-gray-600">Loading guardian dashboard...</div>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        {/* Header with logout */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Guardian Dashboard</h1>
            <p className="text-gray-600">
              Welcome back, {user?.username || 'Guardian'}
            </p>
          </div>
          <Button variant="ghost" onClick={logout}>
            Logout
          </Button>
        </div>

        {error && (
          <div className="mb-6">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {/* Summary Card */}
        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <Card title="Overview">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total pending approvals:</span>
                <span className="text-2xl font-bold text-blue-600">
                  {pendingTransactions.length}
                </span>
              </div>
            </div>
          </Card>
        </div>

        {/* Pending transactions list */}
        <Card title="Recent Pending Transactions" className="mb-6">
          {pendingTransactions.length === 0 ? (
            <p className="py-4 text-center text-gray-500">
              No transactions awaiting your review.
            </p>
          ) : (
            <div className="space-y-3">
              {pendingTransactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.pending_id}
                  className="flex flex-wrap items-center justify-between rounded-lg border border-gray-100 bg-white p-3 shadow-sm"
                >
                  <div className="font-medium text-gray-900">
                    {tx.merchant || 'Unknown merchant'}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="font-semibold text-gray-900">
                      {formatCurrency(tx.amount)}
                    </div>
                    <span className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                      Pending
                    </span>
                  </div>
                </div>
              ))}
              {pendingTransactions.length > 5 && (
                <p className="text-center text-sm text-gray-500">
                  +{pendingTransactions.length - 5} more pending
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Action buttons */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Button
            variant="primary"
            onClick={() => navigate('/guardian/approvals')}
            className="w-full"
          >
            Review Approvals
          </Button>
          <Button variant="primary" onClick={() => navigate('/guardian/transactions')} className="w-full">
            View Transactions
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/guardian/whitelist')}
            className="w-full"
          >
            Manage Whitelist
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/guardian/limits')}
            className="w-full"
          >
            Manage Limits
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GuardianDashboard;