import uuid
from django.db import models
from django.contrib.auth.models import User

class Account(models.Model):
    ACCOUNT_TYPES = [
        ('current', 'Current'),
        ('savings', 'Savings'),
        ('credit', 'Credit'),
        ('other', 'Other'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100)
    starting_balance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    round_up_enabled = models.BooleanField(default=False)
    postcode = models.CharField(max_length=10, blank=True)
    round_up_pot = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='accounts', null=True, blank=True)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPES, default='current')

    def __str__(self):
        return self.name

class Business(models.Model):
    id = models.CharField(primary_key=True, max_length=50)
    name = models.CharField(max_length=100)
    category = models.CharField(max_length=50)
    sanctioned = models.BooleanField(default=False)

    def __str__(self):
        return self.name

class Transaction(models.Model):
    TRANSACTION_TYPES = [
        ('payment', 'Payment'),
        ('withdrawal', 'Withdrawal'),
        ('deposit', 'Deposit'),
        ('collect_roundup', 'Collect Roundup'),
        ('transfer', 'Transfer'),
        ('roundup_reclaim', 'Round Up Reclaim'),
    ]

    transaction_type = models.CharField(max_length=20, choices=TRANSACTION_TYPES)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    from_account = models.ForeignKey(Account, related_name='outgoing_transactions', on_delete=models.CASCADE)
    to_account = models.ForeignKey(Account, related_name='incoming_transactions', on_delete=models.CASCADE, null=True, blank=True)
    business = models.ForeignKey(Business, related_name='transactions', on_delete=models.CASCADE, null=True, blank=True)
    timestamp = models.DateTimeField(auto_now_add=True)

    # NEW FIELDS (External API Prep)
    merchant_name = models.CharField(max_length=255, blank=True)
    external_id = models.CharField(max_length=255, unique=True, null=True, blank=True, db_index=True)
    gateway_response = models.JSONField(null=True, blank=True, default=dict)
    payment_status = models.CharField(max_length=50, default='local_processed')

    def __str__(self):
        return f"{self.transaction_type} - {self.amount} ({self.payment_status})"

class PendingTransaction(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending Review'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    account_holder = models.ForeignKey(User, on_delete=models.CASCADE, related_name='pending_transactions')
    guardian = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='reviews_assigned')
    guardian_notes = models.TextField(blank=True)

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    merchant_name = models.CharField(max_length=255)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    reason_flag = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True)
    
    # NEW FIELDS (External API Prep)
    external_id = models.CharField(max_length=255, blank=True, db_index=True)
    gateway_response = models.JSONField(null=True, blank=True, default=dict)
    payment_status = models.CharField(max_length=50, default='local_pending')

    def __str__(self):
        return f"Pending: £{self.amount} for {self.account_holder.username} ({self.status})"