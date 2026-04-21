import uuid
from decimal import Decimal
from django.utils import timezone
from django.db import transaction as db_transaction
from rest_framework import serializers

# Models from our Guardian Vault and Core Banking
from .models import Account, Transaction, PendingTransaction
from .guardian_models import SafeSpendLimit
from .governance import check_transaction

class TransactionServiceError(Exception):
    """Custom error for service layer issues."""
    pass

def execute_transaction_flow(user, from_account, amount, merchant_name, to_account=None):
    """
    The main orchestrator for payments. 
    Handles: Permission Engine -> External API -> Database Persistence.
    """
    
    # 1. PERMISSION ENGINE GATE
    decision, reason, metadata = check_transaction(user, amount, merchant_name)
    
    if decision == 'REJECTED':
        raise serializers.ValidationError({"detail": reason, "gate": metadata.get('gate')})
    
    if decision == 'PENDING':
        # Create a record for Guardian review
        pending = PendingTransaction.objects.create(
            account_holder=user,
            amount=amount,
            merchant_name=merchant_name,
            reason_flag=reason[:100],
            payment_status='local_pending'
        )
        return {'status': 'PENDING', 'pending': pending, 'reason': reason}

    # 2. EXTERNAL PAYMENT GATEWAY
    # -------------------------------------------------------------------------
    # TODO: Tomorrow, replace this simulation with the actual REST API call.
    # example: response = requests.post(GREG_API_URL, data=payload)
    
    external_id = f"sim_{uuid.uuid4().hex[:16]}" # Simulated ID
    payment_status = 'success'
    gateway_response = {
        'simulated': True, 
        'timestamp': timezone.now().isoformat(),
        'merchant_raw': merchant_name
    }
    # -------------------------------------------------------------------------

    # 3. UPDATE SPENDING LIMITS & SAVE TRANSACTION
    # Wrapped in a transaction to ensure both happen or neither happens
    with db_transaction.atomic():
        try:
            safe_spend = SafeSpendLimit.objects.get(account_holder=user)
            safe_spend.daily_spent += amount
            safe_spend.save()
        except SafeSpendLimit.DoesNotExist:
            pass # No limit profile found for this user (e.g. a Guardian)

        new_transaction = Transaction.objects.create(
            transaction_type='payment',
            amount=amount,
            from_account=from_account,
            to_account=to_account,
            merchant_name=merchant_name,
            external_id=external_id,
            payment_status=payment_status,
            gateway_response=gateway_response,
            last_gateway_sync=timezone.now()
        )
    
    return {'status': 'APPROVED', 'transaction': new_transaction, 'reason': reason}


def execute_pending_approval_flow(pending_id, guardian, guardian_notes=""):
    """
    Called by the Guardian Dashboard when a transaction is manually approved.
    """
    try:
        pending = PendingTransaction.objects.select_related('account_holder').get(id=pending_id)
    except PendingTransaction.DoesNotExist:
        raise TransactionServiceError("Pending record not found.")

    if pending.status != 'pending':
        raise TransactionServiceError("This transaction has already been processed.")

    # Find the account to debit (defaulting to the user's current account)
    from_account = Account.objects.get(user=pending.account_holder, account_type='current')

    with db_transaction.atomic():
        # ---------------------------------------------------------------------
        # TODO: Greg's API 'Capture' or 'Execute' call goes here tomorrow
        # ---------------------------------------------------------------------
        external_id = f"appr_{uuid.uuid4().hex[:16]}"
        
        # Update limits
        try:
            safe_spend = SafeSpendLimit.objects.get(account_holder=pending.account_holder)
            safe_spend.daily_spent += pending.amount
            safe_spend.save()
        except SafeSpendLimit.DoesNotExist:
            pass

        # Create the real transaction from the pending one
        final_tx = Transaction.objects.create(
            transaction_type='payment',
            amount=pending.amount,
            from_account=from_account,
            merchant_name=pending.merchant_name,
            external_id=external_id,
            payment_status='success'
        )
        
        # Mark pending record as closed
        pending.status = 'approved'
        pending.guardian = guardian
        pending.guardian_notes = guardian_notes
        pending.save()

    return {'status': 'APPROVED', 'transaction': final_tx, 'pending': pending}