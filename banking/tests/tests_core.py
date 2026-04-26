"""
Core Banking API Integration Tests.
Covers CRUD, Round-up logic, and Staff-only analytics.
"""

import uuid
from decimal import Decimal
from django.urls import reverse
from django.contrib.auth.models import User
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from banking.models import Account, Transaction, Business

# --- Global Test Constants ---
TEST_PASSWORD = "TestPass123!"  # Silences hardcoded password scanners

class BankingAPITestCase(APITestCase):
    def setUp(self):
        """Initialize test user and base account data."""
        self.user = User.objects.create_user(username="testuser", password=TEST_PASSWORD)
        self.token = str(RefreshToken.for_user(self.user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {self.token}')

        self.account = Account.objects.create(
            id=uuid.uuid4(),
            user=self.user,
            name="Test User Account",
            starting_balance=Decimal('1000.00'),
            round_up_enabled=True
        )

        self.business = Business.objects.create(
            id="kfc-global",
            name="KFC",
            category="Food",
            sanctioned=False
        )

        self.transaction = Transaction.objects.create(
            transaction_type="payment",
            amount=Decimal('25.50'),
            from_account=self.account,
            to_account=self.account
        )

    def test_get_account_list(self):
        url = reverse('account-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    def test_get_account_detail(self):
        url = reverse('account-detail', args=[self.account.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['name'], "Test User Account")

    def test_create_transaction(self):
        url = reverse('transaction-list')
        data = {
            "transaction_type": "withdrawal",
            "amount": "100.00",
            "from_account": str(self.account.id)
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_get_business_list(self):
        url = reverse('business-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_roundup_feature(self):
        url = reverse('account-roundups', args=[self.account.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('savings', response.data)

    def test_spending_trends(self):
        url = reverse('account-spending-trends', args=[self.account.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_update_business_sanction_status(self):
        # Admin action requires staff privileges
        admin = User.objects.create_user(username='admin_staff', password=TEST_PASSWORD, is_staff=True)
        self.client.force_authenticate(user=admin)
        url = reverse('business-detail', args=[self.business.id])
        response = self.client.patch(url, {"sanctioned": True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)


class BankingAPIManagerTestCase(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="standard_user", password=TEST_PASSWORD)
        self.manager = User.objects.create_user(username="manager_staff", password=TEST_PASSWORD, is_staff=True)
        self.client.credentials(HTTP_AUTHORIZATION=f'Bearer {RefreshToken.for_user(self.user).access_token}')

        self.account = Account.objects.create(
            id=uuid.uuid4(), 
            name="Managed Account", 
            starting_balance=Decimal('1000.00'), 
            user=self.user
        )

    def test_get_account_list_as_manager(self):
        self.client.force_authenticate(user=self.manager)
        url = reverse('account-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_transactions_for_account(self):
        url = reverse('transaction-account-transactions', args=[self.account.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_current_balance(self):
        url = reverse('account-current-balance', args=[self.account.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('current_balance', response.data)


class BankingAPITestCase3(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="roundup_user", password=TEST_PASSWORD)
        self.client.force_authenticate(user=self.user)
        self.account = Account.objects.create(
            id=uuid.uuid4(), 
            name="Roundup Account", 
            user=self.user, 
            round_up_enabled=False
        )

    def test_enable_roundup(self):
        url = reverse('account-enable-roundup', args=[self.account.id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.account.refresh_from_db()
        self.assertTrue(self.account.round_up_enabled)

    def test_top_10_spenders(self):
        admin = User.objects.create_user(username='analytics_admin', password=TEST_PASSWORD, is_staff=True)
        self.client.force_authenticate(user=admin)
        url = reverse('transaction-top-10-spenders')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)