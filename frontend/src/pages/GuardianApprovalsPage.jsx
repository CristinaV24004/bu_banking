import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../api/axiosInstance';
import { usePendingPolling } from '../hooks/usePendingPolling';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import Modal from '../components/ui/Modal';

const GuardianApprovalsPage = () => {
  const navigate = useNavigate();
  const { pendingTransactions, loading, error: pollingError } = usePendingPolling();
  const [localTransactions, setLocalTransactions] = useState([]);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedTx, setSelectedTx] = useState(null);
  const [modalAction, setModalAction] = useState(null);
  const [notes, setNotes] = useState('');
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    setLocalTransactions(pendingTransactions);
  }, [pendingTransactions]);

  const removeTransaction = (pendingId) => {
    setLocalTransactions(prev => prev.filter(tx => tx.pending_id !== pendingId));
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
        await axiosInstance.post('/guardian/approve-transaction/', payload);
      } else {
        try {
          await axiosInstance.post('/guardian/reject-transaction/', payload);
        } catch (rejectErr) {
          if (rejectErr.response?.status === 404) {
            setModalError('Reject endpoint not available. Please contact support.');
          } else {
            throw rejectErr;
          }
        }
      }
      removeTransaction(pending_id);
      setSuccessMessage(`Transaction ${modalAction === 'approve' ? 'approved' : 'rejected'} successfully.`);
      setTimeout(() => setSuccessMessage(''), 5000);
      closeModal();
    } catch (err) {
      setModalError(err.response?.data?.message || 'Operation failed. Please try again.');
    } finally {
      setModalLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    const num = parseFloat(amount);
    if (isNaN(num)) return '£0.00';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency', currency: 'GBP', minimumFractionDigits: 2,
    }).format(num);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <output className="text-center block" aria-label="Loading approvals">
          <div className="mb-4 text-gray-600" aria-hidden="true">Loading approvals...</div>
          <div
            className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mx-auto"
            aria-hidden="true"
          ></div>
        </output>
      </div>
    );
  }

  const modalTitle = modalAction === 'approve' ? 'Approve Transaction' : 'Reject Transaction';

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

        <Card title="Pending Approvals">
          {pollingError && (
            <Alert type="error" message={pollingError} onDismiss={() => { }} />
          )}
          {successMessage && (
            <Alert
              type="success"
              message={successMessage}
              onDismiss={() => setSuccessMessage('')}
            />
          )}

          {localTransactions.length === 0 ? (
            <p className="py-8 text-center text-gray-500">
              No pending transactions requiring your review.
            </p>
          ) : (
            <ul className="space-y-4 list-none p-0" aria-label="Transactions requiring approval">
              {localTransactions.map((tx) => (
                <li
                  key={tx.pending_id}
                  className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
                  aria-label={`Transaction from ${tx.merchant || 'Unknown merchant'} for ${formatCurrency(tx.amount)}`}
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {tx.merchant || 'Unknown merchant'}
                    </div>
                    <div
                      className="text-sm text-gray-500"
                      aria-label={`Amount: ${formatCurrency(tx.amount)}`}
                    >
                      {formatCurrency(tx.amount)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800"
                      aria-label="Status: Pending review"
                    >
                      Pending
                    </span>
                    <div className="flex flex-1 justify-end gap-2">
                      <Button
                        variant="primary"
                        onClick={() => openModal(tx, 'approve')}
                        className="px-3 py-1 text-sm"
                        aria-label={`Approve transaction from ${tx.merchant || 'Unknown merchant'}`}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => openModal(tx, 'reject')}
                        className="px-3 py-1 text-sm"
                        aria-label={`Reject transaction from ${tx.merchant || 'Unknown merchant'}`}
                      >
                        Reject
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {selectedTx && modalAction && (
        <Modal isOpen={true} onClose={closeModal} title={modalTitle}>
          <div className="space-y-4">
            <div className="rounded-md bg-gray-50 p-3" aria-label="Transaction details">
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
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#C9992A] focus:outline-none focus:ring-2 focus:ring-[#C9992A] focus:ring-offset-2"
                disabled={modalLoading}
                aria-label="Add notes for this decision"
              />
            </div>
            {modalError && <Alert type="error" message={modalError} />}
            <div className="flex justify-end gap-3">
              <Button
                variant="ghost"
                onClick={closeModal}
                disabled={modalLoading}
                aria-label="Cancel and close"
              >
                Cancel
              </Button>
              <Button
                variant={modalAction === 'approve' ? 'primary' : 'danger'}
                loading={modalLoading}
                onClick={handleConfirm}
                aria-label={`Confirm ${modalAction === 'approve' ? 'approval' : 'rejection'} of transaction`}
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