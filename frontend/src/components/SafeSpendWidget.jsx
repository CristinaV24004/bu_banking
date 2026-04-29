import { useState, useEffect } from 'react';
import { axiosInstance } from '../api/axiosInstance';
import Card from './ui/Card';
import Alert from './ui/Alert';
import PropTypes from 'prop-types';

const SafeSpendWidget = ({ userId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchSafeSpend = async () => {
      try {
        setError(false);
        const response = await axiosInstance.get(`/guardian/update-limits/${userId}/`);
        setData(response.data);
      } catch (err) {
        console.warn('Failed to fetch safe spend data:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchSafeSpend();
  }, [userId]);

  if (loading) {
    return (
      <Card title="Safe Spend" className="w-full">
        <div className="flex items-center justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"></div>
        </div>
      </Card>
    );
  }

  // Silent fail on error
  if (error || !data) {
    return null;
  }

  const dailyLimit = Number.parseFloat(data.daily_limit);
  const dailySpent = Number.parseFloat(data.daily_spent);
  const remaining = dailyLimit - dailySpent;
  const percentageUsed = (dailySpent / dailyLimit) * 100;

  let progressColor = 'bg-green-500';
  if (percentageUsed > 80) {
    progressColor = 'bg-red-500';
  } else if (percentageUsed > 50) {
    progressColor = 'bg-yellow-500';
  }

  const formatCurrency = (value) => {
    if (Number.isNaN(value)) return '£0.00';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const isLowRemaining = remaining < 10 && remaining >= 0;

  return (
    <Card title="Safe Spend" className="w-full">
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Daily limit:</span>
          <span className="font-medium">{formatCurrency(dailyLimit)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Spent today:</span>
          <span className="font-medium">{formatCurrency(dailySpent)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Remaining today:</span>
          <span className={`font-medium ${remaining < 0 ? 'text-red-600' : ''}`}>
            {fformatCurrency(Math.max(0, remaining))}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full transition-all duration-300 ${progressColor}`}
              style={{ width: `${Math.min(100, Math.max(0, percentageUsed))}%` }}
            ></div>
          </div>
          <div className="mt-1 text-right text-xs text-gray-500">
            {Math.round(percentageUsed)}% used
          </div>
        </div>

        {isLowRemaining && (
          <Alert
            type="warning"
            message={`Only ${formatCurrency(remaining)} remaining today. Spend carefully.`}
          />
        )}
      </div>
    </Card>
  );
};

SafeSpendWidget.propTypes = {
  userId: PropTypes.string.isRequired,
};

export default SafeSpendWidget;