"""
Unified Banking & Guardian API Routing.
Securely exposes Account, Transaction, and Guardian Management endpoints.
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from drf_yasg.views import get_schema_view
from drf_yasg import openapi 
from rest_framework.permissions import AllowAny 

# Local View Imports
from .views import (
    AccountViewSet, 
    TransactionViewSet, 
    BusinessViewSet, 
    GuardianViewSet, 
    UserRegistrationView
)
from .tests.test_view import TestView

# --- Router Setup ---
router = DefaultRouter()
router.register(r'accounts', AccountViewSet, basename='account')
router.register(r'transactions', TransactionViewSet, basename='transaction')
router.register(r'businesses', BusinessViewSet, basename='business')
router.register(r'guardian', GuardianViewSet, basename='guardian')

# --- Swagger/OpenAPI Setup ---
schema_view = get_schema_view(
   openapi.Info(
      title="Extra Credit Union API",
      default_version='v1',
      description="Secure Banking & Guardian Governance Documentation",
   ),
   public=True,
   permission_classes=(AllowAny,),
)

# --- URL Patterns ---
urlpatterns = [
    # API Resource Endpoints
    path('', include(router.urls)),
    
    # Authentication & Registration
    path('register/', UserRegistrationView.as_view(), name='user-registration'),
    path('simple-register/', UserRegistrationView.as_view(), name='simple-registration'), 
    
    # Diagnostic & Documentation
    path('test-view/', TestView.as_view(), name='banking-test-view'),
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
]