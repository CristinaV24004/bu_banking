from django.apps import AppConfig

class BankingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'banking'
    verbose_name = 'Guardian Vault Banking System'
    
    def ready(self):
        import banking.signals
        import logging
        logger = logging.getLogger(__name__)
        logger.info("Guardian Vault signals activated")