import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import logoFull from '../assets/gv-logo-simple.png';

const BANK_ID = '2defecf0-833e-43a5-9d1b-36be1fabc2d5';
const API_BASE = 'https://paymentsystem-cards-cf.pages.dev/api/cards';

const CardBalancePage = () => {
  const { card_number } = useParams();
  const [balance, setBalance] = useState(null);
  const [startingBalance, setStartingBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const isMounted = useRef(true);

  const fetchBalance = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/${BANK_ID}/${card_number}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Card not found');
        throw new Error('Failed to fetch balance');
      }
      const data = await response.json();
      if (isMounted.current) {
        setBalance(data.balance);
        setStartingBalance(data.starting_balance);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err.message);
        setLoading(false);
      }
    }
  }, [card_number]);

  useEffect(() => {
    isMounted.current = true;
    setLoading(true);
    setError(null);
    fetchBalance();

    intervalRef.current = setInterval(() => { fetchBalance(); }, 3000);

    return () => {
      isMounted.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [card_number, fetchBalance]);

  const formatGBP = (amount) => {
    if (amount === null || amount === undefined) return '£0.00';
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getMaskedCardNumber = () => {
    if (!card_number || card_number.length < 4) return '•••• ••••';
    const last4 = card_number.slice(-4);
    return `•••• ${last4}`;
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] p-4">
      <div className="w-full max-w-md text-center">

        {/* Logo */}
        <img
          src={logoSimple}
          alt="Guardian Vault logo"
          className="mx-auto h-32 w-auto"
        />

        {/* Title */}
        <div className="mt-2 flex flex-col items-center leading-tight">
          <span className="font-cinzel text-2xl font-semibold text-[#0D2B55]">Guardian</span>
          <span className="font-cinzel text-2xl font-bold tracking-widest text-[#C9992A]">VAULT</span>
        </div>

        {/* Divider */}
        <div className="my-4 mx-auto h-px w-16 bg-[#C9992A]"></div>

        {/* Card number masked */}
        <p className="font-cinzel text-lg text-[#4A5568]">{getMaskedCardNumber()}</p>

        {/* Loading state */}
        {loading && (
          <div className="mt-8 flex justify-center">
            <output aria-label="Loading card balance">
              <div
                className="h-8 w-8 animate-spin rounded-full border-4 border-[#C9992A] border-t-transparent"
                aria-hidden="true"
              ></div>
            </output>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="mt-8 rounded-lg bg-white p-6 shadow-sm border border-[#CBD5E1]">
            <p className="font-semibold text-red-600">{error}</p>
            <p className="mt-2 text-sm text-[#4A5568]">
              Please check the card number or try again later.
            </p>
          </div>
        )}

        {/* Balance display */}
        {!loading && !error && balance !== null && (
          <>
            <p className="mt-8 text-xs font-medium uppercase tracking-wider text-[#4A5568]">
              Current Balance
            </p>
            <p
              className="mt-1 text-6xl font-bold text-[#0D2B55]"
              aria-live="polite"
              aria-label={`Current balance: ${formatGBP(balance)}`}
            >
              {formatGBP(balance)}
            </p>
            <p className="mt-3 text-sm text-[#4A5568]">
              Started at {formatGBP(startingBalance)}
            </p>

            {/* Live indicator */}
            <div className="mt-6 flex items-center justify-center gap-2">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
              </span>
              <span className="text-xs text-[#4A5568]">Live updates</span>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default CardBalancePage;