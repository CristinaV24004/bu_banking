import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { axiosInstance } from '../api/axiosInstance';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Alert from '../components/ui/Alert';
import logoFull from '../assets/gv-logo-simple.png';

const RegisterPage = () => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { register } = useAuth();

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validate = () => {
    if (!username.trim()) { setError('Username is required'); return false; }
    if (!email.trim()) { setError('Email is required'); return false; }
    if (!validateEmail(email)) { setError('Please enter a valid email address'); return false; }
    if (!password) { setError('Password is required'); return false; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return false; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return false; }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await register(username, password, email);
      if (!result.success) {
        setError(result.error || 'Registration failed');
        setLoading(false);
        return;
      }
      try {
        const userRes = await axiosInstance.get('/auth/user/');
        const isGuardian = userRes.data.user?.is_guardian === true;
        if (isGuardian) {
          navigate('/guardian');
        } else {
          navigate('/dashboard');
        }
      } catch {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  const inputClasses = "w-full rounded-md border border-gray-300 px-3 py-2 focus:border-[#C9992A] focus:outline-none focus:ring-2 focus:ring-[#C9992A] focus:ring-offset-2";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F4F7FB] px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <img src={logoFull} alt="Guardian Vault logo" className="h-24 w-auto mb-4" />
          <div className="flex flex-col items-center leading-tight" aria-hidden="true">
            <span className="font-cinzel font-semibold text-[#0D2B55] text-xl">Guardian</span>
            <span className="font-cinzel font-bold text-[#C9992A] text-xl tracking-widest">VAULT</span>
          </div>
        </div>
        <Card title="Create Account" className="w-full">
          <form onSubmit={handleSubmit} noValidate aria-label="Create account form">
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
                className={inputClasses}
                disabled={loading}
                autoComplete="username"
                aria-required="true"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClasses}
                disabled={loading}
                autoComplete="email"
                aria-required="true"
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
                className={inputClasses}
                disabled={loading}
                autoComplete="new-password"
                aria-required="true"
                aria-describedby="password-hint"
              />
              <p id="password-hint" className="mt-1 text-xs text-gray-500">
                Minimum 8 characters
              </p>
            </div>
            <div className="mb-4">
              <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium text-gray-700">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClasses}
                disabled={loading}
                autoComplete="new-password"
                aria-required="true"
              />
            </div>
            <Button type="submit" variant="primary" loading={loading} disabled={loading} className="w-full">
              Register
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-[#0D2B55] font-semibold hover:text-[#C9992A] hover:underline focus:outline-none focus:ring-2 focus:ring-[#C9992A] focus:ring-offset-2 rounded"
            >
              Sign In
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RegisterPage;