import PropTypes from 'prop-types';
import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import axios from 'axios';
import { jwtDecode } from 'jwt-decode';
import { axiosInstance, setAuthToken, removeAuthToken } from '../api/axiosInstance';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Helper to decode token and set user state
  const decodeAndSetUser = (token) => {
    try {
      const decoded = jwtDecode(token);
      setUser({
        userId: decoded.user_id,
        username: decoded.username || null,
      });
    } catch (error) {
      console.error('Failed to decode token:', error);
      setUser(null);
    }
  };

  // Login: call /api/token/ and store access token in memory
  const login = async (username, password) => {
    try {
      const response = await axios.post('/api/token/', { username, password });
      const { access } = response.data;
      // refresh token is automatically stored in HttpOnly cookie by backend
      setAccessToken(access);
      setAuthToken(access);
      decodeAndSetUser(access);
      const userRes = await axiosInstance.get('/auth/user/');
      setUser(prev => ({ ...prev, username: userRes.data.user.username }));
      return { success: true };
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error.response?.data?.detail || 'Login failed',
      };
    }
  };

  // Logout: clear local state, tell backend to clear cookie (optional)
  const logout = async () => {
    // Optionally call a logout endpoint that clears the HttpOnly cookie
    try {
      await axios.post('/api/logout/', {}, { withCredentials: true });
    } catch (error) {
      console.warn('Logout endpoint error:', error);
    }
    setAccessToken(null);
    removeAuthToken();
    setUser(null);
  };

  // Register: call /api/register/ then automatically log in
  const register = async (username, password, email) => {
    try {
      const response = await axios.post('/api/register/', {
        username,
        password,
        email,
      });
      if (response.status === 201) {
        // Auto-login after successful registration
        return await login(username, password);
      }
      return { success: false, error: 'Registration failed' };
    } catch (error) {
      console.error('Registration failed:', error);
      return {
        success: false,
        error: error.response?.data?.error || 'Registration failed',
      };
    }
  };

  // Attempt silent token refresh on app load
  // NOTE: This will silently fail in dev unless the backend is configured
  // to set the refresh token as an HttpOnly cookie (SimpleJWT AUTH_COOKIE setting).
  // Current behaviour: user must log in manually after page refresh. Acceptable for demo.
  const refreshAccessToken = async () => {
    try {
      const response = await axios.post(
        '/api/token/refresh/',
        {},
        { withCredentials: true } // refresh token is in HttpOnly cookie
      );
      const { access } = response.data;
      setAccessToken(access);
      setAuthToken(access);
      decodeAndSetUser(access);
      return true;
    } 
    
    catch (error) {
      console.warn('Silent token refresh failed:', error);
      setAccessToken(null);
      removeAuthToken();
      setUser(null);
      return false;
    }
  };

  // 1. On app load, try to refresh the token (restore session)
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      await refreshAccessToken();
      setLoading(false);
    };
    initAuth();
  }, []);

  // 2. auth:logout listener - clears state directly
  useEffect(() => {
    const handler = () => {
      setAccessToken(null);
      removeAuthToken();
      setUser(null);
    };
    window.addEventListener('auth:logout', handler);
    return () => window.removeEventListener('auth:logout', handler);
  }, []);

  const value = useMemo(() => ({
    user,
    accessToken,
    login,
    logout,
    register,
    refreshAccessToken,
    isAuthenticated: !!accessToken,
    loading,
  }), [user, accessToken, loading]);

  return (
    <AuthContext.Provider value={value}>
      {loading ? null : children}
    </AuthContext.Provider>
  );
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired,
};