import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { axiosInstance } from '../api/axiosInstance';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import SafeSpendWidget from '../components/SafeSpendWidget';

const AccHolderDashboard = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAccountsAndBalances = async () => {
      try {
        setError(null);
        setLoading(true);

        const accountsRes = await axiosInstance.get('/accounts/');
        const accountsData = accountsRes.data;

        const accountsWithBalances = await Promise.all(
          accountsData.map(async (account) => {
            try {
              const balanceRes = await axiosInstance.get(
                `/accounts/${account.id}/current-balance/`
              );
              return {
                ...account,
                current_balance: balanceRes.data.current_balance,
              };
            } catch (balanceErr) {
              console.error(`Failed to fetch balance for account ${account.id}:`, balanceErr);
              return {
                ...account,
                current_balance: '0.00',
                balanceError: true,
              };
            }
          })
        );

        setAccounts(accountsWithBalances);
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
        setError('Unable to load your accounts. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };

    fetchAccountsAndBalances();
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

  const formatAccountType = (type) => {
    const types = {
      current: 'Current Account',
      savings: 'Savings Account',
      credit: 'Credit Account',
      other: 'Account',
    };
    return types[type] || 'Account';
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-gray-600">Loading your accounts...</div>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.username || 'Account Holder'}
            </h1>
            <p className="text-gray-600">Here are your accounts and current balances</p>
          </div>
        </div>

        {/* Error alert */}
        {error && (
          <div className="mb-6">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {/* Accounts grid */}
        {accounts.length === 0 ? (
          <Card title="No Accounts" className="text-center text-gray-600">
            <p>You don't have any accounts yet.</p>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <Card
                key={account.id}
                title={account.name}
                className="transition-shadow hover:shadow-md"
              >
                <div className="space-y-2">
                  <div className="text-sm text-gray-500">
                    {formatAccountType(account.account_type)}
                  </div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatCurrency(account.current_balance)}
                  </div>
                  {account.balanceError && (
                    <div className="mt-2 text-xs text-red-600">
                      Balance could not be retrieved
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-6">
          <SafeSpendWidget userId={user?.userId} />
        </div>

        {/* Navigation actions */}
        <div className="mt-6 flex gap-4">
          <Button variant="primary" onClick={() => navigate('/transactions')}>
            View Transactions
          </Button>
          <Button variant="primary" onClick={() => navigate('/payment/new')}>
            Make a Payment
          </Button>
          <Button variant="primary" onClick={() => navigate('/pending')}>
            Pending Approvals
          </Button>
        </div>

      </div>
    </div>
  );
};

export default AccHolderDashboard;