import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Users, CheckCircle, XCircle, Loader2, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

type InviteState = 'loading' | 'requires_auth' | 'success' | 'error' | 'already_accepted';

export default function AcceptClubInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<InviteState>('loading');
  const [clubName, setClubName] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (token) handleAccept();
  }, [token, user]);

  async function handleAccept() {
    setState('loading');
    if (!user) {
      setState('requires_auth');
      return;
    }
    try {
      const result = await api.acceptClubInvite(token!);
      setClubName(result.club?.name || '');
      if (result.already_member) {
        setState('already_accepted');
      } else {
        setState('success');
        setTimeout(() => navigate(`/clubs/${result.club?.id || ''}`), 2000);
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('already')) {
        setState('already_accepted');
      } else {
        setState('error');
        setMessage(msg);
      }
    }
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {state === 'loading' && (
          <div className="theme-section rounded-2xl p-10">
            <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-theme">Accepting invite…</h2>
          </div>
        )}

        {state === 'requires_auth' && (
          <div className="theme-section rounded-2xl p-10">
            <Users className="h-12 w-12 text-accent mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-theme mb-2">Sign in to join</h2>
            <p className="text-muted mb-6">Please sign in or create an account to accept this book club invite.</p>
            <div className="flex flex-col gap-3">
              <Link
                to={`/login?redirect=/clubs/accept/${token}`}
                className="flex items-center justify-center gap-2 theme-button-primary px-6 py-3 rounded-lg font-medium"
              >
                <LogIn className="h-4 w-4" /> Sign In
              </Link>
              <Link to={`/register?redirect=/clubs/accept/${token}`} className="text-sm text-accent hover:underline">
                Don't have an account? Sign up
              </Link>
            </div>
          </div>
        )}

        {state === 'success' && (
          <div className="theme-section rounded-2xl p-10">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-theme mb-2">Welcome to the club!</h2>
            {clubName && <p className="text-muted mb-1">You've joined <strong className="text-theme">"{clubName}"</strong>.</p>}
            <p className="text-sm text-muted mt-4">Redirecting…</p>
          </div>
        )}

        {state === 'already_accepted' && (
          <div className="theme-section rounded-2xl p-10">
            <CheckCircle className="h-12 w-12 text-muted mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-theme mb-2">Already a member</h2>
            <p className="text-muted mb-6">This invite has already been accepted.</p>
            <Link to="/clubs" className="theme-button-primary px-6 py-2 rounded-lg font-medium">Go to Clubs</Link>
          </div>
        )}

        {state === 'error' && (
          <div className="theme-section rounded-2xl p-10">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-theme mb-2">Invalid invite</h2>
            <p className="text-muted mb-6">{message || 'This invite link is invalid or has expired.'}</p>
            <Link to="/clubs" className="theme-button-primary px-6 py-2 rounded-lg font-medium">Go to Clubs</Link>
          </div>
        )}
      </div>
    </div>
  );
}
