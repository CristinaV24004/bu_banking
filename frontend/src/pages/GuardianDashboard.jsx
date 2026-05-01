import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { axiosInstance } from '../api/axiosInstance';
import { usePendingPolling } from '../hooks/usePendingPolling';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import AnomalyAlertsWidget from '../components/AnomalyAlertsWidget';

const GuardianDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [guardianProfile, setGuardianProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [error, setError] = useState(null);
  const { pendingCount, pendingTransactions, loading: pollingLoading, error: pollingError } = usePendingPolling();
  const [managedAccountHolders, setManagedAccountHolders] = useState([]);
  const [newTransactionAlert, setNewTransactionAlert] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileRes = await axiosInstance.get('/auth/user/');
        const userData = profileRes.data.user || profileRes.data;
        setGuardianProfile(userData);
        // fetch managed account holders (could be from pending reviews or dedicated endpoint)
        const pendingRes = await axiosInstance.get('/guardian/pending-reviews/');
        const uniqueHolders = new Map();
        (pendingRes.data.pending_transactions || []).forEach(tx => {
          if (tx.account_holder_id && !uniqueHolders.has(tx.account_holder_id)) {
            uniqueHolders.set(tx.account_holder_id, { id: tx.account_holder_id, username: tx.account_holder || `User ${tx.account_holder_id}` });
          }
        });
        setManagedAccountHolders(Array.from(uniqueHolders.values()));
      } catch (err) {
        console.error('Failed to fetch guardian profile:', err);
        setError('Unable to load dashboard.');
      } finally {
        setLoadingProfile(false);
      }
    };
    fetchProfile();
  }, []);

  useEffect(() => {
    const handler = () => setNewTransactionAlert(true);
    window.addEventListener('new-pending-transactions', handler);
    return () => window.removeEventListener('new-pending-transactions', handler);
  }, []);

  if (loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">Loading...</div>
      </div>
    );
  }

  const firstAccountHolderId = managedAccountHolders.length > 0 ? managedAccountHolders[0].id : null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Guardian Dashboard</h1>
            <p className="text-gray-600">Welcome back, {guardianProfile?.username || user?.username || 'Guardian'}</p>
          </div>
        </div>

        {(error || pollingError) && (
          <div className="mb-6">
            <Alert type="error" message={error || pollingError} onDismiss={() => setError(null)} />
          </div>
        )}

        {newTransactionAlert && (
          <div className="mb-6">
            <Alert
              type="warning"
              message="New pending transaction received — review required."
              onDismiss={() => setNewTransactionAlert(false)}
            />
          </div>
        )}

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <Card title="Overview">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Total pending approvals:</span>
                <span className="text-2xl font-bold text-blue-600">{pendingCount}</span>
              </div>
            </div>
          </Card>
        </div>

        {firstAccountHolderId && (
          <div className="mb-6">
            <AnomalyAlertsWidget accountHolderId={firstAccountHolderId} />
          </div>
        )}

        <Card title="Recent Pending Transactions" className="mb-6">
          {pollingLoading ? (
            <p className="py-4 text-center text-gray-500">Loading...</p>
          ) : pendingTransactions.length === 0 ? (
            <p className="py-4 text-center text-gray-500">No transactions awaiting your review.</p>
          ) : (
            <div className="space-y-3">
              {pendingTransactions.slice(0, 5).map((tx) => (
                <div key={tx.pending_id} className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="font-medium text-gray-900">{tx.merchant || 'Unknown merchant'}</div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div className="font-semibold text-gray-900">
                      {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(tx.amount)}
                    </div>
                    <span className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">Pending</span>
                  </div>
                </div>
              ))}
              {pendingTransactions.length > 5 && <p className="text-center text-sm text-gray-500">+{pendingTransactions.length - 5} more pending</p>}
            </div>
          )}
        </Card>

        <div className="grid gap-3 sm:grid-cols-3">
          <Button variant="primary" onClick={() => navigate('/guardian/approvals')} className="w-full">Review Approvals</Button>
          <Button variant="primary" onClick={() => navigate('/guardian/whitelist')} className="w-full">Manage Whitelist</Button>
          <Button variant="primary" onClick={() => navigate('/guardian/limits')} className="w-full">Manage Limits</Button>
        </div>
      </div>
    </div>
  );
};

export default GuardianDashboard;