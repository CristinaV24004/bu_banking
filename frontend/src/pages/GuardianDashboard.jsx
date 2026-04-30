import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePendingPolling } from '../hooks/usePendingPolling';
import { axiosInstance } from '../api/axiosInstance';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import AnomalyAlertsWidget from '../components/AnomalyAlertsWidget';

const GuardianDashboard = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [error, setError] = useState(null);
  const { pendingCount, pendingTransactions, loading: pollingLoading, error: pollingError } = usePendingPolling(true);
  const [managedAccounts, setManagedAccounts] = useState([]);

  useEffect(() => {
    const fetchManagedAccounts = async () => {
      try {
        const response = await axiosInstance.get('/guardian/managed-accounts/');
        setManagedAccounts(response.data.managed_accounts || []);
      } catch (err) {
        console.warn('Failed to fetch managed accounts:', err);
      }
    };
    fetchManagedAccounts();
  }, []);

  const renderPendingContent = () => {
    if (pollingLoading) return <p className="py-4 text-center text-gray-500">Loading...</p>;
    if (pendingTransactions.length === 0) return <p className="py-4 text-center text-gray-500">No transactions awaiting your review.</p>;
    return (
      <div className="space-y-3">
        {pendingTransactions.slice(0, 5).map((tx) => (
          <div key={tx.pending_id} className="flex flex-wrap items-center justify-between rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
            <div className="font-medium text-gray-900">{tx.merchant || 'Unknown merchant'}</div>
            <div className="flex items-center gap-3">
              <div className="font-semibold text-gray-900">
                {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(Number.parseFloat(tx.amount))}
              </div>
              <span className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">Pending</span>
            </div>
          </div>
        ))}
        {pendingTransactions.length > 5 && (
          <p className="text-center text-sm text-gray-500">+{pendingTransactions.length - 5} more pending</p>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Guardian Dashboard</h1>
            <p className="text-gray-600">
              Welcome back, {user?.username || 'Guardian'}
            </p>
          </div>
          <Button variant="ghost" onClick={logout}>Logout</Button>
        </div>

        {(error || pollingError) && (
          <div className="mb-6">
            <Alert type="error" message={error || pollingError} onDismiss={() => setError(null)} />
          </div>
        )}

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <Card title="Overview">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total pending approvals:</span>
                <span className="text-2xl font-bold text-blue-600">{pendingCount}</span>
              </div>
            </div>
          </Card>
        </div>

        {managedAccounts.length > 0 && (
          <div className="mb-6">
            <AnomalyAlertsWidget accountHolderId={managedAccounts[0].id} />
          </div>
        )}

        <Card title="Recent Pending Transactions" className="mb-6">
          {renderPendingContent()}
        </Card>

        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Button variant="primary" onClick={() => navigate('/guardian/approvals')} className="w-full">Review Approvals</Button>
          <Button variant="primary" onClick={() => navigate('/guardian/whitelist')} className="w-full">Manage Whitelist</Button>
          <Button variant="primary" onClick={() => navigate('/guardian/limits')} className="w-full">Manage Limits</Button>
          <Button variant="primary" onClick={() => navigate('/guardian/transactions')} className="w-full">View Transactions</Button>
        </div>
      </div>
    </div>
  );
};

export default GuardianDashboard;