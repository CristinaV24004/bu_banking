from django.test import TestCase
from django.contrib.auth.models import User
from banking.guardian_models import UserProfile, SafeSpendLimit
from banking.models import Account

class GuardianSignalsTest(TestCase):
    def test_account_holder_setup(self):
        # Test BAJPM-25: New users get profiles, limits, and bank accounts.
        user = User.objects.create_user(username='tester', password='pass')
        
        # Check Profile
        profile = UserProfile.objects.get(user=user)
        self.assertTrue(profile.is_account_holder)
        
        # Check SafeSpend
        limit = SafeSpendLimit.objects.get(account_holder=user)
        self.assertEqual(limit.daily_limit, 100.00)
        
        # Check Bank Accounts
        account_count = Account.objects.filter(user=user).count()
        self.assertEqual(account_count, 2)

    def test_guardian_relationship(self):
        """Test BAJPM-20: Linking a guardian to an account holder."""
        guardian_user = User.objects.create_user(username='guardian', password='pass')
        holder_user = User.objects.create_user(username='holder', password='pass')
        
        g_profile = guardian_user.profile
        g_profile.is_guardian = True
        g_profile.is_account_holder = False
        g_profile.save()
        
        # Link them
        g_profile.managed_accounts.add(holder_user)
        
        self.assertEqual(g_profile.managed_accounts.count(), 1)
        self.assertIn(holder_user, guardian_user.profile.managed_accounts.all())