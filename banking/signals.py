"""
Unified User Onboarding Signal.
Automatically provisions accounts and governance profiles for new users.
"""

from decimal import Decimal
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from django.utils import timezone

# Absolute imports for model clarity
from banking.models import Account
from banking.guardian_models import UserProfile, SafeSpendLimit

@receiver(post_save, sender=User)
def initialize_user_banking_and_governance(sender, instance, created, **kwargs):
    """
    Combined signal to handle both Standard Banking setup and 
    Guardian Vault Governance setup on User creation.
    """
    
    # 1. GOVERNANCE SETUP: Always ensure a UserProfile exists (Safety Net)
    # We use '_' for profile_created as it's not needed for the logic below
    profile, _ = UserProfile.objects.get_or_create(
        user=instance,
        defaults={
            'is_guardian': False,
            'is_account_holder': True
        }
    )

    # 2. NEW USER PROVISIONING
    if created:
        # A. Create Default Bank Accounts
        if not Account.objects.filter(user=instance).exists():
            first_name = instance.first_name or instance.username
            
            # Current Account: The primary spending account
            Account.objects.create(
                user=instance,
                name=f"{first_name}'s Current Account",
                starting_balance=Decimal('1000.00'),
                account_type='current',
                round_up_enabled=False
            )
            
            # Savings Account: The target for round-ups
            Account.objects.create(
                user=instance,
                name=f"{first_name}'s Savings Account",
                starting_balance=Decimal('0.00'),
                account_type='savings',
                round_up_enabled=True
            )

        # B. Create SafeSpendLimit (Only for Account Holders)
        if profile.is_account_holder:
            SafeSpendLimit.objects.get_or_create(
                account_holder=instance,
                defaults={
                    'daily_limit': Decimal('100.00'),
                    'daily_spent': Decimal('0.00'),
                    'last_reset_date': timezone.now().date(),
                    'allow_late_night': False,
                    'quiet_hours_start': 22,
                    'quiet_hours_end': 6
                }
            )