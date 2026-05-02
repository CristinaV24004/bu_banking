import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../api/axiosInstance';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

const PendingPage = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPending = async () => {
      try {
        setError(null);
        const response = await axiosInstance.get('/guardian/my-pending/');
        const pendingList = response.data.pending_transactions || [];
        setTransactions(pendingList);
      } catch (err) {
        console.error('Failed to fetch pending transactions:', err);
        setError('Unable to load pending transactions. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };
    fetchPending();
  }, []);

  const formatCurrency = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '£0.00';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP', minimumFractionDigits: 2,
    }).format(num);
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Date pending';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return (
      <span
        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusMap[status] || 'bg-gray-100 text-gray-800'}`}
        aria-label={`Status: ${status}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <output className="text-center block" aria-label="Loading pending transactions">
          <div className="mb-4 text-gray-600" aria-hidden="true">Loading pending transactions...</div>
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto"
            aria-hidden="true"
          ></div>
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
            onClick={() => navigate('/dashboard')}
            className="w-full sm:w-auto"
            aria-label="Back to Dashboard"
          >
            ← Back to Dashboard
          </Button>
        </div>

        <Card title="My Transactions">
          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} onDismiss={() => setError(null)} />
            </div>
          )}
          {!error && transactions.length === 0 ? (
            <p className="py-8 text-center text-gray-500">
              You have no transactions awaiting approval.
            </p>
          ) : (
            <>
              <div className="mb-3 text-sm text-gray-500" aria-live="polite">
                Total transactions: {transactions.length}
              </div>
              <ul className="space-y-3 list-none p-0" aria-label="Pending transactions">
                {transactions.map((tx) => (
                  <li
                    key={tx.pending_id}
                    className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                    aria-label={`Pending transaction: ${tx.merchant || 'Unknown merchant'}, ${formatCurrency(tx.amount)}`}
                  >
                    <div>
                      <div className="font-medium text-gray-900">
                        {tx.merchant || 'Unknown merchant'}
                      </div>
                      <time
                        className="text-xs text-gray-500"
                        dateTime={tx.created_at || undefined}
                      >
                        {formatDate(tx.created_at)}
                      </time>
                      {tx.guardian_notes && (
                        <div className="mt-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
                          <span className="font-medium">Guardian note: </span>{tx.guardian_notes}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div
                        className="font-semibold text-gray-900"
                        aria-label={`Amount: ${formatCurrency(tx.amount)}`}
                      >
                        {formatCurrency(tx.amount)}
                      </div>
                        {getStatusBadge(tx.status)} 
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default PendingPage;