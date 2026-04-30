"""
Management command to create demo users for Guardian Vault.
Creates a clean demo environment with no real personal data.
Usage: python manage.py create_demo_users
"""

from decimal import Decimal
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from django.utils import timezone
from banking.models import Account, Business
from banking.guardian_models import UserProfile, SafeSpendLimit, MerchantWhitelist

class Command(BaseCommand):
    help = 'Creates demo users for Guardian Vault presentation'

    def handle(self, *args, **kwargs):
        self.stdout.write('Creating demo environment...')

        # Clean slate — remove existing demo users if they exist
        User.objects.filter(username__in=[
            'demo_holder', 'demo_guardian', 'admin'
        ]).delete()

        # 1. Create superuser for admin panel
        User.objects.create_superuser(
            username='admin',
            password='Admin1234!',
            email=''
        )
        self.stdout.write('  ✓ Admin created (username: admin / password: Admin1234!)')

        # 2. Create Account Holder
        holder = User.objects.create_user(
            username='demo_holder',
            password='Holder1234!',
            email=''
        )
        # Signal auto-creates UserProfile, SafeSpendLimit, and Accounts
        # Update the SafeSpendLimit to demo-friendly values
        SafeSpendLimit.objects.filter(account_holder=holder).update(
            daily_limit=Decimal('100.00'),
            daily_spent=Decimal('0.00'),
            allow_late_night=False,
            quiet_hours_start=22,
            quiet_hours_end=6,
            last_reset_date=timezone.now().date()
        )
        self.stdout.write('  ✓ Account Holder created (username: demo_holder / password: Holder1234!)')

        # 3. Create Guardian
        guardian = User.objects.create_user(
            username='demo_guardian',
            password='Guardian1234!',
            email=''
        )
        # Update UserProfile to make them a guardian
        UserProfile.objects.filter(user=guardian).update(
            is_guardian=True,
            is_account_holder=False
        )
        # Assign holder to guardian's managed accounts
        guardian_profile = UserProfile.objects.get(user=guardian)
        guardian_profile.managed_accounts.add(holder)
        self.stdout.write('  ✓ Guardian created (username: demo_guardian / password: Guardian1234!)')

        # 4. Create demo businesses
        Business.objects.get_or_create(
            id='TESCO-01',
            defaults={'name': 'Tesco', 'category': 'Groceries', 'sanctioned': False}
        )
        Business.objects.get_or_create(
            id='AMAZON-01',
            defaults={'name': 'Amazon', 'category': 'Shopping', 'sanctioned': False}
        )
        Business.objects.get_or_create(
            id='BOOTS-01',
            defaults={'name': 'Boots', 'category': 'Pharmacy', 'sanctioned': False}
        )
        Business.objects.get_or_create(
            id='BET365-01',
            defaults={'name': 'Bet365', 'category': 'Gambling', 'sanctioned': True}
        )
        self.stdout.write('  ✓ Businesses created (Tesco, Amazon, Boots, Bet365)')

        # 5. Create demo whitelist rules for account holder
        MerchantWhitelist.objects.get_or_create(
            account_holder=holder,
            merchant_name='Tesco',
            defaults={'category': 'Groceries', 'rule_type': 'require_approval'}
        )
        MerchantWhitelist.objects.get_or_create(
            account_holder=holder,
            merchant_name='Boots',
            defaults={'category': 'Pharmacy', 'rule_type': 'allow'}
        )
        MerchantWhitelist.objects.get_or_create(
            account_holder=holder,
            merchant_name='Bet365',
            defaults={'category': 'Gambling', 'rule_type': 'block'}
        )
        self.stdout.write('  ✓ Whitelist rules created')

        self.stdout.write(self.style.SUCCESS('\n✓ Demo environment ready!'))
        self.stdout.write('\nDemo credentials:')
        self.stdout.write('  Account Holder: demo_holder / Holder1234!')
        self.stdout.write('  Guardian:       demo_guardian / Guardian1234!')
        self.stdout.write('  Admin:          admin / Admin1234!')