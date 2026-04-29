// src/pages/NewPaymentPage.jsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../api/axiosInstance';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import Modal from '../components/ui/Modal';

const NewPaymentPage = () => {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [error, setError] = useState(null);

  // Form state
  const [merchantSearch, setMerchantSearch] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Modal state for pending approval
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');

  // All businesses (filtered to non-sanctioned)
  const [allBusinesses, setAllBusinesses] = useState([]);
  const [loadingBusinesses, setLoadingBusinesses] = useState(false);

  // Fetch accounts on mount
  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setError(null);
        const res = await axiosInstance.get('/accounts/');
        let userAccounts = res.data;
        if (!userAccounts || userAccounts.length === 0) {
          setError('No accounts found. Please contact support.');
          setLoadingAccounts(false);
          return;
        }
        setAccounts(userAccounts);
        // Find first account with type 'current', otherwise first account
        const currentAcc = userAccounts.find(acc => acc.account_type === 'current') || userAccounts[0];
        setCurrentAccount(currentAcc);
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
        setError('Unable to load your account.');
      } finally {
        setLoadingAccounts(false);
      }
    };
    fetchAccounts();
  }, []);

  // Fetch businesses (non-sanctioned only) once
  useEffect(() => {
    const fetchBusinesses = async () => {
      setLoadingBusinesses(true);
      try {
        const res = await axiosInstance.get('/businesses/');
        // Filter out sanctioned businesses
        const nonSanctioned = res.data.filter(biz => !biz.sanctioned);
        setAllBusinesses(nonSanctioned);
      } catch (err) {
        console.error('Failed to fetch businesses:', err);
        // Non-critical, just show error on search maybe
      } finally {
        setLoadingBusinesses(false);
      }
    };
    fetchBusinesses();
  }, []);

  // Filter businesses based on search (min 2 chars, case-insensitive)
  const filteredBusinesses = useMemo(() => {
    if (merchantSearch.length < 2) return [];
    const searchLower = merchantSearch.toLowerCase();
    return allBusinesses.filter(biz =>
      biz.name.toLowerCase().includes(searchLower) ||
      biz.category.toLowerCase().includes(searchLower)
    );
  }, [merchantSearch, allBusinesses]);

  const handleSelectBusiness = (business) => {
    setSelectedBusiness(business);
    setMerchantSearch(business.name); // show selected name in input
  };

  const validateAmount = (value) => {
    const regex = /^\d+(\.\d{0,2})?$/;
    const num = parseFloat(value);
    return regex.test(value) && num > 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage('');
    setPendingMessage('');
    setShowPendingModal(false);

    if (!currentAccount) {
      setError('No valid account selected.');
      return;
    }
    if (!selectedBusiness) {
      setError('Please select a merchant from the list.');
      return;
    }
    if (!amount || !validateAmount(amount)) {
      setError('Please enter a valid amount (positive number with up to 2 decimal places).');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        transaction_type: 'payment',
        amount: parseFloat(amount).toFixed(2),
        from_account: currentAccount.id,
        merchant_name: selectedBusiness.name,
      };
      const response = await axiosInstance.post('/transactions/', payload);

      // 201 Created => APPROVED
      if (response.status === 201) {
        setSuccessMessage(`Payment of £${payload.amount} to ${selectedBusiness.name} was successful.`);
        // Reset form
        setAmount('');
        setSelectedBusiness(null);
        setMerchantSearch('');
        // Clear success after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) {
      const data = err.response?.data;
      const status = err.response?.status;

      if (status === 400) {
        // Check if it's PENDING or REJECTED based on response data
        if (data && data.status === 'PENDING') {
          // Show modal
          setPendingMessage(data.message || 'This transaction requires guardian approval.');
          setShowPendingModal(true);
        } else if (data && data.status === 'REJECTED') {
          setError(data.message || 'Transaction was rejected by the permission engine.');
        } else {
          // Generic error
          setError(data?.message || data?.error || 'Transaction failed. Please try again.');
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingAccounts) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-gray-600">Loading account information...</div>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-2xl">
        {/* Back button */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/dashboard')}>
            ← Back to Dashboard
          </Button>
        </div>

        <Card title="Make a Payment">
          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} onDismiss={() => setError(null)} />
            </div>
          )}
          {successMessage && (
            <div className="mb-4">
              <Alert type="success" message={successMessage} onDismiss={() => setSuccessMessage('')} />
            </div>
          )}

          {currentAccount && (
            <div className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
              Paying from: <strong>{currentAccount.name}</strong> (Balance:
              £{Number.parseFloat(currentAccount.starting_balance).toFixed(2)})
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Merchant search with dropdown */}
            <div className="mb-4">
              <label htmlFor="merchantSearch" className="mb-1 block text-sm font-medium text-gray-700">
                Merchant *
              </label>
              <input
                id="merchantSearch"
                type="text"
                value={merchantSearch}
                onChange={(e) => {
                  setMerchantSearch(e.target.value);
                  if (selectedBusiness) setSelectedBusiness(null); // clear selection if search changes
                }}
                placeholder="Type at least 2 characters to search..."
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                disabled={submitting}
              />
              {merchantSearch.length >= 2 && filteredBusinesses.length > 0 && !selectedBusiness && (
                <ul className="mt-1 max-h-48 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
                  {filteredBusinesses.map((biz) => (
                    <button
                      key={biz.id}
                      className="cursor-pointer px-3 py-2 hover:bg-gray-100"
                      onClick={() => handleSelectBusiness(biz)}
                    >
                      <div className="font-medium">{biz.name}</div>
                      <div className="text-xs text-gray-500">{biz.category}</div>
                    </button>
                  ))}
                </ul>
              )}
              {merchantSearch.length >= 2 && filteredBusinesses.length === 0 && !selectedBusiness && (
                <p className="mt-1 text-sm text-gray-500">No matching merchants found.</p>
              )}
              {selectedBusiness && (
                <div className="mt-1 flex items-center justify-between rounded-md bg-gray-100 px-3 py-2">
                  <span>
                    Selected: <strong>{selectedBusiness.name}</strong> ({selectedBusiness.category})
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBusiness(null);
                      setMerchantSearch('');
                    }}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            {/* Amount field */}
            <div className="mb-4">
              <label htmlFor="amount" className="mb-1 block text-sm font-medium text-gray-700">
                Amount (£) *
              </label>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                disabled={submitting}
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={submitting || !currentAccount || !selectedBusiness || !amount}
              className="w-full"
            >
              Pay Now
            </Button>
          </form>
        </Card>
      </div>

      {/* Pending Approval Modal */}
      <Modal isOpen={showPendingModal} onClose={() => setShowPendingModal(false)} title="Awaiting Guardian Approval">
        <div className="space-y-4">
          <p className="text-gray-700">
            {pendingMessage || 'This transaction has been sent to your guardian for approval.'}
          </p>
          <p className="text-sm text-gray-500">
            You will be notified once a decision is made. No money has been moved yet.
          </p>
          <div className="flex justify-end">
            <Button
              variant="primary"
              onClick={() => {
                setShowPendingModal(false);
                // Optionally reset form
                setAmount('');
                setSelectedBusiness(null);
                setMerchantSearch('');
                navigate('/dashboard');
              }}
            >
              OK
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default NewPaymentPage;