// src/pages/GuardianTransactionsPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../api/axiosInstance';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

const GuardianTransactionsPage = () => {
  const navigate = useNavigate();
  const [managedAccounts, setManagedAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch managed accounts on mount
  useEffect(() => {
    const fetchManagedAccounts = async () => {
      try {
        setError(null);
        const response = await axiosInstance.get('/guardian/managed-accounts/');
        let accounts = response.data.managed_accounts || [];
        
        setManagedAccounts(accounts);
        if (accounts.length > 0) {
          setSelectedAccountId(accounts[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch managed accounts:', err);
        setError('Unable to load managed accounts.');
      } finally {
        setLoading(false);
      }
    };
    fetchManagedAccounts();
  }, []);

  // Fetch transactions when selected account changes
  useEffect(() => {
    if (!selectedAccountId) return;
    const fetchTransactions = async () => {
      try {
        setError(null);
        setLoading(true);
        const response = await axiosInstance.get(`/guardian/${selectedAccountId}/activity-feed/`);
        const feed = response.data.feed || [];
        setTransactions(feed);
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
        setError('Unable to load transaction history.');
      } finally {
        setLoading(false);
      }
    };
    fetchTransactions();
  }, [selectedAccountId]);

  const formatCurrency = (amount) => {
    const num = Number.parseFloat(amount);
    if (Number.isNaN(num)) return '£0.00';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(num);
  };

  if (loading && managedAccounts.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-gray-600">Loading...</div>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        {/* Back button */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/guardian')}>
            ← Back to Dashboard
          </Button>
        </div>

        <Card title="Transaction History">
          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} onDismiss={() => setError(null)} />
            </div>
          )}

          {managedAccounts.length === 0 ? (
            <p className="py-4 text-center text-gray-500">No managed account holders found.</p>
          ) : (
            <>
              <div className="mb-4">
                <label htmlFor="accountSelect" className="block text-sm font-medium text-gray-700 mb-1">
                  Account Holder
                </label>
                <select
                  id="accountSelect"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                >
                  {managedAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.username}
                    </option>
                  ))}
                </select>
              </div>

              {loading && (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                </div>
              )}

              {!loading && transactions.length === 0 ? (
                <p className="py-8 text-center text-gray-500">No transactions found for this account holder.</p>
              ) : (
                !loading && (
                  <div className="space-y-3">
                    {transactions.map((tx, idx) => (
                      <div
                        key={tx.id || idx}
                        className="flex flex-wrap items-center justify-between rounded-lg border border-gray-100 bg-white p-4 shadow-sm"
                      >
                        <div className="font-medium text-gray-900">
                          {tx.merchant || tx.transaction_type || 'Unknown'}
                        </div>
                        <div className="font-semibold text-gray-900">
                          {formatCurrency(tx.amount)}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default GuardianTransactionsPage;