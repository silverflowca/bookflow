import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Users, CheckCircle, XCircle, Loader2, LogIn, UserPlus, BookOpen } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';

type PageState = 'loading' | 'preview' | 'accepting' | 'success' | 'already_accepted' | 'error';

interface InvitePreview {
  club_id: string;
  club_name: string;
  book_title: string | null;
  invited_email: string;
  has_account: boolean;
}

export default function AcceptClubInvitePage() {
  const { token } = useParams<{ token: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [state, setState] = useState<PageState>('loading');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Step 1: always load the invite preview first (no auth needed)
  useEffect(() => {
    if (!token) return;
    api.getClubInvitePreview(token)
      .then(data => {
        setPreview(data);
        setState('preview');
      })
      .catch(err => {
        setErrorMsg(err.message || 'This invite link is invalid or has expired.');
        setState('error');
      });
  }, [token]);

  // Step 2: when we have a preview AND a logged-in user, auto-accept
  useEffect(() => {
    if (state === 'preview' && user && token) {
      acceptInvite();
    }
  }, [state, user]);

  async function acceptInvite() {
    if (!token) return;
    setState('accepting');
    try {
      const result = await api.acceptClubInvite(token);
      if (result.already_member) {
        setState('already_accepted');
        setTimeout(() => navigate(`/clubs/${preview?.club_id || result.club?.id || ''}`), 2000);
      } else {
        setState('success');
        setTimeout(() => navigate(`/clubs/${preview?.club_id || result.club?.id || ''}`), 3000);
      }
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('already')) {
        setState('already_accepted');
        setTimeout(() => navigate(`/clubs/${preview?.club_id || ''}`), 2000);
      } else {
        setErrorMsg(msg);
        setState('error');
      }
    }
  }

  const redirectParam = encodeURIComponent(`/clubs/accept/${token}`);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[var(--color-bg)]">
      <div className="max-w-md w-full">

        {/* Loading preview */}
        {(state === 'loading' || state === 'accepting') && (
          <div className="theme-section rounded-2xl p-10 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-accent mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-theme">
              {state === 'loading' ? 'Loading invite…' : 'Accepting invite…'}
            </h2>
          </div>
        )}

        {/* Preview — user not logged in */}
        {state === 'preview' && !user && preview && (
          <div className="theme-section rounded-2xl overflow-hidden shadow-lg">
            {/* Header */}
            <div className="bg-accent/10 px-8 py-6 text-center border-b border-[var(--color-border)]">
              <div className="w-14 h-14 rounded-2xl bg-accent/20 flex items-center justify-center mx-auto mb-3">
                <Users className="h-7 w-7 text-accent" />
              </div>
              <p className="text-xs font-medium uppercase tracking-widest text-accent mb-1">Book Club Invitation</p>
              <h1 className="text-2xl font-bold text-theme">{preview.club_name}</h1>
              {preview.book_title && (
                <div className="flex items-center justify-center gap-1.5 mt-2 text-sm text-muted">
                  <BookOpen className="h-4 w-4" />
                  <span>Currently reading: <strong className="text-theme">{preview.book_title}</strong></span>
                </div>
              )}
            </div>

            <div className="px-8 py-6">
              <p className="text-sm text-muted text-center mb-6">
                You've been invited to join <strong className="text-theme">{preview.club_name}</strong>.
                {preview.has_account
                  ? ' Sign in to accept.'
                  : ' Create a free account to get started.'}
              </p>

              <div className="flex flex-col gap-3">
                {preview.has_account ? (
                  <>
                    <Link
                      to={`/login?redirect=/clubs/accept/${token}`}
                      className="flex items-center justify-center gap-2 theme-button-primary px-6 py-3 rounded-xl font-medium text-sm"
                    >
                      <LogIn className="h-4 w-4" />
                      Sign in to accept
                    </Link>
                    <Link
                      to={`/register?redirect=/clubs/accept/${token}`}
                      className="text-center text-sm text-accent hover:underline"
                    >
                      Don't have an account? Sign up instead
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to={`/register?redirect=/clubs/accept/${token}`}
                      className="flex items-center justify-center gap-2 theme-button-primary px-6 py-3 rounded-xl font-medium text-sm"
                    >
                      <UserPlus className="h-4 w-4" />
                      Create account &amp; join
                    </Link>
                    <Link
                      to={`/login?redirect=/clubs/accept/${token}`}
                      className="text-center text-sm text-accent hover:underline"
                    >
                      Already have an account? Sign in
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Success */}
        {state === 'success' && preview && (
          <div className="theme-section rounded-2xl overflow-hidden shadow-lg text-center">
            <div className="bg-green-500/10 px-8 py-6 border-b border-[var(--color-border)]">
              <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-3" />
              <h1 className="text-2xl font-bold text-theme">Welcome to BookFlow!</h1>
            </div>
            <div className="px-8 py-6">
              <p className="text-theme mb-1">
                You've just accepted the invitation to the
              </p>
              <p className="text-xl font-bold text-accent mb-1">{preview.club_name}</p>
              <p className="text-theme mb-4">Book Club</p>
              {preview.book_title && (
                <div className="flex items-center justify-center gap-1.5 text-sm text-muted mb-6">
                  <BookOpen className="h-4 w-4" />
                  <span>Currently reading <strong className="text-theme">{preview.book_title}</strong></span>
                </div>
              )}
              <p className="text-sm text-muted">Taking you to the club…</p>
            </div>
          </div>
        )}

        {/* Already a member */}
        {state === 'already_accepted' && preview && (
          <div className="theme-section rounded-2xl p-10 text-center">
            <CheckCircle className="h-12 w-12 text-muted mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-theme mb-2">Already a member</h2>
            <p className="text-muted mb-6">You're already in <strong className="text-theme">{preview.club_name}</strong>.</p>
            <p className="text-sm text-muted">Redirecting…</p>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="theme-section rounded-2xl p-10 text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-theme mb-2">Invalid invite</h2>
            <p className="text-muted mb-6">{errorMsg || 'This invite link is invalid or has expired.'}</p>
            <Link to="/clubs" className="theme-button-primary px-6 py-2 rounded-lg font-medium">
              Go to Clubs
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
