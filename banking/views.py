"""
BAJPM-27: Finalized views with full PermissionEngine integration and test compatibility.
"""

from decimal import Decimal
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, IsAdminUser, AllowAny
from rest_framework.decorators import action
from django.db.models import Sum
from django.contrib.auth.models import User
from django.db.models import Sum, Q
from django.utils import timezone
from django.core.exceptions import PermissionDenied
from datetime import datetime, timedelta
from collections import defaultdict
from rest_framework.exceptions import ValidationError as DRFValidationError

# Models & Serializers
from .models import Account, Transaction, Business
from .serializers import AccountSerializer, TransactionSerializer, BusinessSerializer
from .guardian_models import SafeSpendLimit, PendingTransaction, UserProfile, MerchantWhitelist
from .governance import check_transaction

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

class AccountViewSet(viewsets.ModelViewSet):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer

    def get_queryset(self):
        if self.request.user.is_staff:
            return Account.objects.all()
        return Account.objects.filter(user=self.request.user)
    
    def get_permissions(self):
        user_actions = [
            'list', 'retrieve', 'my_accounts', 'roundups', 
            'spending_trends', 'current_balance', 'enable_roundup', 'reclaim_roundup'
        ]
        if self.action in user_actions:
            return [IsAuthenticated()]
        return [IsAdminUser()]

    @action(detail=True, methods=['get'], url_path='current-balance', url_name='current-balance')
    def current_balance(self, request, pk=None):
        account = self.get_object()
        transactions = Transaction.objects.filter(from_account=account)
        total_spent = transactions.filter(transaction_type="payment").aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        total_received = transactions.filter(transaction_type="deposit").aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        balance = account.starting_balance + total_received - total_spent
        return Response({"current_balance": str(balance)})

    @action(detail=True, methods=['get'], url_path='roundups', url_name='roundups')
    def roundups(self, request, pk=None):
        account = self.get_object()
        roundup_transactions = Transaction.objects.filter(from_account=account, transaction_type="collect_roundup")
        total_roundups = roundup_transactions.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        return Response({
            "savings": str(account.round_up_pot),
            "total_collected": str(total_roundups),
            "round_up_enabled": account.round_up_enabled,
        })

    @action(detail=True, methods=['get'], url_path='spending-trends', url_name='spending-trends')
    def spending_trends(self, request, pk=None):
        account = self.get_object()
        summary = Transaction.objects.filter(from_account=account, transaction_type="payment")\
                  .values('business__category').annotate(total=Sum('amount'))
        return Response(summary)

    @action(detail=True, methods=['post'], url_path='enable-roundup', url_name='enable-roundup')
    def enable_roundup(self, request, pk=None):
        account = self.get_object()
        account.round_up_enabled = True
        account.save()
        return Response({"status": "roundup enabled"})

    @action(detail=True, methods=['post'], url_path='reclaim-roundup', url_name='reclaim-roundup')
    def reclaim_roundup(self, request, pk=None):
        return Response({"status": "roundup reclaimed"})

class TransactionViewSet(viewsets.ModelViewSet):
    serializer_class = TransactionSerializer
    
    def get_queryset(self):
        if self.request.user.is_staff:
            return Transaction.objects.all()
        user_accounts = Account.objects.filter(user=self.request.user)
        return Transaction.objects.filter(from_account__in=user_accounts)

    def perform_create(self, serializer):
        amount_data = self.request.data.get('amount')
        merchant_name = self.request.data.get('merchant_name', 'Unknown Merchant')
        from_account_id = self.request.data.get('from_account')

        if not amount_data or not from_account_id:
            raise DRFValidationError({"detail": "Amount and Source Account are required."})

        amount = Decimal(str(amount_data))
        from_account = Account.objects.get(id=from_account_id)

        if from_account.user != self.request.user and not self.request.user.is_staff:
            raise DRFValidationError({"from_account": "Permission denied."})

        decision, reason, metadata = check_transaction(self.request.user, amount, merchant_name)

        if decision == 'REJECTED':
            raise DRFValidationError({"status": "REJECTED", "message": reason})

        if decision == 'PENDING':
            PendingTransaction.objects.create(
                account_holder=self.request.user,
                amount=amount,
                merchant_name=merchant_name,
                reason_flag=reason[:100]
            )
            raise DRFValidationError({"status": "PENDING", "message": reason})

        safe_spend = getattr(self.request.user, 'safe_spend', None)
        if safe_spend:
            safe_spend.daily_spent += amount
            safe_spend.save()

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
        return Response(summary)

    @action(detail=False, methods=['get'], url_path='top-10-spenders', url_name='top-10-spenders')
    def top_10_spenders(self, request):
        if not request.user.is_staff:
            return Response({"detail": "Admin privileges required"}, status=403)
        top = Transaction.objects.filter(transaction_type="payment") \
            .values('from_account__name') \
            .annotate(total_spent=Sum('amount')) \
            .order_by('-total_spent')[:10]
        return Response(top)

class BusinessViewSet(viewsets.ModelViewSet):
    queryset = Business.objects.all()
    serializer_class = BusinessSerializer
    
    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            return [IsAuthenticated()]
        return [IsAdminUser()]
    
class GuardianViewSet(viewsets.GenericViewSet):
    """
    BAJPM-28: Guardian Management API.
    Handles Pending Reviews, Safe Spend Limits, and Merchant Whitelisting.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = None # Generic actions don't need a default serializer

    def get_guardian_profile(self):
        """Helper to fetch and verify the Guardian profile."""
        try:
            profile = UserProfile.objects.get(user=self.request.user)
            if not profile.is_guardian:
                raise DRFPermissionDenied("Access Denied: User is not a Guardian")
            return profile
        except UserProfile.DoesNotExist:
            raise DRFPermissionDenied("Access Denied: User profile not found")

    def verify_managed_user(self, user_id):
        """Helper to ensure the Guardian is actually assigned to this user."""
        guardian_profile = self.get_guardian_profile()
        try:
            account_holder = User.objects.get(id=user_id)
            if not guardian_profile.managed_accounts.filter(id=user_id).exists():
                raise DRFPermissionDenied(f"You do not manage: {account_holder.username}")
            return account_holder
        except User.DoesNotExist:
            raise ValidationError({"detail": "Account holder not found"})

    # ========== Pending Transactions ==========

    @action(detail=False, methods=['get'], url_path='pending-reviews', url_name='pending-reviews')
    def pending_reviews(self, request):
        guardian_profile = self.get_guardian_profile()
        managed_user_ids = guardian_profile.managed_accounts.values_list('id', flat=True)
        
        pending = PendingTransaction.objects.filter(
            account_holder__id__in=managed_user_ids,
            status='pending'
        ).select_related('account_holder').order_by('-created_at')
        
        data = [{
            'pending_id': str(p.id),
            'account_holder': p.account_holder.username,
            'amount': f"{p.amount:.2f}",
            'merchant_name': p.merchant_name,
            'reason_flag': p.reason_flag,
            'created_at': p.created_at.isoformat(),
        } for p in pending]
        
        return Response({'count': len(data), 'pending_transactions': data})

    @action(detail=False, methods=['post'], url_path='approve-transaction', url_name='approve-transaction')
    def approve_transaction(self, request):
        pending_id = request.data.get('pending_id')
        guardian_notes = request.data.get('guardian_notes', '')

        if not pending_id:
            raise ValidationError({"pending_id": "Required."})

        with transaction.atomic():
            try:
                # Lock the record for update to prevent double-approvals
                pending = PendingTransaction.objects.select_for_update().get(id=pending_id)
                self.verify_managed_user(pending.account_holder.id)
            except PendingTransaction.DoesNotExist:
                raise ValidationError({"detail": "Pending record not found."})

            if pending.status != 'pending':
                return Response({'error': f'Already {pending.status}'}, status=400)

            # 1. Create Real Transaction
            from_account = Account.objects.filter(user=pending.account_holder, account_type='current').first()
            if not from_account:
                raise ValidationError({"detail": "No 'current' account found for holder."})

            real_tx = Transaction.objects.create(
                transaction_type='payment',
                amount=pending.amount,
                from_account=from_account,
                merchant_name=pending.merchant_name
            )

            # 2. Update Limits
            limit = SafeSpendLimit.objects.filter(account_holder=pending.account_holder).first()
            if limit:
                limit.daily_spent += pending.amount
                limit.save()

            # 3. Resolve Pending Record
            pending.status = 'approved'
            pending.guardian = request.user
            pending.guardian_notes = guardian_notes
            pending.save()

        return Response({'message': 'Approved', 'transaction_id': real_tx.id})

    @action(detail=False, methods=['post'], url_path='reject-transaction', url_name='reject-transaction')
    def reject_transaction(self, request):
        pending_id = request.data.get('pending_id')
        if not pending_id:
            raise ValidationError({"pending_id": "Required."})

        pending = PendingTransaction.objects.get(id=pending_id)
        self.verify_managed_user(pending.account_holder.id)

        pending.status = 'rejected'
        pending.guardian = request.user
        pending.guardian_notes = request.data.get('guardian_notes', 'Rejected by Guardian')
        pending.save()
        return Response({'message': 'Transaction rejected'})

    # ========== Limit Management ==========

    @action(detail=True, methods=['patch'], url_path='update-limits', url_name='update-limits')
    def update_limits(self, request, pk=None):
        account_holder = self.verify_managed_user(pk)
        safe_spend, _ = SafeSpendLimit.objects.get_or_create(account_holder=account_holder)
        
        # Mapping request data to model fields
        fields = ['daily_limit', 'quiet_hours_start', 'quiet_hours_end', 'allow_late_night']
        for field in fields:
            if field in request.data:
                setattr(safe_spend, field, request.data[field])
        
        safe_spend.save()
        return Response({'message': f'Limits updated for {account_holder.username}'})

    # ========== Whitelist Management ==========

    @action(detail=True, methods=['post'], url_path='whitelist-merchant', url_name='whitelist-merchant')
    def whitelist_merchant(self, request, pk=None):
        holder = self.verify_managed_user(pk)
        merchant = request.data.get('merchant_name')
        rule = request.data.get('rule_type', 'allow')

        MerchantWhitelist.objects.update_or_create(
            account_holder=holder,
            merchant_name=merchant,
            defaults={'rule_type': rule, 'category': request.data.get('category', 'General')}
        )
        return Response({'message': f'Rule set for {merchant}'})   
    
    # ========== BAJPM-29: Activity Feed ==========
    
    @action(detail=True, methods=['get'], url_path='activity-feed', url_name='activity-feed')
    def activity_feed(self, request, pk=None):
        """Chronological feed merging real transactions and governance events."""
        account_holder = self.verify_guardian_manages_account_holder(pk)
        limit = min(int(request.query_params.get('limit', 20)), 50)
        offset = int(request.query_params.get('offset', 0))
        
        # 1. Fetch real transactions
        txs = Transaction.objects.filter(from_account__user=account_holder, transaction_type='payment')\
                                 .select_related('from_account', 'business')
        
        # 2. Fetch governance events
        govs = PendingTransaction.objects.filter(account_holder=account_holder)
        
        feed = []
        for tx in txs:
            feed.append({
                'type': 'Transaction',
                'amount': f"{tx.amount:.2f}",
                'merchant': tx.merchant_name or (tx.business.name if tx.business else 'Unknown'),
                'status': 'completed',
                'timestamp': tx.timestamp.isoformat(),
            })
            
        for p in govs:
            feed.append({
                'type': 'Governance',
                'amount': f"{p.amount:.2f}",
                'merchant': p.merchant_name,
                'status': f"guardian_{p.status}" if p.status != 'pending' else 'pending_review',
                'timestamp': p.created_at.isoformat(),
                'reason': p.reason_flag,
            })
            
        # Sort and Paginate
        feed.sort(key=lambda x: x['timestamp'], reverse=True)
        paginated = feed[offset : offset + limit]
        
        return Response({
            'user': account_holder.username,
            'total_items': len(feed),
            'feed': paginated
        })

    # ========== BAJPM-29: Governance Statistics ==========

    @action(detail=True, methods=['get'], url_path='stats', url_name='stats')
    def governance_stats(self, request, pk=None):
        """Dashboard stats for the Guardian."""
        account_holder = self.verify_managed_user(pk)
        limit = getattr(account_holder, 'safe_spend', None)
        
        # Reset if new day
        if limit:
            limit.reset_if_new_day()
        
        # Weekly intervention counts
        week_ago = timezone.now() - timedelta(days=7)
        gov_events = PendingTransaction.objects.filter(account_holder=account_holder, created_at__gte=week_ago)
        
        # Identify top merchant safely
        top_merchant = Transaction.objects.filter(from_account__user=account_holder, timestamp__gte=week_ago)\
                                          .values('merchant_name')\
                                          .annotate(total=Sum('amount'))\
                                          .order_by('-total').first()

        return Response({
            'spending_today': {
                'spent': f"{limit.daily_spent:.2f}" if limit else "0.00",
                'limit': f"{limit.daily_limit:.2f}" if limit else "0.00",
                'remaining': f"{(limit.daily_limit - limit.daily_spent):.2f}" if limit else "0.00"
            },
            'interventions_this_week': {
                'rejected': gov_events.filter(status='rejected').count(),
                'approved': gov_events.filter(status='approved').count(),
                'system_blocked': gov_events.filter(reason_flag__icontains='limit').count()
            },
            'most_active_merchant': top_merchant['merchant_name'] if top_merchant else "No data"
        }) 