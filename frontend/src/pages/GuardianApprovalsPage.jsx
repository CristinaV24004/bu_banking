// src/pages/GuardianApprovalsPage.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../api/axiosInstance';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import Modal from '../components/ui/Modal';

const GuardianApprovalsPage = () => {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Modal state
  const [selectedTx, setSelectedTx] = useState(null);
  const [modalAction, setModalAction] = useState(null); // 'approve' or 'reject'
  const [notes, setNotes] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchPendingTransactions = async () => {
    try {
      setError(null);
      const response = await axiosInstance.get('/guardian/pending-reviews/');
      const data = response.data.pending_transactions || [];
      setTransactions(data);
    } catch (err) {
      console.error('Failed to fetch pending transactions:', err);
      setError('Unable to load pending approvals. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingTransactions();
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

  const openModal = (transaction, action) => {
    setSelectedTx(transaction);
    setModalAction(action);
    setNotes('');
    setModalError('');
  };

  const closeModal = () => {
    setSelectedTx(null);
    setModalAction(null);
    setNotes('');
    setModalError('');
    setModalLoading(false);
  };

  const handleConfirm = async () => {
    if (!selectedTx) return;
    setModalLoading(true);
    setModalError('');

    const { pending_id } = selectedTx;
    const payload = { pending_id, notes };

    try {
      if (modalAction === 'approve') {
        // Approve endpoint
        await axiosInstance.post('/guardian/approve-transaction/', payload);
      } else if (modalAction === 'reject') {
        // Try reject endpoint; if 404, fallback to approve with reject flag
        try {
          await axiosInstance.post('/guardian/reject-transaction/', payload);
        } catch (rejectErr) {
          if (rejectErr.response?.status === 404) {
            // Fallback: use approve endpoint with a rejected flag
            await axiosInstance.post('/guardian/approve-transaction/', {
              ...payload,
              status: 'rejected',
            });
          } else {
            throw rejectErr;
          }
        }
      }

      // Success: remove transaction from list
      setTransactions((prev) => prev.filter((tx) => tx.pending_id !== pending_id));
      setSuccessMessage(
        `Transaction ${modalAction === 'approve' ? 'approved' : 'rejected'} successfully.`
      );
      closeModal();
      // Clear success after 5 seconds
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error(`Failed to ${modalAction} transaction:`, err);
      setModalError(err.response?.data?.message || err.response?.data?.error || 'Operation failed. Please try again.');
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-gray-600">Loading approval queue...</div>
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

        <Card title="Pending Approvals">
          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} onDismiss={() => setError(null)} />
            </div>
          )}
          {successMessage && (
            <div className="mb-4">
              <Alert
                type="success"
                message={successMessage}
                onDismiss={() => setSuccessMessage('')}
              />
            </div>
          )}

          {!error && transactions.length === 0 ? (
            <p className="py-8 text-center text-gray-500">
              No pending transactions requiring your review.
            </p>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div
                  key={tx.pending_id}
                  className="flex flex-wrap items-center justify-between rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {tx.merchant || 'Unknown merchant'}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatCurrency(tx.amount)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="mr-2 inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">
                      Pending
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => openModal(tx, 'approve')}
                      className="px-3 py-1 text-sm"
                    >
                      Approve
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => openModal(tx, 'reject')}
                      className="px-3 py-1 text-sm"
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Approval/Rejection Modal */}
      {selectedTx && modalAction && (
        <Modal
          isOpen={true}
          onClose={closeModal}
          title={modalAction === 'approve' ? 'Approve Transaction' : 'Reject Transaction'}
        >
          <div className="space-y-4">
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-sm text-gray-600">Merchant:</p>
              <p className="font-medium">{selectedTx.merchant || 'Unknown'}</p>
              <p className="mt-2 text-sm text-gray-600">Amount:</p>
              <p className="font-medium">{formatCurrency(selectedTx.amount)}</p>
            </div>

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Notes (optional)
              </label>
              <textarea
                id="notes"
                rows="3"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                placeholder="Add any comments..."
                disabled={modalLoading}
              />
            </div>

            {modalError && (
              <Alert type="error" message={modalError} onDismiss={() => setModalError('')} />
            )}

            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={closeModal} disabled={modalLoading}>
                Cancel
              </Button>
              <Button
                variant={modalAction === 'approve' ? 'primary' : 'danger'}
                loading={modalLoading}
                onClick={handleConfirm}
              >
                Confirm {modalAction === 'approve' ? 'Approval' : 'Rejection'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default GuardianApprovalsPage;