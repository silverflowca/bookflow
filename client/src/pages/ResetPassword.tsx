import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, AlertCircle, CheckCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import api from '../lib/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Supabase appends the recovery token as a hash fragment: #access_token=...&type=recovery
  const [accessToken, setAccessToken] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [tokenType, setTokenType] = useState('');

  useEffect(() => {
    // Parse hash fragment (Supabase auth callback format)
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const at = params.get('access_token') || searchParams.get('access_token') || '';
    const rt = params.get('refresh_token') || searchParams.get('refresh_token') || '';
    const type = params.get('type') || searchParams.get('type') || '';
    setAccessToken(at);
    setRefreshToken(rt);
    setTokenType(type);
  }, [searchParams]);

  const tokenMissing = !accessToken;
  const isRecovery = tokenType === 'recovery' || !!accessToken;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.resetPassword(accessToken, refreshToken, password);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. The link may have expired.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <BookOpen className="h-12 w-12 text-accent mx-auto" />
          <h2 className="mt-6 text-3xl font-bold text-theme">Set new password</h2>
          <p className="mt-2 text-sm text-muted">
            Choose a strong password to secure your account.
          </p>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-4 p-6 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-400">
            <CheckCircle className="h-10 w-10" />
            <div className="text-center">
              <p className="font-semibold">Password updated!</p>
              <p className="text-sm mt-1 opacity-80">Redirecting you to login…</p>
            </div>
          </div>
        ) : tokenMissing ? (
          <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-400">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Invalid or expired link</p>
                <p className="text-sm mt-1">This password reset link is invalid or has expired. Please request a new one.</p>
                <button
                  onClick={() => navigate('/login')}
                  className="mt-3 text-sm font-medium underline hover:no-underline"
                >
                  Back to login
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 dark:bg-red-900/20 dark:border-red-700 dark:text-red-400">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium text-theme">
                  New password
                </label>
                <div className="relative mt-1">
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="block w-full px-3 py-2 pr-10 theme-input rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="At least 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="block text-sm font-medium text-theme">
                  Confirm new password
                </label>
                <div className="relative mt-1">
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="block w-full px-3 py-2 pr-10 theme-input rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Repeat your new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
              {loading ? 'Updating…' : 'Set new password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
