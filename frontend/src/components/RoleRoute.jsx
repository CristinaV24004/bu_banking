// src/components/RoleRoute.jsx
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { axiosInstance } from '../api/axiosInstance';

export const RoleRoute = ({ children, requiredRole }) => {
  const { isAuthenticated, accessToken, loading: authLoading } = useAuth();
  const [userRole, setUserRole] = useState(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      setRoleLoading(false);
      return;
    }

    const fetchUserRole = async () => {
      try {
        const response = await axiosInstance.get('/auth/user/');
        // Assuming response.data has an 'is_guardian' boolean field
        // e.g., { id, username, email, is_guardian, is_account_holder, ... }
        const isGuardian = response.data.is_guardian;
        const role = isGuardian ? 'guardian' : 'account_holder';
        setUserRole(role);
      } catch (err) {
        console.error('Failed to fetch user role:', err);
        setError(true);
      } finally {
        setRoleLoading(false);
      }
    };

    fetchUserRole();
  }, [isAuthenticated, accessToken]);

  if (authLoading || roleLoading) {
    return <div>Loading access control...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (error) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (userRole !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};