from rest_framework import serializers
from .models import Transaction, Account, Business, PendingTransaction
from .guardian_models import UserProfile, SafeSpendLimit, MerchantWhitelist
from django.contrib.auth.models import User

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name']
        read_only_fields = ['id']

class AccountSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)
    account_type_display = serializers.CharField(source='get_account_type_display', read_only=True)
    
    class Meta:
        model = Account
        fields = [
            'id', 'name', 'starting_balance', 'round_up_enabled', 
            'postcode', 'user', 'user_details', 'account_type', 
            'account_type_display', 'round_up_pot'
        ]
        
class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = ['id', 'transaction_type', 'amount', 'from_account', 'to_account', 'business', 'timestamp',        # Internal fields 
                  'external_id', 'payment_status'                                        # External integration fields
                  ]

class BusinessSerializer(serializers.ModelSerializer):
    class Meta:
        model = Business
        fields = ['id', 'name', 'category', 'sanctioned']
        
class PendingTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PendingTransaction
        fields = [
            'id', 'account_holder', 'guardian', 'amount', 'merchant_name',
            'status', 'reason_flag', 'created_at', 'guardian_notes',
            # New external integration fields
            'external_id', 'payment_status',
        ]
        read_only_fields = ['external_id', 'gateway_response', 'gateway_name', 'payment_status']
        
class MerchantWhitelistSerializer(serializers.ModelSerializer):
    class Meta:
        model = MerchantWhitelist
        fields = ['id', 'merchant_name', 'category', 'rule_type']        