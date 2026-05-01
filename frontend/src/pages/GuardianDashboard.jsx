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
  const [cardData, setCardData] = useState(null);
  const [cardError, setCardError] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileRes = await axiosInstance.get('/auth/user/');
        const userData = profileRes.data.user || profileRes.data;
        setGuardianProfile(userData);
        const pendingRes = await axiosInstance.get('/guardian/pending-reviews/');
        const uniqueHolders = new Map();
        (pendingRes.data.pending_transactions || []).forEach(tx => {
          if (tx.account_holder_id && !uniqueHolders.has(tx.account_holder_id)) {
            uniqueHolders.set(tx.account_holder_id, {
              id: tx.account_holder_id,
              username: tx.account_holder || `User ${tx.account_holder_id}`,
            });
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

    const fetchCards = async () => {
      try {
        const res = await axiosInstance.get('/cards/balance/');
        setCardData(res.data);
      } catch (err) {
        const message = err.response?.data?.error || 'Could not load card balances.';
        setCardError(message);
      }
    };
    fetchCards();

  useEffect(() => {
    const handler = () => setNewTransactionAlert(true);
    window.addEventListener('new-pending-transactions', handler);
    return () => window.removeEventListener('new-pending-transactions', handler);
  }, []);

  const renderPendingTransactions = () => {
    if (pollingLoading) {
      return (
        <output className="py-4 text-center block text-gray-500" aria-label="Loading transactions">
          Loading...
        </output>
      );
    }
    if (pendingTransactions.length === 0) {
      return (
        <p className="py-4 text-center text-gray-500">
          No transactions awaiting your review.
        </p>
      );
    }
    return (
      <>
        <ul className="space-y-3 list-none p-0" aria-label="Recent pending transactions">
          {pendingTransactions.slice(0, 5).map((tx) => (
            <li
              key={tx.pending_id}
              className="flex flex-col gap-3 rounded-lg border border-gray-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              aria-label={`Pending: ${tx.merchant || 'Unknown merchant'}, ${new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(tx.amount)}`}
            >
              <div className="font-medium text-gray-900">
                {tx.merchant || 'Unknown merchant'}
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <div className="font-semibold text-gray-900">
                  {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(tx.amount)}
                </div>
                <span
                  className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800"
                  aria-label="Status: Pending"
                >
                  Pending
                </span>
              </div>
            </li>
          ))}
        </ul>
        {pendingTransactions.length > 5 && (
          <p className="text-center text-sm text-gray-500" aria-live="polite">
            +{pendingTransactions.length - 5} more pending
          </p>
        )}
      </>
    );
  };

  if (loadingProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <output className="text-center block" aria-label="Loading dashboard">
          <div aria-hidden="true">Loading...</div>
        </output>
      </div>
    );
  }

  const firstAccountHolderId = managedAccountHolders.length > 0 ? managedAccountHolders[0].id : null;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">

        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Guardian Dashboard</h1>
            <p className="text-gray-600">
              Welcome back, {guardianProfile?.username || user?.username || 'Guardian'}
            </p>
          </div>
        </header>

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

        <section aria-label="Overview" className="mb-6 flex justify-center">
          <Card title="Overview" className="w-full max-w-sm">
            <div className="flex flex-col items-center gap-3 py-2">
              <span className="text-gray-600">Total pending approvals</span>
              <span
                className="text-4xl font-bold text-[#0D2B55]"
                aria-label={`${pendingCount} pending approvals`}
              >
                {pendingCount}
              </span>
            </div>
          </Card>
        </section>

        {firstAccountHolderId && (
          <div className="mb-6">
            <AnomalyAlertsWidget accountHolderId={firstAccountHolderId} />
          </div>
        )}

        <Card title="Recent Pending Transactions" className="mb-6">
          {renderPendingTransactions()}
        </Card>

        <nav className="grid gap-3 sm:grid-cols-3 mx-auto w-full" aria-label="Guardian actions">
          <Button
            variant="primary"
            onClick={() => navigate('/guardian/approvals')}
            className="w-full"
            aria-label="Review pending approvals"
          >
            Review Approvals
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/guardian/whitelist')}
            className="w-full"
            aria-label="Manage merchant whitelist"
          >
            Manage Whitelist
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/guardian/limits')}
            className="w-full"
            aria-label="Manage safe spend limits"
          >
            Manage Limits
          </Button>
        </nav>

        {/* NFC Cards */}
        <section aria-label="NFC card balances" className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-[#0D2B55]">Issued Cards</h2>
          {cardError && (
            <Alert type="error" message={cardError} />
          )}
          {cardData && (
            <>
              <div className="mb-4 flex justify-between text-sm text-[#4A5568]">
                <span>Total spendable: <strong className="text-[#0D2B55]">
                  £{cardData.current_spendable.toFixed(2)}
                </strong></span>
                <span>Cards issued: <strong className="text-[#0D2B55]">
                  {cardData.cards.length}
                </strong></span>
              </div>
              <ul className="grid gap-4 sm:grid-cols-2 list-none p-0">
                {cardData.cards
                  .filter(card => card.card_number.startsWith('3'))
                  .sort((a, b) => a.card_number.localeCompare(b.card_number))
                  .map((card) => (
                    <li key={card.card_number}>
                      <div className="rounded-lg border border-[#CBD5E1] bg-white p-4 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-cinzel text-sm text-[#4A5568]">
                            •••• {card.card_number.slice(-4)}
                          </span>
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${card.balance > 0
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                            }`}>
                            {card.balance > 0 ? 'Active' : 'Spent'}
                          </span>
                        </div>
                        <div className="mt-2 text-2xl font-bold text-[#0D2B55]">
                          £{card.balance.toFixed(2)}
                        </div>
                        <div className="mt-1 text-xs text-[#4A5568]">
                          of £{card.starting_balance.toFixed(2)} starting balance
                        </div>
                      </div>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>

    
  );
};

export default GuardianDashboard;