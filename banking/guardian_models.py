from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from django.utils import timezone
from decimal import Decimal

class UserProfile(models.Model):
    # Governance profile. Links the Guardian to the Account Holder.
    user = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='profile'
    )
    
    # Simple boolean flags to define the user's primary role
    is_guardian = models.BooleanField(default=False)
    is_account_holder = models.BooleanField(default=True) 
    
    # The 'Governance Link': A Guardian can manage multiple Account Holders
    managed_accounts = models.ManyToManyField(
        User, 
        related_name='guardians', # 'user.guardians' will return their assigned guardians
        blank=True,
        limit_choices_to={'profile__is_account_holder': True}
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"

    def clean(self):
        # Prevent self-assignment for security
        if self.is_guardian and self.is_account_holder:
            raise ValidationError("A user cannot be both a Guardian and an Account Holder on the same profile.")

    def __str__(self):
        role = "Guardian" if self.is_guardian else "Account Holder"
        return f"{self.user.username} ({role})"


class SafeSpendLimit(models.Model):
    # The Daily Autonomy Engine.
    
    account_holder = models.OneToOneField(
        User, 
        on_delete=models.CASCADE, 
        related_name='safe_spend'
    )
    
    daily_limit = models.DecimalField(max_digits=10, decimal_places=2, default=100.00)
    daily_spent = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    last_reset_date = models.DateField(default=timezone.now)
    
    # Quiet Hours (Sundowning Protection)
    allow_late_night = models.BooleanField(default=False)
    quiet_hours_start = models.IntegerField(default=22, validators=[MinValueValidator(0), MaxValueValidator(23)])
    quiet_hours_end = models.IntegerField(default=6, validators=[MinValueValidator(0), MaxValueValidator(23)])

    def reset_if_new_day(self):
        if self.last_reset_date < timezone.now().date():
            self.daily_spent = Decimal('0.00')
            self.last_reset_date = timezone.now().date()
            self.save()

    def __str__(self):
        return f"Limit for {self.account_holder.username}: £{self.daily_limit}/day"


class MerchantWhitelist(models.Model):
    #Trusted Merchant logic.
    
    RULE_TYPES = [
        ('allow', 'Always Allow'),
        ('block', 'Always Block'),
        ('require_approval', 'Require Guardian Review'),
    ]
    
    account_holder = models.ForeignKey(User, on_delete=models.CASCADE, related_name='whitelist_rules')
    merchant_name = models.CharField(max_length=255)
    category = models.CharField(max_length=100)
    rule_type = models.CharField(max_length=20, choices=RULE_TYPES, default='require_approval')

    class Meta:
        unique_together = ['account_holder', 'merchant_name']