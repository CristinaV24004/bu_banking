from django.contrib import admin
from .models import Account, Transaction, Business, PendingTransaction
from .guardian_models import UserProfile, SafeSpendLimit, MerchantWhitelist

admin.site.register(Account)
admin.site.register(Transaction)
admin.site.register(Business)
admin.site.register(PendingTransaction)
admin.site.register(UserProfile)
admin.site.register(SafeSpendLimit)
admin.site.register(MerchantWhitelist)