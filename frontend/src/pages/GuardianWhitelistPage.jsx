import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../api/axiosInstance';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';
import Modal from '../components/ui/Modal';

const GuardianWhitelistPage = () => {
  const navigate = useNavigate();
  const [accountHolders, setAccountHolders] = useState([]);
  const [selectedAccountHolderId, setSelectedAccountHolderId] = useState('');
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRule, setNewRule] = useState({ merchant_name: '', category: '', rule_type: 'require_approval' });
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    const fetchAccountHolders = async () => {
      try {
        setError(null);
        const response = await axiosInstance.get('/guardian/pending-reviews/');
        const transactions = response.data.pending_transactions || [];
        const uniqueHolders = [];
        const seen = new Set();
        for (const tx of transactions) {
          if (tx.account_holder_id && !seen.has(tx.account_holder_id)) {
            seen.add(tx.account_holder_id);
            uniqueHolders.push({ id: tx.account_holder_id, username: tx.account_holder || `User ${tx.account_holder_id}` });
          }
        }
        if (uniqueHolders.length === 0) {
          const userRes = await axiosInstance.get('/auth/user/');
          const managed = userRes.data.managed_accounts || [];
          for (const acc of managed) {
            uniqueHolders.push({ id: acc.id, username: acc.username });
          }
        }
        setAccountHolders(uniqueHolders);
        if (uniqueHolders.length > 0) setSelectedAccountHolderId(uniqueHolders[0].id);
      } catch (err) {
        console.error('Failed to fetch account holders:', err);
        setError('Unable to load your managed account holders.');
      } finally {
        setLoading(false);
      }
    };
    fetchAccountHolders();
  }, []);

  useEffect(() => {
    if (!selectedAccountHolderId) return;
    const fetchRules = async () => {
      try {
        setError(null);
        const response = await axiosInstance.get(`/guardian/${selectedAccountHolderId}/whitelist/`);
        setRules(response.data);
      } catch (err) {
        console.error('Failed to fetch whitelist rules:', err);
        setError('Unable to load whitelist rules.');
      }
    };
    fetchRules();
  }, [selectedAccountHolderId]);

  const handleDeleteRule = async (ruleId) => {
    if (!window.confirm('Are you sure you want to delete this rule?')) return;
    try {
      await axiosInstance.delete(`/guardian/${selectedAccountHolderId}/whitelist/${ruleId}/`);
      setRules(rules.filter(rule => rule.id !== ruleId));
      setSuccessMessage('Rule deleted successfully.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setError('Failed to delete rule. Please try again.');
      setTimeout(() => setError(null), 3000);
    }
  };

  const openAddModal = () => {
    setNewRule({ merchant_name: '', category: '', rule_type: 'require_approval' });
    setModalError('');
    setShowAddModal(true);
  };

  const handleAddRule = async () => {
    if (!newRule.merchant_name.trim()) {
      setModalError('Merchant name is required');
      return;
    }
    if (!newRule.category.trim()) {
      setModalError('Category is required');
      return;
    }
    setModalLoading(true);
    setModalError('');
    try {
      const response = await axiosInstance.post(`/guardian/${selectedAccountHolderId}/whitelist/`, newRule);
      setRules([...rules, response.data]);
      setShowAddModal(false);
      setSuccessMessage('Rule added successfully.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      setModalError(err.response?.data?.error || 'Failed to add rule.');
    } finally {
      setModalLoading(false);
    }
  };

  const getRuleTypeBadge = (ruleType) => {
    const types = {
      allow: { label: 'Allow', color: 'bg-green-100 text-green-800' },
      block: { label: 'Block', color: 'bg-red-100 text-red-800' },
      require_approval: { label: 'Require Approval', color: 'bg-yellow-100 text-yellow-800' },
    };
    const info = types[ruleType] || { label: ruleType, color: 'bg-gray-100 text-gray-800' };
    return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${info.color}`}>{info.label}</span>;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">Loading...</div>
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

        <Card title="Merchant Whitelist Management">
          {error && <Alert type="error" message={error} onDismiss={() => setError(null)} />}
          {successMessage && <Alert type="success" message={successMessage} onDismiss={() => setSuccessMessage('')} />}

          {accountHolders.length === 0 ? (
            <p className="py-4 text-center text-gray-500">No account holders managed.</p>
          ) : (
            <>
              <div className="mb-4">
                <label htmlFor="accountHolder" className="block text-sm font-medium text-gray-700 mb-1">Select Account Holder</label>
                <select id="accountHolder" value={selectedAccountHolderId} onChange={(e) => setSelectedAccountHolderId(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2">
                  {accountHolders.map(holder => <option key={holder.id} value={holder.id}>{holder.username}</option>)}
                </select>
              </div>

              <div className="mb-4 flex justify-end">
                <Button variant="primary" onClick={openAddModal}>+ Add Rule</Button>
              </div>

              {rules.length === 0 ? (
                <p className="py-4 text-center text-gray-500">No whitelist rules for this account holder.</p>
              ) : (
                <div className="space-y-3">
                  {rules.map(rule => (
                    <div key={rule.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                      <div>
                        <div className="font-medium text-gray-900">{rule.merchant_name}</div>
                        <div className="text-sm text-gray-500">{rule.category}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        {getRuleTypeBadge(rule.rule_type)}
                        <Button variant="danger" size="sm" onClick={() => handleDeleteRule(rule.id)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Whitelist Rule">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Merchant Name *</label>
            <input type="text" value={newRule.merchant_name} onChange={(e) => setNewRule({ ...newRule, merchant_name: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Category *</label>
            <input type="text" value={newRule.category} onChange={(e) => setNewRule({ ...newRule, category: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Rule Type</label>
            <select value={newRule.rule_type} onChange={(e) => setNewRule({ ...newRule, rule_type: e.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2">
              <option value="allow">Allow</option>
              <option value="block">Block</option>
              <option value="require_approval">Require Approval</option>
            </select>
          </div>
          {modalError && <Alert type="error" message={modalError} />}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setShowAddModal(false)}>Cancel</Button>
            <Button variant="primary" loading={modalLoading} onClick={handleAddRule}>Save Rule</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default GuardianWhitelistPage;