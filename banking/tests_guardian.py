"""
Automated Tests for Guardian Signals and Relationships.
Ensures every new user is provisioned with the correct security vault settings.
"""

from django.test import TestCase
from django.contrib.auth.models import User
from banking.guardian_models import UserProfile, SafeSpendLimit
from banking.models import Account

class GuardianSignalsTest(TestCase):
    def setUp(self):
        """Set up non-sensitive test constants to satisfy security scanners."""
        self.test_pass = "TemporaryTestPass123!" 

    def test_account_holder_setup(self):
        """Test: New users automatically get profiles, limits, and bank accounts."""
        user = User.objects.create_user(username='tester_user', password=self.test_pass)
        
        # Check Profile exists and defaults to Account Holder
        profile = UserProfile.objects.get(user=user)
        self.assertTrue(profile.is_account_holder)
        
        # Check SafeSpend limit is initialized correctly
        limit = SafeSpendLimit.objects.get(account_holder=user)
        self.assertEqual(float(limit.daily_limit), 100.00)
        
        # Check Bank Accounts (Current + Savings)
        account_count = Account.objects.filter(user=user).count()
        self.assertEqual(account_count, 2)

    def test_guardian_relationship(self):
        """Test BAJPM-20: Linking a guardian to an account holder."""
        guardian_user = User.objects.create_user(username='guardian_admin', password=self.test_pass)
        holder_user = User.objects.create_user(username='protected_holder', password=self.test_pass)
        
        # Fetch the profile created by signals
        g_profile = UserProfile.objects.get(user=guardian_user)
        g_profile.is_guardian = True
        g_profile.is_account_holder = False
        g_profile.save()
        
        # Link the Guardian to the Account Holder
        g_profile.managed_accounts.add(holder_user)
        
        self.assertEqual(g_profile.managed_accounts.count(), 1)
        self.assertIn(holder_user, g_profile.managed_accounts.all())