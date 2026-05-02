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
  const [merchantSearch, setMerchantSearch] = useState('');
  const [selectedBusiness, setSelectedBusiness] = useState(null);
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingMessage, setPendingMessage] = useState('');
  const [allBusinesses, setAllBusinesses] = useState([]);

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

  useEffect(() => {
    const fetchBusinesses = async () => {
      try {
        const res = await axiosInstance.get('/businesses/');
        const nonSanctioned = res.data.filter(biz => !biz.sanctioned);
        setAllBusinesses(nonSanctioned);
      } catch (err) {
        console.error('Failed to fetch businesses:', err);
      }
    };
    fetchBusinesses();
  }, []);

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
    setMerchantSearch(business.name);
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

    if (!currentAccount) { setError('No valid account selected.'); return; }
    if (!selectedBusiness) { setError('Please select a merchant from the list.'); return; }
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
      if (response.status === 201) {
        setSuccessMessage(`Payment of £${payload.amount} to ${selectedBusiness.name} was successful.`);
        setAmount('');
        setSelectedBusiness(null);
        setMerchantSearch('');
        setTimeout(() => setSuccessMessage(''), 5000);
      }
    } catch (err) {
      const data = err.response?.data;
      const status = err.response?.status;
      if (status === 400 && data?.status === 'PENDING') {
        setPendingMessage(data.message || 'This transaction requires guardian approval.');
        setShowPendingModal(true);
      } else if (status === 400 && data?.status === 'REJECTED') {
        setError(data.message || 'Transaction was rejected by the permission engine.');
      } else {
        setError(data?.message || data?.error || 'Transaction failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const inputClasses = "w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#C9992A] focus:outline-none focus:ring-2 focus:ring-[#C9992A] focus:ring-offset-2";

  if (loadingAccounts) {
    return (
      <output className="text-center block" aria-label="Loading account information">
        <div className="mb-4 text-gray-600" aria-hidden="true">Loading account information...</div>
        <div
          className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto"
          aria-hidden="true"
        ></div>
      </output>
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
            <div
              className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800"
              aria-label={`Paying from ${currentAccount.name}`}
            >
              Paying from: <strong>{currentAccount.name}</strong>
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate aria-label="Make a payment form">
            <div className="mb-4">
              <label htmlFor="merchantSearch" className="mb-1 block text-sm font-medium text-gray-700">
                Merchant <span aria-hidden="true">*</span>
                <span className="sr-only">(required)</span>
              </label>
              <input
                id="merchantSearch"
                type="text"
                value={merchantSearch}
                onChange={(e) => {
                  setMerchantSearch(e.target.value);
                  if (selectedBusiness) setSelectedBusiness(null);
                }}
                placeholder="Type at least 2 characters to search..."
                className={inputClasses}
                disabled={submitting}
                aria-required="true"
                aria-autocomplete="list"
                aria-controls="merchant-listbox"
                autoComplete="off"
              />
              {merchantSearch.length >= 2 && filteredBusinesses.length > 0 && !selectedBusiness && (
                <ul
                  id="merchant-listbox"
                  className="mt-1 max-h-48 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg list-none p-0"
                  aria-label="Matching merchants"
                >
                  {filteredBusinesses.map((biz) => (
                    <li
                      key={biz.id}
                      className="cursor-pointer px-3 py-2 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                      onClick={() => handleSelectBusiness(biz)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSelectBusiness(biz)}
                      tabIndex={0}
                    >
                      <div className="font-medium">{biz.name}</div>
                      <div className="text-xs text-gray-500">{biz.category}</div>
                    </li>
                  ))}
                </ul>
              )}
              {merchantSearch.length >= 2 && filteredBusinesses.length === 0 && !selectedBusiness && (
                <output className="mt-1 text-sm text-gray-500 block">
                  No matching merchants found.
                </output>
              )}
              {selectedBusiness && (
                <div
                  className="mt-1 flex items-center justify-between rounded-md bg-gray-100 px-3 py-2"
                  aria-live="polite"
                >
                  <span>Selected: <strong>{selectedBusiness.name}</strong> ({selectedBusiness.category})</span>
                  <button
                    type="button"
                    onClick={() => { setSelectedBusiness(null); setMerchantSearch(''); }}
                    className="text-sm text-red-600 hover:underline focus:outline-none focus:ring-2 focus:ring-[#C9992A] focus:ring-offset-2 rounded"
                    aria-label={`Remove selected merchant ${selectedBusiness.name}`}
                  >
                    Change
                  </button>
                </div>
              )}
            </div>

            <div className="mb-4">
              <label htmlFor="amount" className="mb-1 block text-sm font-medium text-gray-700">
                Amount (£) <span aria-hidden="true">*</span>
                <span className="sr-only">(required)</span>
              </label>
              <input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={inputClasses}
                disabled={submitting}
                aria-required="true"
                aria-label="Payment amount in pounds"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={submitting}
              disabled={submitting || !currentAccount || !selectedBusiness || !amount}
              className="w-full"
              aria-label="Submit payment"
            >
              Pay Now
            </Button>
          </form>
        </Card>
      </div>

      <Modal
        isOpen={showPendingModal}
        onClose={() => setShowPendingModal(false)}
        title="Awaiting Guardian Approval"
      >
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
                setAmount('');
                setSelectedBusiness(null);
                setMerchantSearch('');
              }}
              aria-label="Acknowledge and close"
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