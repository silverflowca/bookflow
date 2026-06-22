import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, Bug, Sparkles, HelpCircle, MessageSquare, ChevronLeft, ChevronRight,
  Camera, Trash2, Pencil, CheckCircle2, Loader2, AlertCircle,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import type { FeedbackType, FeedbackScreenshot, AnnotationCommand } from '../../types';
import { useFeedbackContext } from '../../contexts/FeedbackContext';
import api from '../../lib/api';
import AnnotationCanvas from './AnnotationCanvas';
import AudioRecorder from './AudioRecorder';

type Step = 'type' | 'details' | 'screenshots' | 'audio' | 'review' | 'success';

const TYPE_CONFIG: Record<FeedbackType, { label: string; desc: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  bug:      { label: 'Bug Report',       desc: 'Something is broken or not working as expected',   color: 'border-red-300 bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',     Icon: Bug },
  feature:  { label: 'Feature Request',  desc: 'Suggest a new feature or improvement',             color: 'border-blue-300 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300', Icon: Sparkles },
  question: { label: 'Question',         desc: 'Ask about how something works',                    color: 'border-amber-300 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300', Icon: HelpCircle },
  comment:  { label: 'General Comment',  desc: 'Share general feedback or thoughts',               color: 'border-gray-300 bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300',  Icon: MessageSquare },
};

const STEPS: Step[] = ['type', 'details', 'screenshots', 'audio', 'review', 'success'];
const STEP_LABELS: Record<Step, string> = {
  type: 'Type',
  details: 'Details',
  screenshots: 'Screenshots',
  audio: 'Audio',
  review: 'Review',
  success: 'Done',
};

export default function FeedbackPanel() {
  const { isOpen, closeFeedback } = useFeedbackContext();

  // Form state
  const [step, setStep] = useState<Step>('type');
  const [fbType, setFbType] = useState<FeedbackType | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState<FeedbackScreenshot[]>([]);
  const [annotating, setAnnotating] = useState<number | null>(null); // index of screenshot being annotated
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) closeFeedback();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, closeFeedback]);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setStep('type');
      setFbType(null);
      setTitle('');
      setDescription('');
      setScreenshots([]);
      setAnnotating(null);
      setAudioBlob(null);
      setAudioDuration(0);
      setSubmitting(false);
      setSubmitError(null);
      setFeedbackId(null);
      setCaptureError(null);
    }
  }, [isOpen]);

  const stepIndex = STEPS.indexOf(step);
  const visibleSteps = STEPS.filter(s => s !== 'success');

  function goNext() {
    const idx = STEPS.indexOf(step);
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1]);
  }
  function goBack() {
    const idx = STEPS.indexOf(step);
    if (idx > 0) setStep(STEPS[idx - 1]);
  }

  const captureScreenshot = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    setCaptureError(null);
    try {
      const canvas = await html2canvas(document.body, {
        useCORS: true,
        allowTaint: true,
        scale: Math.min(window.devicePixelRatio, 2),
        logging: false,
        ignoreElements: (el: Element) => {
          const id = (el as HTMLElement).id;
          return id === 'feedback-panel-root';
        },
        windowWidth: document.documentElement.scrollWidth,
        windowHeight: document.documentElement.scrollHeight,
      });
      const dataUrl = canvas.toDataURL('image/png');
      if (!dataUrl || dataUrl === 'data:,') {
        throw new Error('Screenshot produced an empty image.');
      }
      const newShot: FeedbackScreenshot = {
        storage_path: '',
        annotation_data: [],
        order_index: screenshots.length,
        localDataUrl: dataUrl,
      };
      setScreenshots(prev => [...prev, newShot]);
    } catch (err: any) {
      console.error('Screenshot capture failed:', err);
      setCaptureError(err?.message || 'Screenshot capture failed. Try refreshing the page.');
    } finally {
      setCapturing(false);
    }
  }, [screenshots.length, capturing]);

  function removeScreenshot(idx: number) {
    setScreenshots(prev => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order_index: i })));
    if (annotating === idx) setAnnotating(null);
  }

  function updateAnnotation(idx: number, data: AnnotationCommand[]) {
    setScreenshots(prev => prev.map((s, i) => i === idx ? { ...s, annotation_data: data } : s));
  }

  async function handleSubmit() {
    if (!fbType || !title.trim()) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Upload screenshots (+ per-screenshot audio if present)
      const uploadedScreenshots: Array<{
        storage_path: string;
        annotation_data: AnnotationCommand[];
        order_index: number;
        note?: string;
        screenshot_audio_path?: string;
      }> = [];
      for (const shot of screenshots) {
        if (!shot.localDataUrl) continue;
        // Convert data URL to blob
        const res = await fetch(shot.localDataUrl);
        const blob = await res.blob();
        const { storage_path } = await api.uploadFeedbackScreenshot(blob);

        // Upload per-screenshot audio if recorded
        let screenshotAudioPath: string | undefined;
        if (shot.audioBlob) {
          const { storage_path: ap } = await api.uploadFeedbackAudio(shot.audioBlob, shot.audioDuration ?? 0);
          screenshotAudioPath = ap;
        }

        uploadedScreenshots.push({
          storage_path,
          annotation_data: shot.annotation_data,
          order_index: shot.order_index,
          note: shot.note || undefined,
          screenshot_audio_path: screenshotAudioPath,
        });
      }

      // Upload audio
      let uploadedAudio = null;
      if (audioBlob) {
        const { storage_path, duration_seconds } = await api.uploadFeedbackAudio(audioBlob, audioDuration);
        uploadedAudio = { storage_path, duration_seconds };
      }

      // Submit feedback
      const result = await api.submitFeedback({
        type: fbType,
        title: title.trim(),
        description: description.trim() || undefined,
        page_url: window.location.href,
        user_agent: navigator.userAgent,
        screenshots: uploadedScreenshots,
        audio: uploadedAudio,
      });

      setFeedbackId(result.id);
      setStep('success');
    } catch (err: any) {
      setSubmitError(err.message || 'Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const canNext =
    (step === 'type' && fbType !== null) ||
    (step === 'details' && title.trim().length > 0) ||
    step === 'screenshots' ||
    step === 'audio' ||
    step === 'review';

  if (!isOpen) return null;

  return (
    <>
    <div id="feedback-panel-root" className="fixed right-0 top-0 h-screen z-[200] flex">
      {/* Thin click-through gap hint on left */}
      <div
        className="w-8 self-stretch cursor-pointer"
        onClick={closeFeedback}
        title="Click to close feedback panel"
      />
      {/* Panel */}
      <div
        ref={panelRef}
        className="w-[400px] max-w-[100vw] h-full bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-2xl flex flex-col"
        style={{ animation: 'feedbackSlideIn 0.25s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-purple-500" />
            <span className="font-semibold text-sm text-theme">Send Feedback</span>
          </div>
          <button onClick={closeFeedback} className="p-1 rounded text-muted hover:text-theme transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar (not shown on success) */}
        {step !== 'success' && (
          <div className="px-4 pt-3 shrink-0">
            <div className="flex items-center gap-1 mb-1">
              {visibleSteps.map((s, i) => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIndex ? 'bg-purple-500' : 'bg-surface-hover'}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted">Step {stepIndex + 1} of {visibleSteps.length} — {STEP_LABELS[step]}</p>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          {/* ── Step: Type ─────────────────────────────────────────────────── */}
          {step === 'type' && (
            <div className="space-y-3">
              <p className="text-sm text-muted">What kind of feedback do you have?</p>
              {(Object.entries(TYPE_CONFIG) as [FeedbackType, typeof TYPE_CONFIG[FeedbackType]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => { setFbType(key); goNext(); }}
                  className="w-full text-left flex items-center gap-3 p-3 rounded-xl border-2 border-surface-hover hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/20 transition-all"
                >
                  <cfg.Icon className="h-5 w-5 shrink-0 text-muted" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-theme">{cfg.label}</p>
                    <p className="text-xs text-muted mt-0.5">{cfg.desc}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* ── Step: Details ──────────────────────────────────────────────── */}
          {step === 'details' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-theme mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={fbType === 'bug' ? 'e.g. Save button not working on mobile' : 'Brief description…'}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-theme text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
                  autoFocus
                  maxLength={500}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-theme mb-1">Details (optional)</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder={fbType === 'bug' ? 'Steps to reproduce, what you expected vs. what happened…' : 'More context…'}
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-theme text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
                />
              </div>
            </div>
          )}

          {/* ── Step: Screenshots ──────────────────────────────────────────── */}
          {step === 'screenshots' && (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Capture screenshots of the current app state. Navigate around and capture as many as needed — the panel stays open.
              </p>

              {captureError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{captureError}</span>
                </div>
              )}

              <button
                onClick={captureScreenshot}
                disabled={capturing}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30 transition-colors disabled:opacity-50"
              >
                {capturing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {capturing ? 'Capturing…' : screenshots.length === 0 ? 'Capture Screenshot' : 'Capture Another Screenshot'}
              </button>

              {screenshots.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {screenshots.map((shot, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden border border-surface-hover">
                      <img
                        src={shot.localDataUrl}
                        alt={`Screenshot ${i + 1}`}
                        className="w-full h-24 object-cover"
                      />
                      {/* Badges row */}
                      <div className="absolute top-1 left-1 flex flex-wrap gap-1">
                        {shot.annotation_data.length > 0 && (
                          <span className="bg-purple-500 text-white text-[10px] px-1.5 py-0.5 rounded leading-none">
                            {shot.annotation_data.length} mark{shot.annotation_data.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {shot.note && (
                          <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded leading-none">note</span>
                        )}
                        {shot.audioBlob && (
                          <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded leading-none">audio</span>
                        )}
                      </div>
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <button
                          onClick={() => setAnnotating(i)}
                          className="p-1.5 bg-white/90 rounded-md text-gray-800 hover:bg-white"
                          title="Annotate"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeScreenshot(i)}
                          className="p-1.5 bg-white/90 rounded-md text-red-600 hover:bg-white"
                          title="Remove"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Step: Audio ────────────────────────────────────────────────── */}
          {step === 'audio' && (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                Record an audio message to explain your feedback. This is optional — you can skip to the next step.
              </p>
              <AudioRecorder
                onRecordingComplete={(blob, dur) => { setAudioBlob(blob); setAudioDuration(dur); }}
                existingBlob={audioBlob}
              />
            </div>
          )}

          {/* ── Step: Review ───────────────────────────────────────────────── */}
          {step === 'review' && fbType && (
            <div className="space-y-4">
              {submitError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {submitError}
                </div>
              )}
              <div className="theme-section rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  {(() => { const cfg = TYPE_CONFIG[fbType]; return <cfg.Icon className="h-4 w-4 text-muted" />; })()}
                  <span className="text-xs font-medium text-muted uppercase tracking-wide">{TYPE_CONFIG[fbType].label}</span>
                </div>
                <p className="font-semibold text-theme">{title}</p>
                {description && <p className="text-sm text-muted whitespace-pre-wrap">{description}</p>}
              </div>

              {screenshots.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted mb-2 uppercase tracking-wide">{screenshots.length} Screenshot{screenshots.length !== 1 ? 's' : ''}</p>
                  <div className="flex gap-2 flex-wrap">
                    {screenshots.map((s, i) => (
                      <img
                        key={i}
                        src={s.localDataUrl}
                        alt={`Screenshot ${i + 1}`}
                        className="h-16 w-24 object-cover rounded-lg border border-surface-hover"
                      />
                    ))}
                  </div>
                </div>
              )}

              {audioBlob && (
                <div className="flex items-center gap-2 text-sm text-muted">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  Audio message attached ({Math.round(audioDuration)}s)
                </div>
              )}

              <p className="text-xs text-muted">
                Your current page URL and browser info will be included automatically.
              </p>
            </div>
          )}

          {/* ── Step: Success ──────────────────────────────────────────────── */}
          {step === 'success' && (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 space-y-4">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-theme text-lg">Thank you!</p>
                <p className="text-sm text-muted mt-1">Your feedback has been submitted successfully.</p>
                {feedbackId && (
                  <p className="text-xs text-muted mt-2 font-mono">
                    Ref: #{feedbackId.slice(0, 8).toUpperCase()}
                  </p>
                )}
              </div>
              <button
                onClick={closeFeedback}
                className="px-6 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step !== 'success' && (
          <div className="px-4 py-3 border-t border-[var(--color-border)] shrink-0 flex items-center gap-2">
            {stepIndex > 0 ? (
              <button
                onClick={goBack}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm text-muted hover:text-theme border border-[var(--color-border)] hover:bg-surface-hover transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>
            ) : (
              <div />
            )}
            <div className="flex-1" />
            {step === 'audio' && (
              <button
                onClick={goNext}
                className="px-4 py-2 rounded-lg text-sm text-muted hover:text-theme border border-[var(--color-border)] hover:bg-surface-hover transition-colors"
              >
                Skip
              </button>
            )}
            {step === 'review' ? (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {submitting ? 'Submitting…' : 'Submit Feedback'}
              </button>
            ) : (
              <button
                onClick={goNext}
                disabled={!canNext}
                className="flex items-center gap-1 px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes feedbackSlideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </div>

    {/* ── Full-screen annotation overlay ───────────────────────────────── */}
    {annotating !== null && screenshots[annotating] && (
      <div
        className="fixed inset-0 z-[300] bg-gray-950 flex flex-col"
        style={{ animation: 'feedbackSlideIn 0.15s ease-out' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-700 shrink-0">
          <button
            onClick={() => setAnnotating(null)}
            className="flex items-center gap-1.5 text-sm text-gray-300 hover:text-white transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </button>
          <span className="text-sm text-gray-400">Screenshot {annotating + 1} — annotate, add note &amp; audio</span>
          <button
            onClick={() => setAnnotating(null)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
          >
            Done
          </button>
        </div>

        {/*
          Body: on desktop → side-by-side (canvas left, note+audio right).
          On mobile → canvas top (fixed height), note+audio below (scrollable).
        */}
        <div className="flex-1 min-h-0 flex flex-col md:flex-row">

          {/* Left / top: annotation canvas — fills available space */}
          <div className="flex-1 min-h-0 overflow-auto p-4">
            <AnnotationCanvas
              imageUrl={screenshots[annotating].localDataUrl!}
              annotations={screenshots[annotating].annotation_data}
              onChange={data => updateAnnotation(annotating, data)}
            />
          </div>

          {/* Right / bottom: note + audio — fixed width on desktop, auto on mobile */}
          <div className="w-full md:w-80 shrink-0 flex flex-col border-t md:border-t-0 md:border-l border-gray-800 bg-gray-900">
            <div className="flex-1 overflow-y-auto p-4 space-y-5">

              {/* Text note */}
              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-2">
                  Note
                </label>
                <textarea
                  value={screenshots[annotating].note ?? ''}
                  onChange={e => setScreenshots(prev => prev.map((s, i) =>
                    i === annotating ? { ...s, note: e.target.value } : s
                  ))}
                  placeholder="Describe what's happening in this screenshot…"
                  rows={5}
                  className="w-full px-3 py-2 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                />
              </div>

              {/* Audio note */}
              <div>
                <label className="block text-sm font-semibold text-gray-200 mb-2">
                  Audio note
                </label>
                <AudioRecorder
                  onRecordingComplete={(blob, dur) => setScreenshots(prev => prev.map((s, i) =>
                    i === annotating ? { ...s, audioBlob: blob, audioDuration: dur } : s
                  ))}
                  existingBlob={screenshots[annotating].audioBlob ?? null}
                />
              </div>

            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
