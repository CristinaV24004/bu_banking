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

  useEffect(() => {
    const fetchManagedAccounts = async () => {
      try {
        setError(null);
        const userRes = await axiosInstance.get('/auth/user/');
        const accounts = userRes.data.managed_accounts || [];
        setManagedAccounts(accounts);
        if (accounts.length > 0) setSelectedAccountId(accounts[0].id);
      } catch (err) {
        console.error('Failed to fetch managed accounts:', err);
        setError('Unable to load managed accounts.');
      } finally {
        setLoading(false);
      }
    };
    fetchManagedAccounts();
  }, []);

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
    const num = parseFloat(amount);
    if (isNaN(num)) return '£0.00';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP', minimumFractionDigits: 2,
    }).format(num);
  };

  if (loading && managedAccounts.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <output className="text-center block" aria-label="Loading transactions">
          <div aria-hidden="true">Loading...</div>
        </output>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/guardian')}
            className="w-full sm:w-auto"
            aria-label="Back to Guardian Dashboard"
          >
            ← Back to Dashboard
          </Button>
        </div>

        <Card title="Transaction History">
          {error && <Alert type="error" message={error} onDismiss={() => setError(null)} />}

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
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#C9992A] focus:outline-none focus:ring-2 focus:ring-[#C9992A] focus:ring-offset-2"
                  aria-label="Select account holder to view transactions"
                >
                  {managedAccounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.username}</option>
                  ))}
                </select>
              </div>

              {loading && (
                <div className="flex justify-center py-8">
                  <output aria-label="Loading transaction history">
                    <div
                      className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"
                      aria-hidden="true"
                    ></div>
                  </output>
                </div>
              )}

              {!loading && transactions.length === 0 && (
                <p className="py-8 text-center text-gray-500">
                  No transactions found for this account holder.
                </p>
              )}

              {!loading && transactions.length > 0 && (
                <ul className="space-y-3 list-none p-0" aria-label="Transaction history">
                  {transactions.map((tx, idx) => (
                    <li
                      key={tx.id || idx}
                      className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                      aria-label={`Transaction: ${tx.merchant || 'Unknown merchant'}, ${formatCurrency(tx.amount)}`}
                    >
                      <div className="font-medium text-gray-900">
                        {tx.merchant || 'Unknown merchant'}
                      </div>
                      <div
                        className="font-semibold text-gray-900"
                        aria-label={`Amount: ${formatCurrency(tx.amount)}`}
                      >
                        {formatCurrency(tx.amount)}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default GuardianTransactionsPage;