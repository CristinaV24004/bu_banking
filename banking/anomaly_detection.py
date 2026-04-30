import logging
from decimal import Decimal
from django.utils import timezone
from .models import Transaction, AnomalyAlert
from .guardian_models import SafeSpendLimit
from datetime import timedelta

logger = logging.getLogger(__name__)

def detect_anomalies(user, transaction):
    """
    Passive anomaly detection for a completed transaction.
    Creates AnomalyAlert records for suspicious patterns.
    Never raises exceptions – fails silently.
    """
    try:
        # Rule 1: Late night transaction (outside allowed quiet hours)
        _check_late_night(user, transaction)

        # Rule 2: Rapid spending – 3+ transactions in 10 minutes from same account
        _check_rapid_spending(transaction)

        # Rule 3: Large single transaction (>80% of daily limit)
        _check_large_transaction(user, transaction)

        # Rule 4: Repeated same merchant – 3+ payments in 1 hour
        _check_repeated_merchant(transaction)

    except Exception as e:
        logger.error(f"Anomaly detection failed for transaction {transaction.id}: {e}", exc_info=True)


def _check_late_night(user, transaction):
    """Rule 1: Transaction during quiet hours."""
    try:
        safe_spend = SafeSpendLimit.objects.get(account_holder=user)
    except SafeSpendLimit.DoesNotExist:
        return  # no limits, skip

    current_hour = transaction.timestamp.hour
    start = safe_spend.quiet_hours_start
    end = safe_spend.quiet_hours_end

    is_quiet = False
    if start <= end:
        is_quiet = start <= current_hour < end
    else:
        is_quiet = current_hour >= start or current_hour < end

    if is_quiet:
        AnomalyAlert.objects.create(
            account_holder=user,
            transaction=transaction,
            severity='medium',
            reason=f"Transaction at {current_hour}:00 — outside safe hours"
        )


def _check_rapid_spending(transaction):
    """Rule 2: 3+ payment transactions from same account in last 10 minutes."""
    ten_minutes_ago = timezone.now() - timedelta(minutes=10)
    recent_count = Transaction.objects.filter(
        from_account=transaction.from_account,
        transaction_type='payment',
        timestamp__gte=ten_minutes_ago
    ).count()

    if recent_count >= 3:
        AnomalyAlert.objects.create(
            account_holder=transaction.from_account.user,
            transaction=transaction,
            severity='high',
            reason=f"Rapid spending detected — {recent_count} transactions in 10 minutes"
        )


def _check_large_transaction(user, transaction):
    """Rule 3: Amount exceeds 80% of daily limit."""
    try:
        safe_spend = SafeSpendLimit.objects.get(account_holder=user)
    except SafeSpendLimit.DoesNotExist:
        return

    daily_limit = safe_spend.daily_limit
    if daily_limit <= Decimal('0'):
        return

    percentage = (transaction.amount / daily_limit) * Decimal('100')
    if percentage > Decimal('80'):
        AnomalyAlert.objects.create(
            account_holder=user,
            transaction=transaction,
            severity='medium',
            reason=f"Large transaction — £{transaction.amount} is {percentage:.0f}% of daily limit"
        )


def _check_repeated_merchant(transaction):
    """Rule 4: 3+ payments to same merchant within last hour."""
    one_hour_ago = timezone.now() - timedelta(hours=1)
    recent_count = Transaction.objects.filter(
        from_account=transaction.from_account,
        merchant_name=transaction.merchant_name,
        transaction_type='payment',
        timestamp__gte=one_hour_ago
    ).count()

    if recent_count >= 3:
        AnomalyAlert.objects.create(
            account_holder=transaction.from_account.user,
            transaction=transaction,
            severity='low',
            reason=f"Repeated payments to {transaction.merchant_name} — {recent_count} times in 1 hour"
        )