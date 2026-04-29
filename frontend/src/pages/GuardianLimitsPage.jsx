// src/pages/GuardianLimitsPage.jsx
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
  const [limits, setLimits] = useState({
    daily_limit: '',
    allow_late_night: false,
    quiet_hours_start: 22,
    quiet_hours_end: 6,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch managed accounts on mount
  useEffect(() => {
    const fetchManagedAccounts = async () => {
      try {
        setError(null);
        // Try to fetch from /guardian/managed-accounts/
        const response = await axiosInstance.get('/guardian/managed-accounts/');
        let accounts = response.data.managed_accounts || [];
      
        setManagedAccounts(accounts);
        if (accounts.length > 0) {
          setSelectedAccountId(accounts[0].id);
        }
      } catch (err) {
        console.error('Failed to fetch managed accounts:', err);
        setError('Unable to load managed accounts. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };
    fetchManagedAccounts();
  }, []);

  // Fetch limits when selected account changes
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
    setLimits((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const validateDailyLimit = (value) => {
    const num = Number.parseFloat(value);
    return !Number.isNaN(num) && num > 0;
  };

  const validateHour = (hour) => {
    const num = Number.parseInt(hour, 10);
    return !Number.isNaN(num) && num >= 0 && num <= 23;
  };

  const handleSave = async () => {
    // Validation
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
      daily_limit: Number.parseFloat(limits.daily_limit).toFixed(2),
      allow_late_night: limits.allow_late_night,
      quiet_hours_start: Number.parseInt(limits.quiet_hours_start, 10),
      quiet_hours_end: Number.parseInt(limits.quiet_hours_end, 10),
    };

    try {
      await axiosInstance.patch(`/guardian/${selectedAccountId}/update-limits/`, payload);
      setSuccessMessage('Safe spend limits updated successfully.');
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err) {
      console.error('Failed to update limits:', err);
      setError(err.response?.data?.error || 'Failed to update limits. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 text-gray-600">Loading...</div>
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
          <Button variant="ghost" onClick={() => navigate('/guardian')}>
            ← Back to Dashboard
          </Button>
        </div>

        <Card title="Configure Safe Spend Limits">
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

          {managedAccounts.length === 0 ? (
            <p className="py-4 text-center text-gray-500">No managed account holders found.</p>
          ) : (
            <>
              <div className="mb-4">
                <label htmlFor="accountSelect" className="block text-sm font-medium text-gray-700 mb-1">
                  Account Holder
                </label>
                <select
                  id="accountSelect"
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
                >
                  {managedAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-4">
                <div>
                  <label htmlFor="daily_limit" className="block text-sm font-medium text-gray-700">
                    Daily Limit (£)
                  </label>
                  <input
                    id="daily_limit"
                    name="daily_limit"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={limits.daily_limit}
                    onChange={handleInputChange}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    id="allow_late_night"
                    name="allow_late_night"
                    type="checkbox"
                    checked={limits.allow_late_night}
                    onChange={handleInputChange}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="allow_late_night" className="ml-2 block text-sm text-gray-700">
                    Allow late night transactions (overrides quiet hours)
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="quiet_hours_start" className="block text-sm font-medium text-gray-700">
                      Quiet Hours Start (0-23)
                    </label>
                    <input
                      id="quiet_hours_start"
                      name="quiet_hours_start"
                      type="number"
                      min="0"
                      max="23"
                      value={limits.quiet_hours_start}
                      onChange={handleInputChange}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label htmlFor="quiet_hours_end" className="block text-sm font-medium text-gray-700">
                      Quiet Hours End (0-23)
                    </label>
                    <input
                      id="quiet_hours_end"
                      name="quiet_hours_end"
                      type="number"
                      min="0"
                      max="23"
                      value={limits.quiet_hours_end}
                      onChange={handleInputChange}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    loading={saving}
                    disabled={saving}
                  >
                    Save Changes
                  </Button>
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