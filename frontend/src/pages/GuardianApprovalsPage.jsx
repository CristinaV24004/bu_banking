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
            setModalError('Reject endpoint not available. Please contact support.')
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
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: 2 }).format(num);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-gray-600">Loading approvals...</div>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/guardian')} className="w-full sm:w-auto">
            ← Back to Dashboard
          </Button>
        </div>

        <Card title="Pending Approvals">
          {pollingError && <Alert type="error" message={pollingError} onDismiss={() => { }} />}
          {successMessage && <Alert type="success" message={successMessage} onDismiss={() => setSuccessMessage('')} />}

          {localTransactions.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No pending transactions requiring your review.</p>
          ) : (
            <div className="space-y-4">
              {localTransactions.map((tx) => (
                <div key={tx.pending_id} className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                  <div>
                    <div className="font-medium text-gray-900">{tx.merchant || 'Unknown merchant'}</div>
                    <div className="text-sm text-gray-500">{formatCurrency(tx.amount)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-800">Pending</span>
                    <div className="flex flex-1 justify-end gap-2">
                      <Button variant="primary" size="sm" onClick={() => openModal(tx, 'approve')} className="px-3 py-1 text-sm">Approve</Button>
                      <Button variant="danger" size="sm" onClick={() => openModal(tx, 'reject')} className="px-3 py-1 text-sm">Reject</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {selectedTx && modalAction && (
        <Modal isOpen={true} onClose={closeModal} title={modalAction === 'approve' ? 'Approve Transaction' : 'Reject Transaction'}>
          <div className="space-y-4">
            <div className="rounded-md bg-gray-50 p-3">
              <p className="text-sm text-gray-600">Merchant:</p>
              <p className="font-medium">{selectedTx.merchant || 'Unknown'}</p>
              <p className="mt-2 text-sm text-gray-600">Amount:</p>
              <p className="font-medium">{formatCurrency(selectedTx.amount)}</p>
            </div>
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">Notes (optional)</label>
              <textarea id="notes" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" disabled={modalLoading} />
            </div>
            {modalError && <Alert type="error" message={modalError} />}
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={closeModal} disabled={modalLoading}>Cancel</Button>
              <Button variant={modalAction === 'approve' ? 'primary' : 'danger'} loading={modalLoading} onClick={handleConfirm}>
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