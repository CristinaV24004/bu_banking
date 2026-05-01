import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../api/axiosInstance';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

const TransactionsPage = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [setAccounts] = useState([]);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setError(null);
        const accountsRes = await axiosInstance.get('/accounts/');
        let userAccounts = accountsRes.data;
        if (!userAccounts || userAccounts.length === 0) {
          setError('No accounts found.');
          setLoading(false);
          return;
        }
        setAccounts(userAccounts);
        const currentAccount = userAccounts.find(acc => acc.account_type === 'current') || userAccounts[0];
        setSelectedAccount(currentAccount);
        await fetchTransactions(currentAccount.id);
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
        setError('Unable to load accounts. Please refresh the page.');
        setLoading(false);
      }
    };
    const fetchTransactions = async (accountId) => {
      try {
        setLoading(true);
        const txRes = await axiosInstance.get(`/transactions/account/${accountId}/`);
        const sorted = [...txRes.data].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        setTransactions(sorted);
      } catch (err) {
        console.error('Failed to fetch transactions:', err);
        setError('Unable to load transaction history.');
      } finally {
        setLoading(false);
      }
    };
    fetchAccounts();
  }, []);

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '£0.00';
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(num);
  };

  const getStatusBadge = (paymentStatus) => {
    const statusMap = {
      local_processed: { label: 'Approved', color: 'bg-green-100 text-green-800' },
      local_pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
      rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800' },
    };
    const status = statusMap[paymentStatus] || { label: 'Unknown', color: 'bg-gray-100 text-gray-800' };
    return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${status.color}`}>{status.label}</span>;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-gray-600">Loading transactions...</div>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="w-full sm:w-auto">
            ← Back to Dashboard
          </Button>
        </div>

        <Card title="Transaction History" className="w-full">
          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} onDismiss={() => setError(null)} />
            </div>
          )}

          {selectedAccount && (
            <p className="mb-4 text-sm text-gray-600">
              Showing transactions for: <span className="font-medium">{selectedAccount.name}</span>
            </p>
          )}

          {!error && transactions.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No transactions found for this account.</p>
          ) : (
            <>
              <div className="mb-3 text-sm text-gray-500">Total transactions: {transactions.length}</div>
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{tx.merchant_name || tx.transaction_type || 'Transaction'}</div>
                      <div className="text-xs text-gray-500">{formatDate(tx.timestamp)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="font-semibold text-gray-900">{formatCurrency(tx.amount)}</div>
                      {getStatusBadge(tx.payment_status)}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default TransactionsPage;