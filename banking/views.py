from decimal import Decimal
from datetime import timedelta
from django.db import transaction
from django.db.models import Sum
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.exceptions import PermissionDenied

from django.conf import settings
import requests as http_requests

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.exceptions import (
    PermissionDenied as DRFPermissionDenied, 
    ValidationError as DRFValidationError
)
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.decorators import action

import logging
audit_logger = logging.getLogger('banking.audit')

# Models & Serializers
from .models import Account, Transaction, Business, PendingTransaction, AnomalyAlert
from .serializers import AccountSerializer, TransactionSerializer, BusinessSerializer, PendingTransactionSerializer, MerchantWhitelistSerializer
from .guardian_models import SafeSpendLimit, UserProfile, MerchantWhitelist
from .governance import check_transaction
from .services import execute_pending_approval_flow
from .anomaly_detection import detect_anomalies
from .throttles import TransactionRateThrottle

# ========== Registration ==========

class UserRegistrationView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response({"error": "Username and password required"}, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.create_user(username=username, password=password, email='')
            accounts = Account.objects.filter(user=user)
            return Response({
                "message": "User registered successfully",
                "user_id": user.id,
                "accounts": [
                    {
                        "id": str(acc.id), 
                        "name": acc.name, 
                        "type": acc.get_account_type_display(), 
                        "balance": str(acc.starting_balance)
                    } for acc in accounts
                ]
            }, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

# ========== Accounts ==========

class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer

    def get_queryset(self):
        user = self.request.user
        if not user or not user.is_authenticated:
            return Account.objects.none()
        if user.is_staff:
            return Account.objects.all()
        return Account.objects.filter(user=user)

    @action(detail=True, methods=['get'], url_path='current-balance', url_name='current-balance')
    def current_balance(self, request, pk=None):
        account = self.get_object()
        txs = Transaction.objects.filter(from_account=account)
        spent = txs.filter(transaction_type="payment").aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        received = txs.filter(transaction_type="deposit").aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        balance = account.starting_balance + received - spent
        return Response({"current_balance": str(balance)})

    @action(detail=True, methods=['get'], url_path='roundups', url_name='roundups')
    def roundups(self, request, pk=None):
        """Historical roundup data for the account."""
        account = self.get_object()
        return Response({
            "savings": str(account.round_up_pot),
            "round_up_enabled": account.round_up_enabled,
        })

    @action(detail=True, methods=['get'], url_path='spending-trends', url_name='spending-trends')
    def spending_trends(self, request, pk=None):
        account = self.get_object()
        summary = Transaction.objects.filter(from_account=account, transaction_type="payment")\
                  .values('business__category').annotate(total=Sum('amount'))
        return Response(list(summary))

    @action(detail=True, methods=['post'], url_path='enable-roundup', url_name='enable-roundup')
    def enable_roundup(self, request, pk=None):
        account = self.get_object()
        account.round_up_enabled = True
        account.save()
        return Response({"status": "roundup enabled"})

    @action(detail=True, methods=['post'], url_path='reclaim-roundup', url_name='reclaim-roundup')
    def reclaim_roundup(self, request, pk=None):
        return Response({"status": "roundup reclaimed"})
    
    

# ========== Transactions ==========

class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return Transaction.objects.all()
        return Transaction.objects.filter(from_account__user=self.request.user)

    def perform_create(self, serializer):
        amount = Decimal(str(self.request.data.get('amount', '0')))
        from_acc_id = self.request.data.get('from_account')
        merchant = self.request.data.get('merchant_name', 'Unknown')
        
        from_account = Account.objects.get(id=from_acc_id)
        decision, reason, _ = check_transaction(self.request.user, amount, merchant)

        if decision == 'REJECTED':
            raise DRFValidationError({"status": "REJECTED", "message": reason})

        if decision == 'PENDING':
            PendingTransaction.objects.create(
                account_holder=self.request.user,
                amount=amount,
                merchant_name=merchant,
                reason_flag=reason[:100]
            )
            raise DRFValidationError({"status": "PENDING", "message": reason})

        serializer.save(from_account=from_account)
        transaction = serializer.instance
        detect_anomalies(from_account.user, transaction)

    @action(detail=False, methods=['get'], url_path='account/(?P<account_id>[^/.]+)', url_name='account-transactions')
    def account_transactions(self, request, account_id=None):
        account = Account.objects.get(id=account_id)
        if account.user != request.user and not request.user.is_staff:
            return Response({"error": "Forbidden"}, status=403)
        transactions = Transaction.objects.filter(from_account=account)
        return Response(self.get_serializer(transactions, many=True).data)

    @action(detail=False, methods=['get'], url_path='spending-summary/(?P<account_id>[^/.]+)', url_name='spending-summary')
    def spending_summary(self, request, account_id=None):
        account = Account.objects.get(id=account_id)
        if account.user != request.user and not request.user.is_staff:
            return Response({"error": "Forbidden"}, status=403)
        summary = Transaction.objects.filter(from_account=account, transaction_type="payment")\
                  .values('business__category').annotate(total=Sum('amount'))
        return Response(list(summary))

    @action(detail=False, methods=['get'], url_path='top-10-spenders', url_name='top-10-spenders')
    def top_10_spenders(self, request):
        if not request.user.is_staff:
            return Response({"error": "Forbidden"}, status=403)
        top = Transaction.objects.filter(transaction_type="payment")\
              .values('from_account__user__username')\
              .annotate(total_spent=Sum('amount')).order_by('-total_spent')[:10]
        return Response(list(top))
    
    class TransactionViewSet(viewsets.ModelViewSet):
        serializer_class = TransactionSerializer
        throttle_classes = [TransactionRateThrottle]

# ========== Business ==========

class BusinessViewSet(viewsets.ModelViewSet):
    queryset = Business.objects.all()
    serializer_class = BusinessSerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAdminUser()]

# ========== Guardians ==========

class GuardianViewSet(viewsets.GenericViewSet):
    permission_classes = [IsAuthenticated]
    serializer_class = None

    def get_guardian_profile(self):
        profile = UserProfile.objects.filter(user=self.request.user).first()
        if not profile or not profile.is_guardian:
            raise DRFPermissionDenied("Guardian privileges required.")
        return profile

    def verify_managed_user(self, user_id):
        profile = self.get_guardian_profile()
        holder = User.objects.filter(id=user_id).first()
        if not profile.managed_accounts.filter(id=user_id).exists():
            raise DRFPermissionDenied("You do not manage this account.")
        return holder

    @action(detail=False, methods=['get'], url_path='pending-reviews')
    def pending_reviews(self, request):
        profile = self.get_guardian_profile()
        ids = profile.managed_accounts.values_list('id', flat=True)
        pending = PendingTransaction.objects.filter(account_holder_id__in=ids, status='pending')
        data = [{'pending_id': str(p.id), 'amount': f"{p.amount:.2f}", 'merchant': p.merchant_name} for p in pending]
        return Response({'pending_transactions': data})

    @action(detail=False, methods=['post'], url_path='approve-transaction')
    def approve_transaction(self, request):
        pending_id = request.data.get('pending_id')
        pending = PendingTransaction.objects.get(id=pending_id)
        self.verify_managed_user(pending.account_holder.id)
        result = execute_pending_approval_flow(pending_id, request.user, request.data.get('notes', ''))
        audit_logger.info(
            'APPROVE | guardian=%s | pending_id=%s | holder=%s | amount=%s | merchant=%s',
            request.user.username,
            pending_id,
            pending.account_holder.username,
            pending.amount,
            pending.merchant_name
        )
        return Response({'status': result['status']})

    @action(detail=True, methods=['patch'], url_path='update-limits', url_name='update-limits')
    def update_limits(self, request, pk=None):
        holder = self.verify_managed_user(pk)
        limit, _ = SafeSpendLimit.objects.get_or_create(account_holder=holder)
        for field in ['daily_limit', 'allow_late_night', 'quiet_hours_start', 'quiet_hours_end']:
            if field in request.data:
                setattr(limit, field, request.data[field])
        limit.save()
        return Response({'status': 'updated'})

    @action(detail=True, methods=['get'], url_path='activity-feed', url_name='activity-feed')
    def activity_feed(self, request, pk=None):
        holder = self.verify_managed_user(pk)
        txs = Transaction.objects.filter(from_account__user=holder).order_by('-timestamp')[:20]
        data = [{'amount': str(t.amount), 'merchant': t.merchant_name, 'transaction_type': t.transaction_type} for t in txs]
        return Response({'feed': data})
    
    @action(detail=False, methods=['get'], url_path='my-pending')
    def my_pending(self, request):
        pending = PendingTransaction.objects.filter(
        account_holder=request.user,
        status='pending'
    ).order_by('-created_at')
        data = [{
        'pending_id': str(p.id),
        'amount': f"{p.amount:.2f}",
        'merchant': p.merchant_name,
        'created_at': p.created_at.isoformat(),
        'status': p.status,
        'reason_flag': p.reason_flag,
        } for p in pending]
        return Response({'pending_transactions': data})
    
    @action(detail=False, methods=['post'], url_path='reject-transaction')
    def reject_transaction(self, request):
        pending_id = request.data.get('pending_id')
        notes = request.data.get('notes', '')
        pending = PendingTransaction.objects.get(id=pending_id)
        self.verify_managed_user(pending.account_holder.id)
        pending.status = 'rejected'
        pending.guardian_notes = notes
        pending.guardian = request.user
        pending.save()
        audit_logger.info(
            'REJECT | guardian=%s | pending_id=%s | holder=%s | amount=%s | merchant=%s',
            request.user.username,
            pending_id,
            pending.account_holder.username,
            pending.amount,
            pending.merchant_name
        )
        return Response({'status': 'rejected'})

    @action(detail=True, methods=['get'], url_path='whitelist')
    def whitelist_list(self, request, pk=None):
        """
        GET /api/guardian/{pk}/whitelist/
        Returns all whitelist rules for the given account holder.
        """
        account_holder = self.verify_guardian_manages_account_holder(pk)
        rules = MerchantWhitelist.objects.filter(account_holder=account_holder)
        serializer = MerchantWhitelistSerializer(rules, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'], url_path='whitelist')
    def whitelist(self, request, pk=None):
        holder = self.verify_managed_user(pk)
        
        if request.method == 'GET':
            rules = MerchantWhitelist.objects.filter(account_holder=holder)
            serializer = MerchantWhitelistSerializer(rules, many=True)
            return Response(serializer.data)
        
        if request.method == 'POST':
            serializer = MerchantWhitelistSerializer(data=request.data)
            if serializer.is_valid():
                serializer.save(account_holder=holder)
                return Response(serializer.data, status=201)
            return Response(serializer.errors, status=400)

    @action(detail=True, methods=['delete'], url_path='whitelist/(?P<rule_id>[^/.]+)')
    def whitelist_delete(self, request, pk=None, rule_id=None):
        holder = self.verify_managed_user(pk)
        try:
            rule = MerchantWhitelist.objects.get(id=rule_id, account_holder=holder)
            rule.delete()
            return Response({'status': 'deleted'}, status=204)
        except MerchantWhitelist.DoesNotExist:
            return Response({'error': 'Rule not found'}, status=404)
        
    @action(detail=False, methods=['get'], url_path='managed-accounts')
    def managed_accounts(self, request):
        profile = self.get_guardian_profile()
        accounts = profile.managed_accounts.all()
        data = [{'id': u.id, 'username': u.username} for u in accounts]
        return Response({'managed_accounts': data})    
    
    @action(detail=False, methods=['get'], url_path='pending-count')
    def pending_count(self, request):
        guardian_profile = self.get_guardian_profile()
        managed_user_ids = guardian_profile.managed_accounts.values_list('id', flat=True)
        count = PendingTransaction.objects.filter(
            account_holder__id__in=managed_user_ids,
            status='pending'
        ).count()
        return Response({'count': count})
    
    @action(detail=True, methods=['post'], url_path='anomaly-alerts/(?P<alert_id>[^/.]+)/resolve')
    def resolve_anomaly_alert(self, request, pk=None, alert_id=None):
        holder = self.verify_managed_user(pk)
        try:
            alert = AnomalyAlert.objects.get(id=alert_id, account_holder=holder)
        except AnomalyAlert.DoesNotExist:
            return Response({'error': 'Alert not found'}, status=404)
        
        resolution = request.data.get('resolution', 'reviewed')
        if resolution not in ['reviewed', 'ignored']:
            return Response({'error': 'Invalid resolution'}, status=400)
        
        alert.status = resolution
        alert.reviewed_by = request.user
        alert.reviewed_at = timezone.now()
        alert.save()
        return Response({'status': alert.status})
    
class CardBalanceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        api_key = settings.NFC_API_KEY
        if not api_key:
            return Response({"error": "Payment network not configured"}, status=503)
        
        try:
            response = http_requests.get(
                'https://paymentsystem-cards-cf.pages.dev/api/cards/me',
                headers={'X-API-Key': api_key},
                timeout=5
            )
            return Response(response.json())
        except http_requests.exceptions.Timeout:
            return Response({"error": "Payment network timed out"}, status=504)
        except http_requests.exceptions.RequestException:
            return Response({"error": "Payment network unreachable"}, status=503)