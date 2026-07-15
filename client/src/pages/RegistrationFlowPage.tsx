import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Users, CheckCircle, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import type { RegistrationField, ClubRegistrationSettings } from '../types';
import SignatureCanvas from '../components/editor/SignatureCanvas';

// ─── Lightweight field renderer ───────────────────────────────────────────────

interface FieldRendererProps {
  field: RegistrationField;
  value: any;
  onChange: (id: string, value: any) => void;
}

function FieldRenderer({ field, value, onChange }: FieldRendererProps) {
  const base = 'w-full rounded-xl px-4 py-3 text-sm bg-white border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm';

  switch (field.type) {
    case 'textbox':
      return (
        <input
          type="text"
          className={base}
          placeholder={field.placeholder || field.label}
          value={value || ''}
          onChange={e => onChange(field.id, e.target.value)}
        />
      );

    case 'textarea':
      return (
        <textarea
          className={`${base} resize-none`}
          rows={4}
          placeholder={field.placeholder || field.label}
          value={value || ''}
          onChange={e => onChange(field.id, e.target.value)}
        />
      );

    case 'select':
      return (
        <select
          className={`${base} cursor-pointer`}
          value={value || ''}
          onChange={e => onChange(field.id, e.target.value)}
        >
          <option value="">Select an option…</option>
          {(field.options || []).map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case 'radio':
      return (
        <div className="space-y-2">
          {(field.options || []).map(opt => (
            <label key={opt} className="flex items-center gap-3 cursor-pointer group">
              <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${value === opt ? 'border-blue-600 bg-blue-600' : 'border-slate-300 group-hover:border-blue-400'}`}>
                {value === opt && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
              <input type="radio" className="sr-only" checked={value === opt} onChange={() => onChange(field.id, opt)} />
              <span className="text-sm text-slate-700">{opt}</span>
            </label>
          ))}
        </div>
      );

    case 'checkbox':
      return (
        <div className="space-y-2">
          {(field.options || []).map(opt => {
            const selected: string[] = value || [];
            const checked = selected.includes(opt);
            return (
              <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${checked ? 'border-blue-600 bg-blue-600' : 'border-slate-300 group-hover:border-blue-400'}`}>
                  {checked && <CheckCircle className="h-3 w-3 text-white" />}
                </div>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => {
                    const next = checked ? selected.filter(s => s !== opt) : [...selected, opt];
                    onChange(field.id, next);
                  }}
                />
                <span className="text-sm text-slate-700">{opt}</span>
              </label>
            );
          })}
        </div>
      );

    case 'signature':
      return (
        <div className="rounded-xl overflow-hidden border border-white/20 bg-white">
          <SignatureCanvas
            defaultValue={value || undefined}
            onSave={val => onChange(field.id, val)}
            height={160}
          />
        </div>
      );

    default:
      return null;
  }
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Step = 'join' | 'form' | 'welcome';

interface ClubData {
  id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  club_type?: string;
  member_count: number;
  settings?: ClubRegistrationSettings;
}

export default function RegistrationFlowPage() {
  const { clubId } = useParams<{ clubId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || undefined;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [club, setClub] = useState<ClubData | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('join');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [showCheck, setShowCheck] = useState(false);
  const [slideDir, setSlideDir] = useState<'in' | 'out'>('in');

  useEffect(() => {
    if (!clubId) return;
    api.getClubRegistration(clubId)
      .then(data => setClub(data))
      .catch(() => setError('This registration link is invalid or expired.'))
      .finally(() => setLoading(false));
  }, [clubId]);

  const settings = club?.settings;
  const fields: RegistrationField[] = settings?.registration_fields || [];
  // Only show the form step if registration is explicitly enabled AND there are fields
  const hasForm = !!(settings?.registration_enabled && fields.length > 0);
  const bgUrl = settings?.registration_bg_url;
  const isPrivateNoToken = club && (club as any).visibility === 'private' && !token;

  function updateField(id: string, val: any) {
    setFormValues(prev => ({ ...prev, [id]: val }));
  }

  function goToStep(next: Step) {
    setSlideDir('out');
    setTimeout(() => {
      setStep(next);
      setSlideDir('in');
    }, 220);
  }

  async function handleJoin() {
    if (!user) {
      const redirect = encodeURIComponent(`/clubs/${clubId}/register${token ? `?token=${token}` : ''}`);
      navigate(`/login?redirect=${redirect}`);
      return;
    }
    if (hasForm) {
      goToStep('form');
    } else {
      await submitAndFinish({});
    }
  }

  async function handleSubmitForm() {
    // Validate required fields
    for (const f of fields) {
      if (f.required) {
        const val = formValues[f.id];
        const empty = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
        if (empty) {
          setError(`"${f.label}" is required.`);
          return;
        }
      }
    }
    setError('');
    await submitAndFinish(formValues);
  }

  async function submitAndFinish(responses: Record<string, any>) {
    if (!clubId) return;
    setSubmitting(true);
    try {
      await api.submitClubRegistration(clubId, { token, responses });
      // Show checkmark animation then transition to welcome
      setShowCheck(true);
      setTimeout(() => {
        setShowCheck(false);
        goToStep('welcome');
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleGoToClub() {
    navigate(`/clubs/${clubId}`);
  }

  // ── render ──

  const stepIndex = step === 'join' ? 0 : step === 'form' ? 1 : 2;
  const visibleStepCount = hasForm ? 3 : 2;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="h-10 w-10 animate-spin text-white/50" />
      </div>
    );
  }

  if (!club || error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="max-w-sm w-full text-center">
          <div className="text-5xl mb-4">{error ? '🔗' : '🔒'}</div>
          <h1 className="text-xl font-semibold text-white mb-2">{error ? 'Link not found' : 'Private'}</h1>
          <p className="text-white/60 mb-6">{error || 'This class is invite-only. Ask the teacher for an invite link.'}</p>
          <button onClick={() => navigate('/clubs')} className="bg-white text-gray-900 px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-white/90 transition-colors">
            Browse Clubs
          </button>
        </div>
      </div>
    );
  }

  // Private club without an invite token — show locked state
  if (isPrivateNoToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
        <div className="max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🔒</div>
          <h1 className="text-xl font-semibold text-white mb-2">{club.name}</h1>
          <p className="text-white/60 mb-6">This is a private class. You need an invite link from the teacher to join.</p>
          <button onClick={() => navigate('/clubs')} className="bg-white text-gray-900 px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-white/90 transition-colors">
            Browse Clubs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[calc(100vh-4rem)] flex flex-col md:flex-row overflow-hidden">
      <style>{`
        @keyframes regSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes regSlideOut {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(-12px); }
        }
        @keyframes regCheckPop {
          0%   { transform: scale(0.5); opacity: 0; }
          60%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

      {/* ── Mobile: image strip at top ── */}
      <div className="md:hidden relative w-full h-64 shrink-0 bg-gray-900 overflow-hidden rounded-b-3xl">
        {bgUrl ? (
          <img src={bgUrl} alt="" className="w-full h-full object-cover rounded-b-3xl" aria-hidden />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-gray-900 rounded-b-3xl" aria-hidden />
        )}
      </div>

      {/* ── Left: background image (desktop only) ── */}
      <div className="relative hidden md:flex md:flex-1 flex-col items-center justify-center overflow-hidden self-stretch">
        {bgUrl ? (
          <img src={bgUrl} alt="" className="absolute inset-0 w-full h-full object-cover" aria-hidden />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-gray-900" aria-hidden />
        )}
        {/* Subtle gradient on right edge so it blends into the form panel */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent to-black/40" aria-hidden />
      </div>

      {/* ── Right: form panel ── */}
      <div className="relative flex flex-col items-start justify-start w-full md:w-[420px] lg:w-[460px] shrink-0 bg-slate-50 px-8 pt-10 pb-12">

        {/* Step dots */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {Array.from({ length: visibleStepCount }).map((_, i) => (
            <div
              key={i}
              className={`rounded-full transition-all duration-300 ${i === stepIndex ? 'w-5 h-2 bg-slate-800' : 'w-2 h-2 bg-slate-300'}`}
            />
          ))}
        </div>

        {/* Card */}
        <div
          className="relative z-10 w-full"
          style={{
            animation: slideDir === 'in' ? 'regSlideIn 0.25s ease-out forwards' : 'regSlideOut 0.22s ease-in forwards',
          }}
        >
          {/* ── Step 1: Join ──────────────────────────────────── */}
          {step === 'join' && (
            <div className="space-y-5">
              {/* Header */}
              <div className="text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-3">
                  {club.club_type === 'study_group' ? 'Join Study Group' : club.club_type === 'online_class' ? 'Join Class' : 'Join Book Club'}
                </p>
                {club.cover_image_url ? (
                  <img src={club.cover_image_url} alt={club.name} className="h-16 w-16 rounded-2xl object-cover mx-auto mb-3 shadow-lg" />
                ) : (
                  <div className="h-16 w-16 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-3">
                    <Users className="h-8 w-8 text-blue-400" />
                  </div>
                )}
                <h1 className="text-2xl font-bold text-slate-800">{club.name}</h1>
                {club.description && (
                  <p className="text-sm text-slate-500 mt-2 leading-relaxed">{club.description}</p>
                )}
              </div>

              {error && <p className="text-sm text-red-600 text-center bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</p>}

              <button
                onClick={handleJoin}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl px-6 py-3.5 font-semibold text-sm hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-md"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitting ? 'Joining…' : 'Click to Join'}
                {!submitting && <ChevronRight className="h-4 w-4" />}
              </button>

              {!user && (
                <p className="text-center text-xs text-slate-400">
                  You'll be asked to sign in before joining
                </p>
              )}
            </div>
          )}

          {/* ── Step 2: Form ──────────────────────────────────── */}
          {step === 'form' && (
            <div className="space-y-5">
              <div className="text-center">
                <h2 className="text-xl font-bold text-slate-800">Registration Form</h2>
                <p className="text-sm text-slate-500 mt-1">Fill out the form to complete your registration.</p>
              </div>

              {showCheck && (
                <div className="flex items-center justify-center py-6">
                  <div style={{ animation: 'regCheckPop 0.4s ease-out forwards' }}>
                    <CheckCircle className="h-16 w-16 text-emerald-500" />
                  </div>
                </div>
              )}

              {!showCheck && (
                <>
                  <div className="space-y-4">
                    {fields.map(field => (
                      <div key={field.id}>
                        <label className="block text-xs font-medium text-slate-600 mb-1.5">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </label>
                        <FieldRenderer field={field} value={formValues[field.id]} onChange={updateField} />
                      </div>
                    ))}
                  </div>

                  {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</p>}

                  <button
                    onClick={handleSubmitForm}
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl px-6 py-3.5 font-semibold text-sm hover:bg-blue-700 active:scale-[0.98] transition-all disabled:opacity-50 shadow-md"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Submit
                    {!submitting && <ChevronRight className="h-4 w-4" />}
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Step 3: Welcome ───────────────────────────────── */}
          {step === 'welcome' && (
            <div className="space-y-5 text-center">
              <div>
                <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-9 w-9 text-emerald-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">
                  {settings?.welcome_heading || 'Welcome!'}
                </h2>
                {settings?.welcome_body && (
                  <p className="text-sm text-slate-500 mt-3 leading-relaxed whitespace-pre-line">
                    {settings.welcome_body}
                  </p>
                )}
              </div>

              <button
                onClick={handleGoToClub}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-xl px-6 py-3.5 font-semibold text-sm hover:bg-blue-700 active:scale-[0.98] transition-all shadow-md"
              >
                {settings?.welcome_cta_label || 'Go to Class'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="relative z-10 text-center text-xs text-slate-300 mt-8 w-full">{club.name}</p>
      </div>
    </div>
  );
}
