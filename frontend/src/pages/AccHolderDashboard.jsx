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
              return { ...account, current_balance: balanceRes.data.current_balance };
            } catch (balanceErr) {
              console.error(`Failed to fetch balance for account ${account.id}:`, balanceErr);
              return { ...account, current_balance: '0.00', balanceError: true };
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
        <output className="text-center block" aria-label="Loading your accounts">
          <div className="mb-4 text-gray-600" aria-hidden="true">Loading your accounts...</div>
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto"
            aria-hidden="true"
          ></div>
        </output>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-4 md:py-6">
      <div className="mx-auto max-w-4xl w-full">

        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between w-full">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.username || 'Account Holder'}
            </h1>
            <p className="text-gray-600">Here are your accounts and current balances</p>
          </div>
        </header>

        {error && (
          <div className="mb-6">
            <Alert type="error" message={error} onDismiss={() => setError(null)} />
          </div>
        )}

        <section aria-label="Your accounts" className="w-full mb-12">
          {accounts.length === 0 ? (
            <Card title="No Accounts" className="text-center text-gray-600">
              <p>You don't have any accounts yet.</p>
            </Card>
          ) : (
              <ul className="grid gap-6 sm:grid-cols-2 list-none p-0 w-full max-w-2xl mx-auto">
                {accounts.map((account) => (
                  <li key={account.id} className="flex justify-center w-full">
                    <Card
                      title={account.name}
                      className="transition-shadow hover:shadow-md h-full w-full max-w-sm"
                    >
                    <div className="space-y-2">
                      <div className="text-sm text-gray-500">
                        {formatAccountType(account.account_type)}
                      </div>
                      <div
                        className="text-2xl font-bold text-gray-900"
                        aria-label={`Balance: ${formatCurrency(account.current_balance)}`}
                      >
                        {formatCurrency(account.current_balance)}
                      </div>
                      {account.balanceError && (
                        <div className="mt-2 text-xs text-red-600" role="alert">
                          Balance could not be retrieved
                        </div>
                      )}
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="mt-6">
          <SafeSpendWidget userId={user?.userId} />
        </div>

        <nav className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center" aria-label="Account actions">
          <Button
            variant="primary"
            onClick={() => navigate('/payment/new')}
            className="w-full sm:w-auto"
            aria-label="Make a new payment"
          >
            Make a Payment
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/pending')}
            className="w-full sm:w-auto"
            aria-label="View my transactions"
          >
            Pending Approvals
          </Button>
        </nav>

      </div>
    </div>
  );
};

export default AccHolderDashboard;