import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { axiosInstance } from '../api/axiosInstance';
import Card from './ui/Card';
import Button from './ui/Button';

const AnomalyAlertsWidget = ({ accountHolderId }) => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [alertErrors, setAlertErrors] = useState({});

  useEffect(() => {
    if (!accountHolderId) {
      setLoading(false);
      return;
    }

    const fetchAlerts = async () => {
      try {
        setError(false);
        const response = await axiosInstance.get(`/guardian/${accountHolderId}/anomaly-alerts/`);
        setAlerts(response.data.alerts || []);
      } catch (err) {
        console.warn('Failed to fetch anomaly alerts:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
  }, [accountHolderId]);

  const resolveAlert = async (alertId, resolution) => {
    setResolvingId(alertId);
    setAlertErrors((prev) => ({ ...prev, [alertId]: '' }));
    try {
      await axiosInstance.post(`/guardian/${accountHolderId}/anomaly-alerts/${alertId}/resolve`, { resolution });
      // Optimistic removal
      setAlerts((prev) => prev.filter((alert) => alert.id !== alertId));
    } catch (err) {
      console.error('Failed to resolve alert:', err);
      setAlertErrors((prev) => ({
        ...prev,
        [alertId]: err.response?.data?.message || 'Failed to resolve. Please try again.',
      }));
    } finally {
      setResolvingId(null);
    }
  };

  if (loading) {
    return (
      <Card title="Anomaly Alerts" className="w-full">
        <div className="flex items-center justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
        </div>
      </Card>
    );
  }

  // Silently fail – return null on error or if no accountHolderId
  if (error || !accountHolderId) {
    return null;
  }

  const getSeverityBadge = (severity) => {
    const config = {
      high: { label: 'High', color: 'bg-red-100 text-red-800' },
      medium: { label: 'Medium', color: 'bg-orange-100 text-orange-800' },
      low: { label: 'Low', color: 'bg-yellow-100 text-yellow-800' },
    };
    const { label, color } = config[severity] || { label: severity, color: 'bg-gray-100 text-gray-800' };
    return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${color}`}>{label}</span>;
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card title="Anomaly Alerts" className="w-full">
      {alerts.length === 0 ? (
        <p className="py-4 text-center text-gray-500">No anomaly alerts for this account holder.</p>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
              <div className="flex items-center justify-between">
                {getSeverityBadge(alert.severity)}
                <span className="text-xs text-gray-500">{formatDate(alert.created_at)}</span>
              </div>
              <p className="mt-2 text-sm text-gray-700">{alert.reason}</p>
              <div className="mt-3 flex gap-2">
                <Button
                  variant="primary"
                  loading={resolvingId === alert.id}
                  disabled={resolvingId === alert.id}
                  onClick={() => resolveAlert(alert.id, 'reviewed')}
                  className="px-3 py-1 text-xs"
                >
                  Mark Reviewed
                </Button>
                <Button
                  variant="ghost"
                  loading={resolvingId === alert.id}
                  disabled={resolvingId === alert.id}
                  onClick={() => resolveAlert(alert.id, 'ignored')}
                  className="px-3 py-1 text-xs"
                >
                  Ignore
                </Button>
              </div>
              {alertErrors[alert.id] && (
                <p className="mt-2 text-xs text-red-600">{alertErrors[alert.id]}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

AnomalyAlertsWidget.propTypes = {
  accountHolderId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
};

export default AnomalyAlertsWidget;