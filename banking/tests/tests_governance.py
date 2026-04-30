"""
Governance & Permission Engine Tests.
Covers all three gates: Time, Merchant, and Spend Limits.
"""

from decimal import Decimal
from django.test import TestCase
from django.contrib.auth.models import User
from django.utils import timezone
from banking.governance import check_transaction
from banking.guardian_models import UserProfile, SafeSpendLimit, MerchantWhitelist


TEST_PASSWORD = "TestPass123!"


class PermissionEngineGatewayTests(TestCase):
    """Tests for the Guardian role bypass."""

    def setUp(self):
        self.guardian = User.objects.create_user(
            username='test_guardian', password=TEST_PASSWORD
        )
        UserProfile.objects.filter(user=self.guardian).update(
            is_guardian=True,
            is_account_holder=False
        )
        self.guardian = User.objects.get(username='test_guardian')

    def test_guardian_always_approved(self):
        """Guardians bypass all gates and are always approved."""
        decision, _, meta = check_transaction(
            self.guardian, Decimal('999.99'), 'Any Merchant'
        )
        self.assertEqual(decision, 'APPROVED')
        self.assertEqual(meta['gate'], 'role_bypass')


class PermissionEngineMerchantTests(TestCase):
    """Tests for Gate 2 - Merchant Whitelist."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='merchant_test_user', password=TEST_PASSWORD
        )
        SafeSpendLimit.objects.filter(account_holder=self.user).update(
            daily_limit=Decimal('100.00'),
            daily_spent=Decimal('0.00'),
            allow_late_night=True,
        )

    def test_blocked_merchant_rejected(self):
        """Transactions to blocked merchants are rejected."""
        MerchantWhitelist.objects.create(
            account_holder=self.user,
            merchant_name='Bet365',
            category='Gambling',
            rule_type='block'
        )
        decision, _, meta = check_transaction(
            self.user, Decimal('10.00'), 'Bet365'
        )
        self.assertEqual(decision, 'REJECTED')
        self.assertEqual(meta['gate'], 'merchant')

    def test_allowed_merchant_approved(self):
        """Transactions to allowed merchants are approved."""
        MerchantWhitelist.objects.create(
            account_holder=self.user,
            merchant_name='Tesco',
            category='Groceries',
            rule_type='allow'
        )
        decision, _, meta = check_transaction(
            self.user, Decimal('10.00'), 'Tesco'
        )
        self.assertEqual(decision, 'APPROVED')
        self.assertEqual(meta['gate'], 'merchant')

    def test_require_approval_merchant_pending(self):
        """Transactions to require_approval merchants are pending."""
        MerchantWhitelist.objects.create(
            account_holder=self.user,
            merchant_name='Amazon',
            category='Shopping',
            rule_type='require_approval'
        )
        decision, _, meta = check_transaction(
            self.user, Decimal('10.00'), 'Amazon'
        )
        self.assertEqual(decision, 'PENDING')
        self.assertEqual(meta['gate'], 'merchant')

    def test_fuzzy_merchant_matching(self):
        """Merchant matching is fuzzy — 'Tesco' matches 'TESCO EXPRESS'."""
        MerchantWhitelist.objects.create(
            account_holder=self.user,
            merchant_name='Tesco',
            category='Groceries',
            rule_type='block'
        )
        decision, _, meta = check_transaction(
            self.user, Decimal('10.00'), 'TESCO EXPRESS'
        )
        self.assertEqual(decision, 'REJECTED')
        self.assertEqual(meta['gate'], 'merchant')

    def test_block_takes_priority_over_allow(self):
        """Block rule takes priority over allow rule for same merchant."""
        MerchantWhitelist.objects.create(
            account_holder=self.user,
            merchant_name='Tesco',
            category='Groceries',
            rule_type='allow'
        )
        MerchantWhitelist.objects.create(
            account_holder=self.user,
            merchant_name='TESCO EXPRESS',
            category='Groceries',
            rule_type='block'
        )
        decision, _, _ = check_transaction(
            self.user, Decimal('10.00'), 'TESCO EXPRESS'
        )
        self.assertEqual(decision, 'REJECTED')


class PermissionEngineSpendLimitTests(TestCase):
    """Tests for Gate 3 - Daily Spend Limits."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='spend_test_user', password=TEST_PASSWORD
        )
        SafeSpendLimit.objects.filter(account_holder=self.user).update(
            daily_limit=Decimal('100.00'),
            daily_spent=Decimal('0.00'),
            allow_late_night=True,
            last_reset_date=timezone.now().date()
        )
        self.user = User.objects.get(username='spend_test_user')

    def test_within_limit_approved(self):
        """Transaction within daily limit is approved."""
        decision, _, _ = check_transaction(
            self.user, Decimal('50.00'), 'Unknown Shop'
        )
        self.assertEqual(decision, 'APPROVED')

    def test_exceeds_limit_pending(self):
        SafeSpendLimit.objects.filter(account_holder=self.user).update(
            daily_spent=Decimal('90.00'),
            last_reset_date=timezone.now().date()
        )
        self.user = User.objects.get(username='spend_test_user')
        decision, _, meta = check_transaction(
            self.user, Decimal('50.00'), 'Unknown Shop'
        )
        self.assertEqual(decision, 'PENDING')
        self.assertEqual(meta['gate'], 'limit')

    def test_exact_limit_approved(self):
        """Transaction exactly at daily limit is approved."""
        SafeSpendLimit.objects.filter(account_holder=self.user).update(
            daily_spent=Decimal('0.00')
        )
        decision, _, _ = check_transaction(
            self.user, Decimal('100.00'), 'Unknown Shop'
        )
        self.assertEqual(decision, 'APPROVED')

    def test_one_penny_over_limit_pending(self):
        """Transaction one penny over daily limit is pending."""
        SafeSpendLimit.objects.filter(account_holder=self.user).update(
            daily_spent=Decimal('0.00')
        )
        decision, _, meta = check_transaction(
            self.user, Decimal('100.01'), 'Unknown Shop'
        )
        self.assertEqual(decision, 'PENDING')
        self.assertEqual(meta['gate'], 'limit')

    def test_no_safe_spend_limit_approved(self):
        new_user = User.objects.create_user(
            username='no_limit_user', password=TEST_PASSWORD
        )
        # Manually delete and verify PermissionEngine handles None gracefully
        SafeSpendLimit.objects.filter(account_holder=new_user).delete()
        # Access safe_spend directly to bypass signal recreation
        from banking.governance import PermissionEngine
        engine = PermissionEngine(new_user, Decimal('999.99'), 'Unknown Shop')
        engine.safe_spend = None  # Force None
        decision, _, _ = engine.evaluate()
        self.assertEqual(decision, 'APPROVED')


class PermissionEngineDefaultApprovalTests(TestCase):
    """Tests for default approval when no rules match."""

    def setUp(self):
        self.user = User.objects.create_user(
            username='default_test_user', password=TEST_PASSWORD
        )
        SafeSpendLimit.objects.filter(account_holder=self.user).update(
            daily_limit=Decimal('100.00'),
            daily_spent=Decimal('0.00'),
            allow_late_night=True,
        )

    def test_unknown_merchant_default_approved(self):
        """Transaction to unknown merchant with no rules is approved."""
        decision, _, meta = check_transaction(
            self.user, Decimal('10.00'), 'Unknown Shop'
        )
        self.assertEqual(decision, 'APPROVED')
        self.assertEqual(meta['gate'], 'default')