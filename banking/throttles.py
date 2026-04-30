from rest_framework.throttling import UserRateThrottle

class TransactionRateThrottle(UserRateThrottle):
    scope = 'transactions'