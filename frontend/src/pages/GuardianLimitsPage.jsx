import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { axiosInstance } from '../api/axiosInstance';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Alert from '../components/ui/Alert';

const GuardianLimitsPage = () => {
  const navigate = useNavigate();
  const [managedAccounts, setManagedAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [limits, setLimits] = useState({ daily_limit: '', allow_late_night: false, quiet_hours_start: 22, quiet_hours_end: 6 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    const fetchManagedAccounts = async () => {
      try {
        setError(null);
        const userRes = await axiosInstance.get('/auth/user/');
        const accounts = userRes.data.managed_accounts || [];
        setManagedAccounts(accounts);
        if (accounts.length > 0) setSelectedAccountId(accounts[0].id);
      } catch (err) {
        console.error('Failed to fetch managed accounts:', err);
        setError('Unable to load managed accounts.');
      } finally {
        setLoading(false);
      }
    };
    fetchManagedAccounts();
  }, []);

  useEffect(() => {
    if (!selectedAccountId) return;
    const fetchLimits = async () => {
      try {
        setError(null);
        const response = await axiosInstance.get(`/guardian/${selectedAccountId}/update-limits/`);
        const data = response.data;
        setLimits({
          daily_limit: data.daily_limit || '',
          allow_late_night: data.allow_late_night || false,
          quiet_hours_start: data.quiet_hours_start ?? 22,
          quiet_hours_end: data.quiet_hours_end ?? 6,
        });
      } catch (err) {
        console.error('Failed to fetch limits:', err);
        setError('Unable to load current limits.');
      }
    };
    fetchLimits();
  }, [selectedAccountId]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setLimits(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const validateDailyLimit = (value) => {
    const num = parseFloat(value);
    return !isNaN(num) && num > 0;
  };

  const validateHour = (hour) => {
    const num = parseInt(hour, 10);
    return !isNaN(num) && num >= 0 && num <= 23;
  };

  const handleSave = async () => {
    if (!validateDailyLimit(limits.daily_limit)) {
      setError('Daily limit must be a positive number.');
      return;
    }
    if (!validateHour(limits.quiet_hours_start)) {
      setError('Quiet hours start must be between 0 and 23.');
      return;
    }
    if (!validateHour(limits.quiet_hours_end)) {
      setError('Quiet hours end must be between 0 and 23.');
      return;
    }
    setSaving(true);
    setError(null);
    setSuccessMessage('');
    const payload = {
      daily_limit: parseFloat(limits.daily_limit).toFixed(2),
      allow_late_night: limits.allow_late_night,
      quiet_hours_start: parseInt(limits.quiet_hours_start, 10),
      quiet_hours_end: parseInt(limits.quiet_hours_end, 10),
    };
    try {
      await axiosInstance.patch(`/guardian/${selectedAccountId}/update-limits/`, payload);
      setSuccessMessage('Safe spend limits updated successfully.');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update limits.');
    } finally {
      setSaving(false);
    }
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
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate('/guardian')} className="w-full sm:w-auto">
            ← Back to Dashboard
          </Button>
        </div>

        <Card title="Configure Safe Spend Limits">
          {error && <Alert type="error" message={error} onDismiss={() => setError(null)} />}
          {successMessage && <Alert type="success" message={successMessage} onDismiss={() => setSuccessMessage('')} />}

          {managedAccounts.length === 0 ? (
            <p className="py-4 text-center text-gray-500">No managed account holders found.</p>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder</label>
                <select value={selectedAccountId} onChange={(e) => setSelectedAccountId(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2">
                  {managedAccounts.map(acc => <option key={acc.id} value={acc.id}>{acc.username}</option>)}
                </select>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Daily Limit (£)</label>
                  <input type="number" step="0.01" min="0.01" name="daily_limit" value={limits.daily_limit} onChange={handleInputChange} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                </div>
                <div className="flex items-center">
                  <input type="checkbox" name="allow_late_night" checked={limits.allow_late_night} onChange={handleInputChange} className="h-4 w-4 rounded border-gray-300 text-blue-600" />
                  <label className="ml-2 block text-sm text-gray-700">Allow late night transactions (overrides quiet hours)</label>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quiet Hours Start (0-23)</label>
                    <input type="number" min="0" max="23" name="quiet_hours_start" value={limits.quiet_hours_start} onChange={handleInputChange} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Quiet Hours End (0-23)</label>
                    <input type="number" min="0" max="23" name="quiet_hours_end" value={limits.quiet_hours_end} onChange={handleInputChange} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2" />
                  </div>
                </div>
                <div className="flex justify-end pt-4">
                  <Button variant="primary" loading={saving} onClick={handleSave} disabled={saving} className="w-full sm:w-auto">Save Changes</Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default GuardianLimitsPage;