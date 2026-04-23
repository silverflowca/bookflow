import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import type { LiveEpisode as ILiveEpisode, LiveSlide } from '../../types';

const SLIDE_TYPE_ICON: Record<string, string> = {
  title: '🎬', heading: '📌', content: '📝', scripture: '✝️', list: '📋', discussion: '💬', closing: '🙏',
};

const SLIDE_TYPE_COLOR: Record<string, string> = {
  title: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  heading: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  content: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  scripture: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  list: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  discussion: 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300',
  closing: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
};

function SlidePreview({ slide, index }: { slide: LiveSlide; index: number }) {
  return (
    <div className="theme-card rounded-lg p-3 flex gap-3 items-start">
      <div className="w-7 h-7 rounded-full bg-surface-hover flex items-center justify-center text-xs font-bold text-muted shrink-0">
        {index + 1}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SLIDE_TYPE_COLOR[slide.type] ?? SLIDE_TYPE_COLOR.content}`}>
            {SLIDE_TYPE_ICON[slide.type]} {slide.type}
          </span>
          {slide.reference && <span className="text-xs text-muted">{slide.reference}</span>}
        </div>
        {slide.text && <div className="text-sm text-theme line-clamp-2">{slide.text}</div>}
        {slide.items && <ul className="text-sm text-theme space-y-0.5 mt-1">{slide.items.map((item, i) => <li key={i}>• {item}</li>)}</ul>}
      </div>
    </div>
  );
}

export default function LiveEpisode() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [episode, setEpisode] = useState<ILiveEpisode | null>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [freeshowOk, setFreeshowOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [postingRecap, setPostingRecap] = useState(false);
  const [recapMsg, setRecapMsg] = useState('');
  const [scheduledMsg, setScheduledMsg] = useState('');
  const [form, setForm] = useState({ title: '', chapter_id: '', scheduled_at: '', notes: '', recording_url: '', guest_invite_url: '' });

  useEffect(() => {
    if (!id) return;
    api.getLiveEpisode(id).then(r => {
      setEpisode(r.episode);
      setForm({
        title: r.episode.title,
        chapter_id: r.episode.chapter_id || '',
        scheduled_at: r.episode.scheduled_at?.slice(0, 16) || '',
        notes: r.episode.notes || '',
        recording_url: r.episode.recording_url || '',
        guest_invite_url: r.episode.guest_invite_url || '',
      });
      // Load chapters for book if show has book
      if (r.episode.live_shows?.book_id) {
        api.getChapters(r.episode.live_shows.book_id).then(chs => setChapters(chs)).catch(() => {});
      }
    }).catch(() => {}).finally(() => setLoading(false));

    api.getFreeshowStatus().then(r => setFreeshowOk(r.connected)).catch(() => setFreeshowOk(false));
  }, [id]);

  const saveForm = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const r = await api.updateLiveEpisode(id, form);
      setEpisode(r.episode);
    } finally { setSaving(false); }
  };

  const buildDeck = async () => {
    if (!id) return;
    if (!form.chapter_id) { alert('Pick a chapter first, then save.'); return; }
    // Save chapter selection first
    await api.updateLiveEpisode(id, { chapter_id: form.chapter_id });
    setBuilding(true);
    try {
      const r = await api.buildSlideDeck(id);
      setEpisode(prev => prev ? { ...prev, slide_deck: r.deck } : prev);
    } catch (e: any) {
      alert(e.message);
    } finally { setBuilding(false); }
  };

  const pushToFreeshow = async () => {
    if (!id) return;
    setPushing(true);
    try {
      const r = await api.pushToFreeshow(id);
      if (r.ok) {
        alert('✅ Slides sent to FreeShow! Check FreeShow for the new show.');
      } else {
        alert(`❌ ${r.error || 'Could not reach FreeShow. Make sure it is open and API is enabled.'}`);
      }
    } finally { setPushing(false); }
  };

  const goLive = async () => {
    if (!id) return;
    await api.startLiveEpisode(id);
    navigate(`/live/episode/${id}/dashboard`);
  };

  const scheduleOnRestream = async () => {
    if (!id) return;
    setScheduling(true);
    setScheduledMsg('');
    try {
      const r = await api.scheduleRestreamBroadcast(id);
      setScheduledMsg(r.message || '✅ Scheduled on YouTube & Facebook via Restream!');
    } catch (e: any) {
      setScheduledMsg(`❌ ${e.message || 'Could not schedule — check Restream connection in Settings.'}`);
    } finally { setScheduling(false); }
  };

  const postRecap = async () => {
    if (!id || !form.recording_url) return;
    setPostingRecap(true);
    setRecapMsg('');
    try {
      await api.updateLiveEpisode(id, { recording_url: form.recording_url });
      const r = await api.postRecap(id, { recording_url: form.recording_url, message: form.notes });
      setRecapMsg(r.message || '✅ Recap saved!');
      setEpisode(prev => prev ? { ...prev, recording_url: form.recording_url } : prev);
    } catch (e: any) {
      setRecapMsg(`❌ ${e.message || 'Could not save recap.'}`);
    } finally { setPostingRecap(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;
  if (!episode) return <div className="max-w-3xl mx-auto px-4 py-8 text-muted">Episode not found.</div>;

  const slides: LiveSlide[] = episode.slide_deck?.slides ?? [];
  const isEnded = episode.status === 'ended' || episode.status === 'cancelled';

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link to="/live" className="hover:text-theme transition-colors">Live Shows</Link>
        <span>/</span>
        <span className="text-theme font-medium">{episode.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — episode form */}
        <div>
          <div className="theme-card rounded-xl p-6 mb-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-theme text-lg">Episode Details</h2>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${episode.status === 'live' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : episode.status === 'ended' ? 'bg-gray-100 text-gray-500' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                {episode.status === 'live' ? '🔴 LIVE' : episode.status.charAt(0).toUpperCase() + episode.status.slice(1)}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Title</label>
                <input className="w-full theme-input rounded-lg px-3 py-2 text-sm" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} disabled={isEnded} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Scheduled For</label>
                <input type="datetime-local" className="w-full theme-input rounded-lg px-3 py-2 text-sm" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} disabled={isEnded} />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Chapter (for slide deck)</label>
                <select className="w-full theme-input rounded-lg px-3 py-2 text-sm" value={form.chapter_id} onChange={e => setForm(f => ({ ...f, chapter_id: e.target.value }))} disabled={isEnded}>
                  <option value="">No chapter selected</option>
                  {chapters.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  {chapters.length === 0 && episode.chapters && (
                    <option value={episode.chapter_id || ''}>{episode.chapters.title}</option>
                  )}
                </select>
                {chapters.length === 0 && !episode.live_shows?.book_id && (
                  <p className="text-xs text-muted mt-1">Link a book to your show to pick chapters</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Restream Guest Invite URL</label>
                <input className="w-full theme-input rounded-lg px-3 py-2 text-sm" value={form.guest_invite_url} onChange={e => setForm(f => ({ ...f, guest_invite_url: e.target.value }))} placeholder="https://restream.io/studio/invite/..." disabled={isEnded} />
              </div>
              {isEnded && (
                <div>
                  <label className="block text-xs font-medium text-muted mb-1">Recording URL (YouTube VOD)</label>
                  <input className="w-full theme-input rounded-lg px-3 py-2 text-sm" value={form.recording_url} onChange={e => setForm(f => ({ ...f, recording_url: e.target.value }))} placeholder="https://youtube.com/watch?v=..." />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Notes</label>
                <textarea className="w-full theme-input rounded-lg px-3 py-2 text-sm resize-none" rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Pre-show notes, agenda, prayer points..." />
              </div>
            </div>

            <button onClick={saveForm} disabled={saving} className="mt-4 theme-button-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 w-full">
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>

          {/* Guest invite */}
          {(form.guest_invite_url || episode.live_shows?.guest_invite_url) && (
            <div className="theme-card rounded-xl p-4 mb-5 border-l-4 border-accent">
              <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Guest Invite Link</div>
              <div className="flex items-center gap-2">
                <input readOnly className="flex-1 theme-input rounded-lg px-3 py-2 text-xs" value={form.guest_invite_url || episode.live_shows?.guest_invite_url || ''} />
                <button onClick={() => navigator.clipboard.writeText(form.guest_invite_url || episode.live_shows?.guest_invite_url || '')}
                  className="px-3 py-2 rounded-lg text-xs border border-theme text-muted hover:bg-surface-hover transition-colors shrink-0">
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!isEnded && (
            <div className="space-y-3">
              {/* FreeShow status indicator */}
              <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${freeshowOk ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300' : freeshowOk === false ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400' : 'bg-gray-50 text-gray-500 dark:bg-gray-800'}`}>
                <span>{freeshowOk ? '🟢' : freeshowOk === false ? '🟡' : '⚪'}</span>
                {freeshowOk ? 'FreeShow connected' : freeshowOk === false ? 'FreeShow not detected — open FreeShow and enable API in Connections' : 'Checking FreeShow…'}
              </div>

              <button onClick={buildDeck} disabled={building || !form.chapter_id} className="w-full px-4 py-2.5 rounded-lg text-sm font-medium border-2 border-accent text-accent hover:bg-accent hover:text-white transition-colors disabled:opacity-40">
                {building ? '⏳ Building slides…' : '🎛 Build Slide Deck from Chapter'}
              </button>

              {slides.length > 0 && (
                <button onClick={pushToFreeshow} disabled={pushing || !freeshowOk} className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-40">
                  {pushing ? '⏳ Pushing…' : '📡 Push Deck to FreeShow'}
                </button>
              )}

              {episode.status === 'scheduled' && (
                <>
                  <button onClick={scheduleOnRestream} disabled={scheduling} className="w-full px-4 py-2.5 rounded-lg text-sm font-medium border-2 border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-40">
                    {scheduling ? '⏳ Scheduling…' : '📅 Schedule on YouTube & Facebook'}
                  </button>
                  {scheduledMsg && (
                    <p className={`text-xs rounded-lg px-3 py-2 ${scheduledMsg.startsWith('❌') ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300' : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'}`}>
                      {scheduledMsg}
                    </p>
                  )}
                  <button onClick={goLive} className="w-full px-4 py-2.5 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-colors">
                    🔴 Go Live — Open Control Room
                  </button>
                </>
              )}

              {episode.status === 'live' && (
                <Link to={`/live/episode/${id}/dashboard`} className="block w-full px-4 py-2.5 rounded-lg text-sm font-bold bg-red-600 hover:bg-red-700 text-white transition-colors text-center">
                  🔴 Return to Control Room
                </Link>
              )}
            </div>
          )}

          {isEnded && (
            <div className="theme-card rounded-xl p-5 space-y-3">
              <h3 className="font-semibold text-theme text-sm">Post-Show Recap</h3>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Recording URL (YouTube VOD)</label>
                <input
                  className="w-full theme-input rounded-lg px-3 py-2 text-sm"
                  value={form.recording_url}
                  onChange={e => setForm(f => ({ ...f, recording_url: e.target.value }))}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Recap Message (optional)</label>
                <textarea
                  className="w-full theme-input rounded-lg px-3 py-2 text-sm resize-none"
                  rows={3}
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Great session! We covered Step 4 and prayed for 3 requests…"
                />
              </div>
              <button
                onClick={postRecap}
                disabled={postingRecap || !form.recording_url}
                className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white transition-colors disabled:opacity-40"
              >
                {postingRecap ? '⏳ Saving…' : '📋 Save Recap'}
              </button>
              {recapMsg && (
                <p className={`text-xs rounded-lg px-3 py-2 ${recapMsg.startsWith('❌') ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-300' : 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'}`}>
                  {recapMsg}
                </p>
              )}
              {episode.recording_url && (
                <a href={episode.recording_url} target="_blank" rel="noreferrer" className="block w-full px-4 py-2 rounded-lg text-sm font-medium border border-theme text-theme hover:bg-surface-hover text-center transition-colors">
                  ▶ Watch Recording
                </a>
              )}
            </div>
          )}
        </div>

        {/* Right — slide deck preview */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-theme text-lg">Slide Deck</h2>
            {slides.length > 0 && <span className="text-xs text-muted">{slides.length} slides</span>}
          </div>

          {slides.length === 0 ? (
            <div className="theme-card rounded-xl p-8 text-center text-muted">
              <div className="text-4xl mb-3">🎬</div>
              <div className="font-medium mb-1">No slides yet</div>
              <div className="text-sm">Select a chapter and click "Build Slide Deck"</div>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {slides.map((slide, i) => (
                <SlidePreview key={slide.id} slide={slide} index={i} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
