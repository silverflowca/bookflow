import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { BookOpen, AlertCircle, Eye, EyeOff, CheckCircle, Loader2, ArrowLeft } from 'lucide-react';
import api from '../lib/api';

type View = 'login' | 'forgot' | 'forgot-sent';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>('login');
  const [forgotEmail, setForgotEmail] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const redirect = searchParams.get('redirect');
      navigate(redirect || '/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.forgotPassword(forgotEmail.trim());
      setView('forgot-sent');
    } catch (err: any) {
      // Server always returns success; only show generic error on network failure
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function switchToForgot() {
    setForgotEmail(email); // pre-fill with whatever they typed
    setError('');
    setView('forgot');
  }

  // ── Forgot sent confirmation ─────────────────────────────────────────────────
  if (view === 'forgot-sent') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-6 text-center">
          <BookOpen className="h-12 w-12 text-accent mx-auto" />
          <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-xl dark:bg-emerald-900/20 dark:border-emerald-700">
            <CheckCircle className="h-10 w-10 text-emerald-600 dark:text-emerald-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-theme">Check your email</h2>
            <p className="text-sm text-muted mt-2">
              If an account exists for <span className="font-medium text-theme">{forgotEmail}</span>, we've sent a password reset link. Check your inbox (and spam folder).
            </p>
          </div>
          <button
            onClick={() => { setView('login'); setError(''); }}
            className="flex items-center gap-2 text-sm text-accent hover:underline mx-auto"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to login
          </button>
        </div>
      </div>
    );
  }

  // ── Forgot password form ─────────────────────────────────────────────────────
  if (view === 'forgot') {
    return (
      <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <BookOpen className="h-12 w-12 text-accent mx-auto" />
            <h2 className="mt-6 text-3xl font-bold text-theme">Forgot your password?</h2>
            <p className="mt-2 text-sm text-muted">
              Enter the email address for your account and we'll send you a link to reset your password.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleForgot}>
            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="forgot-email" className="block text-sm font-medium text-theme">
                Email address
              </label>
              <input
                id="forgot-email"
                type="email"
                autoComplete="email"
                required
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 theme-input rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                placeholder="you@example.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium theme-button-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? 'Sending…' : 'Send reset link'}
            </button>

            <button
              type="button"
              onClick={() => { setView('login'); setError(''); }}
              className="w-full flex items-center justify-center gap-2 text-sm text-muted hover:text-theme"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Login form ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-accent mx-auto" />
          <h2 className="mt-6 text-3xl font-bold text-theme">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-muted">
            Don't have an account?{' '}
            <Link
              to={searchParams.get('redirect') ? `/register?redirect=${encodeURIComponent(searchParams.get('redirect')!)}` : '/register'}
              className="text-accent hover:text-accent font-medium"
            >
              Sign up
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-theme">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 theme-input rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              />
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm font-medium text-theme">
                  Password
                </label>
                <button
                  type="button"
                  onClick={switchToForgot}
                  className="text-xs text-accent hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative mt-1">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full px-3 py-2 pr-10 theme-input rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium theme-button-primary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
