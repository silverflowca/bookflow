import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle, XCircle, Loader2, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

type InviteState = 'loading' | 'requires_auth' | 'success' | 'error' | 'already_accepted';

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<InviteState>('loading');
  const [message, setMessage] = useState('');
  const [bookTitle, setBookTitle] = useState('');
  const [role, setRole] = useState('');

  useEffect(() => {
    if (token) acceptInvite();
  }, [token, user]);

  async function acceptInvite() {
    setState('loading');
    try {
      const result = await api.acceptInvite(token!);

      if (result.requiresAuth) {
        setBookTitle(result.book?.title || '');
        setRole(result.role || '');
        setState('requires_auth');
        return;
      }

      setBookTitle(result.book?.title || '');
      setRole(result.role || '');
      setState('success');

      // Redirect to the book after 2 seconds
      setTimeout(() => {
        if (result.book?.id) {
          navigate(`/edit/book/${result.book.id}`);
        }
      }, 2000);
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      if (errMsg.includes('already')) {
        setState('already_accepted');
      } else {
        setState('error');
        setMessage(errMsg);
      }
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {state === 'loading' && (
          <div className="theme-section rounded-2xl p-10">
            <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-theme">Accepting invite...</h2>
          </div>
        )}

        {state === 'requires_auth' && (
          <div className="theme-section rounded-2xl p-10">
            <BookOpen className="h-12 w-12 text-accent mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-theme mb-2">Sign in to accept</h2>
            <p className="text-muted mb-2">
              You've been invited to collaborate on{' '}
              {bookTitle && <strong className="text-theme">"{bookTitle}"</strong>}
              {role && ` as ${role}`}.
            </p>
            <p className="text-muted mb-6">Please sign in or create an account to accept this invite.</p>
            <div className="flex flex-col gap-3">
              <Link
                to={`/login?redirect=/invite/${token}`}
                className="flex items-center justify-center gap-2 theme-button-primary px-6 py-3 rounded-lg font-medium"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </Link>
              <Link
                to={`/register?redirect=/invite/${token}`}
                className="text-sm text-accent hover:underline"
              >
                Don't have an account? Sign up
              </Link>
            </div>
          </div>
        )}

        {state === 'success' && (
          <div className="theme-section rounded-2xl p-10">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-theme mb-2">Invite accepted!</h2>
            <p className="text-muted mb-1">
              You're now a <strong className="text-theme">{role}</strong> on{' '}
              {bookTitle && <strong className="text-theme">"{bookTitle}"</strong>}.
            </p>
            <p className="text-sm text-muted mt-4">Redirecting to the book...</p>
          </div>
        )}

        {state === 'already_accepted' && (
          <div className="theme-section rounded-2xl p-10">
            <CheckCircle className="h-12 w-12 text-muted mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-theme mb-2">Already accepted</h2>
            <p className="text-muted mb-6">This invite has already been accepted.</p>
            <Link
              to="/dashboard"
              className="theme-button-primary px-6 py-2 rounded-lg font-medium"
            >
              Go to Dashboard
            </Link>
          </div>
        )}

        {state === 'error' && (
          <div className="theme-section rounded-2xl p-10">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-theme mb-2">Invalid invite</h2>
            <p className="text-muted mb-6">
              {message || 'This invite link is invalid or has expired.'}
            </p>
            <Link
              to="/dashboard"
              className="theme-button-primary px-6 py-2 rounded-lg font-medium"
            >
              Go to Dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
