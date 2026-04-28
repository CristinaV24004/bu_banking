// src/pages/LoginPage.jsx
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { axiosInstance } from '../api/axiosInstance';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Alert from '../components/ui/Alert';

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const validate = () => {
    if (!username.trim()) {
      setError('Username is required');
      return false;
    }
    if (!password) {
      setError('Password is required');
      return false;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const result = await login(username, password);
      if (!result.success) {
        setError(result.error || 'Login failed');
        setLoading(false);
        return;
      }

      // After successful login, fetch user role to determine redirect
      try {
        const userRes = await axiosInstance.get('/auth/user/');
        const isGuardian = userRes.data.is_guardian === true;
        if (isGuardian) {
          setLoading(false);
          navigate('/guardian');
        } else {
          setLoading(false);
          navigate('/dashboard');
        }
      } catch (roleErr) {
        console.warn('Role fetch failed, defaulting to dashboard:', roleErr);
        setLoading(false);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'An unexpected error occurred');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card title="Sign In" className="w-full max-w-md">
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4">
              <Alert type="error" message={error} onDismiss={() => setError('')} />
            </div>
          )}
          <div className="mb-4">
            <label htmlFor="username" className="mb-1 block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              disabled={loading}
            />
          </div>
          <div className="mb-4">
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              disabled={loading}
            />
          </div>
          <Button type="submit" variant="primary" loading={loading} disabled={loading} className="w-full">
            Sign In
          </Button>
        </form>
        <div className="mt-4 text-center text-sm text-gray-600">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-600 hover:underline">
            Register
          </Link>
        </div>
      </Card>
    </div>
  );
};

export default LoginPage;