import { useState, useEffect, useRef, useCallback } from 'react';
import { axiosInstance } from '../api/axiosInstance';

const POLL_INTERVAL_MS = 30000;

export const usePendingPolling = (enabled = true) => {
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const prevCountRef = useRef(0);
  const intervalRef = useRef(null);

  const fetchTransactions = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/guardian/pending-reviews/');
      setPendingTransactions(response.data.pending_transactions || []);
    } catch (err) {
      console.error('Failed to fetch full transaction list:', err);
    }
  }, []);

  const fetchCount = useCallback(async () => {
    try {
      const response = await axiosInstance.get('/guardian/pending-count/');
      const newCount = response.data.count;

      const previousCount = prevCountRef.current;
      prevCountRef.current = newCount;

      setPendingCount(newCount);
      setError(null);

      if (previousCount !== 0 && newCount > previousCount) {
        const increase = newCount - previousCount;
        await fetchTransactions();

        if (Notification.permission === 'granted') {
          new Notification('New Pending Transaction', {
            body: `${increase} new transaction${increase > 1 ? 's' : ''} awaiting approval.`,
            icon: '/favicon.ico',
          });
        }

        window.dispatchEvent(
          new CustomEvent('new-pending-transactions', {
            detail: { count: newCount, increase },
          })
        );
      }
    } catch (err) {
      console.error('Polling error:', err);
      setError('Failed to fetch pending count');
    } finally {
      setLoading(false);
    }
  }, [fetchTransactions]);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch((err) => {
        console.warn('Notification permission request failed:', err);
      });
    } 
  }, []);

  useEffect(() => {
    if (!enabled) return;

    fetchCount();
    fetchTransactions();

    intervalRef.current = setInterval(fetchCount, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, fetchCount, fetchTransactions]);

  return { pendingCount, pendingTransactions, loading, error };
};