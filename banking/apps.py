from django.apps import AppConfig

class BankingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'banking'
    verbose_name = 'Guardian Vault Banking System'
    
    def ready(self):
        # This is the "magic" line that activates BAJPM-25
        import banking.signals
        print("[BankingConfig] ✓ Guardian Vault signals activated")