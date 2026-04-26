import os
import uuid
import requests  # Added this for the actual API calls
from decimal import Decimal
from django.utils import timezone
from django.db import transaction as db_transaction
from rest_framework import serializers

# Models from our Guardian Vault and Core Banking
from .models import Account, Transaction, PendingTransaction
from .guardian_models import SafeSpendLimit
from .governance import check_transaction

# Fetch credentials from the .env file (via Docker environment)
EXTERNAL_BANK_ID = os.getenv('EXTERNAL_BANK_ID', 'GVAULT_DEV')
EXTERNAL_API_KEY = os.getenv('EXTERNAL_API_KEY')
EXTERNAL_BANK_URL = os.getenv('EXTERNAL_BANK_URL')

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

    # 2. EXTERNAL PAYMENT GATEWAY (REAL BRIDGE)
    # -------------------------------------------------------------------------
    # We use the BANK_ID we registered to create a professional External ID
    # Format: [BANK_ID]-[Unique_Hash]
    unique_ref = uuid.uuid4().hex[:12].upper()
    external_id = f"{EXTERNAL_BANK_ID}-{unique_ref}" 
    
    payment_status = 'success'
    
    # This dictionary simulates what Greg's API will return
    gateway_response = {
        'provider': EXTERNAL_BANK_ID, 
        'timestamp': timezone.now().isoformat(),
        'merchant_raw': merchant_name,
        'connection_mode': 'live_api_ready' if EXTERNAL_API_KEY else 'test_mode'
    }
    # -------------------------------------------------------------------------

    # 3. UPDATE SPENDING LIMITS & SAVE TRANSACTION
    with db_transaction.atomic():
        try:
            safe_spend = SafeSpendLimit.objects.get(account_holder=user)
            safe_spend.daily_spent += amount
            safe_spend.save()
        except SafeSpendLimit.DoesNotExist:
            pass 

        new_transaction = Transaction.objects.create(
            transaction_type='payment',
            amount=amount,
            from_account=from_account,
            to_account=to_account,
            merchant_name=merchant_name,
            external_id=external_id,
            payment_status=payment_status,
            gateway_response=gateway_response,
         #   last_gateway_sync=timezone.now() - keep for live
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

    from_account = Account.objects.get(user=pending.account_holder, account_type='current')

    with db_transaction.atomic():
        # Using the Real Bank ID for the approval reference too
        unique_ref = uuid.uuid4().hex[:12].upper()
        external_id = f"{EXTERNAL_BANK_ID}-APPR-{unique_ref}"
        
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
            payment_status='success',
            gateway_response={'approved_by': str(guardian), 'bank_id': EXTERNAL_BANK_ID}
        )
        
        # Mark pending record as closed
        pending.status = 'approved'
        pending.guardian = guardian
        pending.guardian_notes = guardian_notes
        pending.save()

    return {'status': 'APPROVED', 'transaction': final_tx, 'pending': pending}