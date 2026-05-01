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
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(num);
  };

  const formatDate = (isoString) => {
    if (!isoString) return 'Date pending';
    const date = new Date(isoString);
    return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-gray-600">Loading pending transactions...</div>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} className="w-full sm:w-auto">
            ← Back to Dashboard
          </Button>
        </div>

        <Card title="Pending Approvals">
          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} onDismiss={() => setError(null)} />
            </div>
          )}
          {!error && transactions.length === 0 ? (
            <p className="py-8 text-center text-gray-500">You have no transactions awaiting approval.</p>
          ) : (
            <>
              <div className="mb-3 text-sm text-gray-500">Total pending: {transactions.length}</div>
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.pending_id} className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{tx.merchant || 'Unknown merchant'}</div>
                      <div className="text-xs text-gray-500">{formatDate(tx.created_at)}</div>
                    </div>
                    <div className="flex items-center justify-between gap-3 sm:justify-end">
                      <div className="font-semibold text-gray-900">{formatCurrency(tx.amount)}</div>
                      <span className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">Awaiting Approval</span>
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

export default PendingPage;