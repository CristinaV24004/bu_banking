from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import Account
from .serializers import AccountSerializer
from .guardian_models import UserProfile


class LoginView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request, *args, **kwargs):
        username = request.data.get('username')
        password = request.data.get('password')
        
        if not username or not password:
            return Response({
                'error': 'Please provide both username and password'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        user = authenticate(username=username, password=password)
        
        if user is None:
            return Response({
                'error': 'Invalid credentials'
            }, status=status.HTTP_401_UNAUTHORIZED)
        
        refresh = RefreshToken.for_user(user)
        
        # Get user's accounts
        accounts = Account.objects.filter(user=user)
        account_data = AccountSerializer(accounts, many=True).data
        
        return Response({
            'user': {
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_staff': user.is_staff,
                'is_guardian': UserProfile.objects.filter(user=user).values_list('is_guardian', flat=True).first() or False,
            },
            'accounts': account_data,
            'access': str(refresh.access_token),
            'refresh': str(refresh)
        })

class UserAccountsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request, *args, **kwargs):
        user = request.user
        accounts = Account.objects.filter(user=user)
        profile = UserProfile.objects.filter(user=user).first()
        
        managed_accounts = []
        if profile and profile.is_guardian:
            managed_accounts = list(
                profile.managed_accounts.values('id', 'username')
            )
        
        return Response({
            'user': {
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'is_staff': user.is_staff,
                'is_guardian': profile.is_guardian if profile else False,
            },
            'accounts': AccountSerializer(accounts, many=True).data,
            'managed_accounts': managed_accounts,
        })