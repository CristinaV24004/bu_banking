"""
Unified Banking & Guardian API.
"""

from decimal import Decimal
from datetime import timedelta
from django.db import transaction
from django.db.models import Sum
from django.contrib.auth.models import User
from django.utils import timezone
from django.core.exceptions import PermissionDenied

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.exceptions import (
    PermissionDenied as DRFPermissionDenied, 
    ValidationError as DRFValidationError
)
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.decorators import action

# Models & Serializers
from .models import Account, Transaction, Business, PendingTransaction
from .serializers import AccountSerializer, TransactionSerializer, BusinessSerializer, PendingTransactionSerializer
from .guardian_models import SafeSpendLimit, UserProfile, MerchantWhitelist
from .governance import check_transaction
from .services import execute_pending_approval_flow

# ========== Registration ==========

class UserRegistrationView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        password = request.data.get('password')
        email = request.data.get('email', '')
        
        if not username or not password:
            return Response({"error": "Username and password required"}, status=status.HTTP_400_BAD_REQUEST)
        
        if User.objects.filter(username=username).exists():
            return Response({"error": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            user = User.objects.create_user(username=username, password=password, email=email)
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

    @action(detail=False, methods=['get'], url_path='account/(?P<account_id>[^/.]+)', url_name='account-transactions')
    def account_transactions(self, request, account_id=None):
        account = Account.objects.get(id=account_id)
        if account.user != request.user and not request.user.is_staff:
            return Response({"detail": "Forbidden"}, status=403)
        transactions = Transaction.objects.filter(from_account=account)
        return Response(self.get_serializer(transactions, many=True).data)

    @action(detail=False, methods=['get'], url_path='spending-summary/(?P<account_id>[^/.]+)', url_name='spending-summary')
    def spending_summary(self, request, account_id=None):
        account = Account.objects.get(id=account_id)
        if account.user != request.user and not request.user.is_staff:
            return Response({"detail": "Forbidden"}, status=403)
        summary = Transaction.objects.filter(from_account=account, transaction_type="payment")\
                  .values('business__category').annotate(total=Sum('amount'))
        return Response(list(summary))

    @action(detail=False, methods=['get'], url_path='top-10-spenders', url_name='top-10-spenders')
    def top_10_spenders(self, request):
        if not request.user.is_staff:
            return Response({"detail": "Forbidden"}, status=403)
        top = Transaction.objects.filter(transaction_type="payment")\
              .values('from_account__user__username')\
              .annotate(total_spent=Sum('amount')).order_by('-total_spent')[:10]
        return Response(list(top))

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
        result = execute_pending_approval_flow(pending_id, request.user, "Approved")
        return Response(result)

    @action(detail=True, methods=['patch'], url_path='update-limits', url_name='update-limits')
    def update_limits(self, request, pk=None):
        holder = self.verify_managed_user(pk)
        limit, _ = SafeSpendLimit.objects.get_or_create(account_holder=holder)
        for field in ['daily_limit', 'allow_late_night']:
            if field in request.data:
                setattr(limit, field, request.data[field])
        limit.save()
        return Response({'status': 'updated'})

    @action(detail=True, methods=['get'], url_path='activity-feed', url_name='activity-feed')
    def activity_feed(self, request, pk=None):
        holder = self.verify_managed_user(pk)
        txs = Transaction.objects.filter(from_account__user=holder).order_by('-timestamp')[:20]
        data = [{'amount': str(t.amount), 'merchant': t.merchant_name} for t in txs]
        return Response({'feed': data})