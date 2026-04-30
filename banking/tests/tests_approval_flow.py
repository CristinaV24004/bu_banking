"""
Guardian Approval Flow Integration Tests.
Covers: pending transaction creation, guardian approval, rejection.
"""

from decimal import Decimal
from django.urls import reverse
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from banking.models import Account, PendingTransaction
from banking.guardian_models import UserProfile, SafeSpendLimit, MerchantWhitelist

TEST_PASSWORD = "TestPass123!"


class GuardianApprovalFlowTests(APITestCase):
    """
    Tests the full guardian approval workflow:
    Account holder attempts transaction → goes pending → guardian approves/rejects
    """

    def setUp(self):
        # Create account holder
        self.holder = User.objects.create_user(
            username='test_holder', password=TEST_PASSWORD
        )
        self.holder = User.objects.get(username='test_holder')

        # Set up SafeSpendLimit to force PENDING via merchant whitelist
        SafeSpendLimit.objects.filter(account_holder=self.holder).update(
            daily_limit=Decimal('100.00'),
            daily_spent=Decimal('0.00'),
            allow_late_night=True,
            last_reset_date=timezone.now().date()
        )
        self.holder = User.objects.get(username='test_holder')

        # Create account for holder
        self.account = Account.objects.get(
            user=self.holder,
            account_type='current'
        )

        # Add require_approval whitelist rule
        MerchantWhitelist.objects.create(
            account_holder=self.holder,
            merchant_name='Tesco',
            category='Groceries',
            rule_type='require_approval'
        )

        # Create guardian
        self.guardian = User.objects.create_user(
            username='test_guardian', password=TEST_PASSWORD
        )
        UserProfile.objects.filter(user=self.guardian).update(
            is_guardian=True,
            is_account_holder=False
        )
        guardian_profile = UserProfile.objects.get(user=self.guardian)
        guardian_profile.managed_accounts.add(self.holder)
        self.guardian = User.objects.get(username='test_guardian')

        # Auth tokens
        self.holder_token = str(RefreshToken.for_user(self.holder).access_token)
        self.guardian_token = str(RefreshToken.for_user(self.guardian).access_token)

    def _auth_as_holder(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.holder_token}')

    def _auth_as_guardian(self):
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.guardian_token}')

    def test_transaction_goes_pending_for_require_approval_merchant(self):
        """Transaction to require_approval merchant creates a PendingTransaction."""
        self._auth_as_holder()
        url = reverse('transaction-list')
        data = {
            'transaction_type': 'payment',
            'amount': '25.00',
            'from_account': str(self.account.id),
            'merchant_name': 'Tesco'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data['status'], 'PENDING')
        self.assertTrue(
            PendingTransaction.objects.filter(
                account_holder=self.holder,
                merchant_name='Tesco',
                status='pending'
            ).exists()
        )

    def test_guardian_can_see_pending_reviews(self):
        """Guardian can fetch pending transactions for managed account holders."""
        PendingTransaction.objects.create(
            account_holder=self.holder,
            amount=Decimal('25.00'),
            merchant_name='Tesco',
            reason_flag='Guardian review required',
            status='pending'
        )
        self._auth_as_guardian()
        url = reverse('guardian-pending-reviews')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data['pending_transactions']), 1)

    def test_guardian_can_approve_transaction(self):
        """Guardian can approve a pending transaction."""
        pending = PendingTransaction.objects.create(
            account_holder=self.holder,
            amount=Decimal('25.00'),
            merchant_name='Tesco',
            reason_flag='Guardian review required',
            status='pending'
        )
        self._auth_as_guardian()
        url = reverse('guardian-approve-transaction')
        response = self.client.post(url, {
            'pending_id': pending.id,
            'notes': 'Approved in test'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pending.refresh_from_db()
        self.assertEqual(pending.status, 'approved')

    def test_guardian_can_reject_transaction(self):
        """Guardian can reject a pending transaction."""
        pending = PendingTransaction.objects.create(
            account_holder=self.holder,
            amount=Decimal('25.00'),
            merchant_name='Tesco',
            reason_flag='Guardian review required',
            status='pending'
        )
        self._auth_as_guardian()
        url = reverse('guardian-reject-transaction')
        response = self.client.post(url, {
            'pending_id': pending.id,
            'notes': 'Rejected in test'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pending.refresh_from_db()
        self.assertEqual(pending.status, 'rejected')

    def test_non_guardian_cannot_access_pending_reviews(self):
        """Account holder cannot access guardian pending reviews endpoint."""
        self._auth_as_holder()
        url = reverse('guardian-pending-reviews')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_guardian_cannot_approve_unmanaged_account(self):
        """Guardian cannot approve transactions for accounts they don't manage."""
        other_user = User.objects.create_user(
            username='other_holder', password=TEST_PASSWORD
        )
        pending = PendingTransaction.objects.create(
            account_holder=other_user,
            amount=Decimal('25.00'),
            merchant_name='Tesco',
            reason_flag='Guardian review required',
            status='pending'
        )
        self._auth_as_guardian()
        url = reverse('guardian-approve-transaction')
        response = self.client.post(url, {
            'pending_id': pending.id,
            'notes': 'Should not work'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)