import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import type { LiveShow, LiveEpisode } from '../../types';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const RECURRENCE_LABELS: Record<string, string> = {
  weekly: 'Weekly', biweekly: 'Bi-weekly', monthly: 'Monthly', none: 'One-time',
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    live: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    ended: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    cancelled: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] ?? map.ended}`}>
      {status === 'live' ? '🔴 LIVE' : status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function ShowForm({ initial, onSave, onCancel, books }: {
  initial?: Partial<LiveShow>;
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  books: any[];
}) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    book_id: initial?.book_id || '',
    recurrence: initial?.recurrence || 'weekly',
    recurrence_day: initial?.recurrence_day ?? 0,
    recurrence_time: initial?.recurrence_time || '19:00',
    timezone: initial?.timezone || 'America/Toronto',
    guest_invite_url: initial?.guest_invite_url || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try { await onSave(form); } finally { setSaving(false); }
  };

  return (
    <div className="theme-card rounded-xl p-6 mb-6">
      <h3 className="font-bold text-theme text-lg mb-4">{initial?.id ? 'Edit Show' : 'New Recurring Show'}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Show Title *</label>
          <input className="w-full theme-input rounded-lg px-3 py-2 text-sm" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Overcomers — 12 Step Live" />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Linked Book (optional)</label>
          <select className="w-full theme-input rounded-lg px-3 py-2 text-sm" value={form.book_id} onChange={e => setForm(f => ({ ...f, book_id: e.target.value }))}>
            <option value="">No book linked</option>
            {books.map(b => <option key={b.id} value={b.id}>{b.title}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-muted mb-1">Description</label>
          <textarea className="w-full theme-input rounded-lg px-3 py-2 text-sm resize-none" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Weekly 12-step recovery meeting and book study..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Recurrence</label>
          <select className="w-full theme-input rounded-lg px-3 py-2 text-sm" value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value as import('../../types').LiveRecurrence }))}>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Bi-weekly</option>
            <option value="monthly">Monthly</option>
            <option value="none">One-time</option>
          </select>
        </div>
        {form.recurrence !== 'none' && (
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Day of Week</label>
            <select className="w-full theme-input rounded-lg px-3 py-2 text-sm" value={form.recurrence_day} onChange={e => setForm(f => ({ ...f, recurrence_day: Number(e.target.value) }))}>
              {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
            </select>
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Time</label>
          <input type="time" className="w-full theme-input rounded-lg px-3 py-2 text-sm" value={form.recurrence_time} onChange={e => setForm(f => ({ ...f, recurrence_time: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-muted mb-1">Timezone</label>
          <select className="w-full theme-input rounded-lg px-3 py-2 text-sm" value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
            <option value="America/Toronto">Eastern (Toronto)</option>
            <option value="America/New_York">Eastern (New York)</option>
            <option value="America/Chicago">Central</option>
            <option value="America/Denver">Mountain</option>
            <option value="America/Los_Angeles">Pacific</option>
            <option value="UTC">UTC</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-muted mb-1">Restream Guest Invite URL (paste from Restream Studio)</label>
          <input className="w-full theme-input rounded-lg px-3 py-2 text-sm" value={form.guest_invite_url} onChange={e => setForm(f => ({ ...f, guest_invite_url: e.target.value }))} placeholder="https://restream.io/studio/invite/..." />
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={save} disabled={saving || !form.title.trim()} className="theme-button-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Show'}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium text-muted border border-theme hover:bg-surface-hover transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function LiveSchedule() {
  const navigate = useNavigate();
  const [shows, setShows] = useState<LiveShow[]>([]);
  const [episodes, setEpisodes] = useState<LiveEpisode[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editShow, setEditShow] = useState<LiveShow | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);
  const [goingLive, setGoingLive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  useEffect(() => {
    Promise.all([
      api.getLiveShows(),
      api.getLiveEpisodes(),
      api.getMyBooks(),
    ]).then(([s, e, b]) => {
      setShows(s.shows ?? []);
      setEpisodes(e.episodes ?? []);
      setBooks(b ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const createShow = async (data: any) => {
    const r = await api.createLiveShow(data);
    setShows(prev => [r.show, ...prev]);
    setShowForm(false);
  };

  const updateShow = async (data: any) => {
    if (!editShow) return;
    const r = await api.updateLiveShow(editShow.id, data);
    setShows(prev => prev.map(s => s.id === r.show.id ? r.show : s));
    setEditShow(null);
  };

  const deleteShow = async (id: string) => {
    if (!confirm('Delete this show and all its episodes?')) return;
    await api.deleteLiveShow(id);
    setShows(prev => prev.filter(s => s.id !== id));
  };

  const generateEpisode = async (showId: string) => {
    setGenerating(showId);
    try {
      const r = await api.generateNextEpisode(showId);
      setEpisodes(prev => [r.episode, ...prev]);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setGenerating(null);
    }
  };

  // Create a one-time episode from a show and immediately go live
  const goLiveNowFromShow = async (show: LiveShow) => {
    setGoingLive(show.id);
    try {
      const now = new Date().toISOString();
      const r = await api.createLiveEpisode({
        show_id: show.id,
        title: `${show.title} — ${new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`,
        scheduled_at: now,
      });
      await api.startLiveEpisode(r.episode.id);
      navigate(`/live/episode/${r.episode.id}/dashboard`);
    } catch (e: any) {
      alert(e.message || 'Could not start live show');
      setGoingLive(null);
    }
  };

  // Start an already-scheduled episode immediately
  const goLiveNowFromEpisode = async (ep: LiveEpisode) => {
    setGoingLive(ep.id);
    try {
      await api.startLiveEpisode(ep.id);
      navigate(`/live/episode/${ep.id}/dashboard`);
    } catch (e: any) {
      alert(e.message || 'Could not start live show');
      setGoingLive(null);
    }
  };

  const upcoming = episodes.filter(e => e.status === 'scheduled' || e.status === 'live')
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  const past = episodes.filter(e => e.status === 'ended' || e.status === 'cancelled')
    .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime());

  if (loading) return <div className="flex items-center justify-center min-h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-theme flex items-center gap-3">
            🔴 Live Shows
          </h1>
          <p className="text-muted text-sm mt-1">Schedule recurring shows, build episode decks, go live to YouTube + Facebook via Restream</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditShow(null); }} className="theme-button-primary px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2">
          + New Show
        </button>
      </div>

      {/* Show form */}
      {showForm && !editShow && (
        <ShowForm books={books} onSave={createShow} onCancel={() => setShowForm(false)} />
      )}

      {/* Shows list */}
      {shows.length > 0 && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-muted uppercase tracking-wider mb-3">Your Shows</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {shows.map(show => (
              <div key={show.id}>
                {editShow?.id === show.id ? (
                  <ShowForm initial={show} books={books} onSave={updateShow} onCancel={() => setEditShow(null)} />
                ) : (
                  <div className="theme-card rounded-xl p-5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="font-bold text-theme">{show.title}</div>
                        {show.description && <div className="text-sm text-muted mt-0.5 line-clamp-1">{show.description}</div>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${show.is_active ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500'}`}>
                        {show.is_active ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    <div className="text-xs text-muted space-y-0.5 mb-4">
                      <div>📅 {RECURRENCE_LABELS[show.recurrence]} · {DAYS[show.recurrence_day ?? 0]}s at {show.recurrence_time?.slice(0,5)}</div>
                      <div>🌍 {show.timezone}</div>
                      {show.books && <div>📖 {show.books.title}</div>}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => goLiveNowFromShow(show)} disabled={goingLive === show.id} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors">
                        {goingLive === show.id ? '…' : '🔴 Go Live Now'}
                      </button>
                      <button onClick={() => generateEpisode(show.id)} disabled={generating === show.id} className="theme-button-primary px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50">
                        {generating === show.id ? '…' : '+ Episode'}
                      </button>
                      <button onClick={() => setEditShow(show)} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-theme text-muted hover:bg-surface-hover transition-colors">
                        Edit
                      </button>
                      <button onClick={() => deleteShow(show.id)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Episodes */}
      <div>
        <div className="flex gap-1 mb-4 border-b border-theme">
          {(['upcoming', 'past'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-accent text-accent' : 'border-transparent text-muted hover:text-theme'}`}>
              {t} {t === 'upcoming' ? `(${upcoming.length})` : `(${past.length})`}
            </button>
          ))}
        </div>

        {tab === 'upcoming' && (
          <div className="space-y-3">
            {upcoming.length === 0 && (
              <div className="text-center py-12 text-muted">
                <div className="text-4xl mb-3">📡</div>
                <div className="font-medium">No upcoming episodes</div>
                <div className="text-sm mt-1">Create a show above, then click "Generate Episode"</div>
              </div>
            )}
            {upcoming.map(ep => (
              <div key={ep.id} className="theme-card rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={ep.status} />
                    <span className="font-semibold text-theme text-sm truncate">{ep.title}</span>
                  </div>
                  <div className="text-xs text-muted">{fmtDate(ep.scheduled_at)}</div>
                  {ep.chapters && <div className="text-xs text-muted mt-0.5">📖 {ep.chapters.title}</div>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {ep.status === 'live' ? (
                    <Link to={`/live/episode/${ep.id}/dashboard`} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
                      🔴 Control Room
                    </Link>
                  ) : (
                    <button onClick={() => goLiveNowFromEpisode(ep)} disabled={goingLive === ep.id} className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50 transition-colors">
                      {goingLive === ep.id ? '…' : '🔴 Go Live'}
                    </button>
                  )}
                  <Link to={`/live/episode/${ep.id}`} className="theme-button-primary px-3 py-1.5 rounded-lg text-xs font-medium">
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'past' && (
          <div className="space-y-3">
            {past.length === 0 && (
              <div className="text-center py-12 text-muted">
                <div className="text-4xl mb-3">📼</div>
                <div className="font-medium">No past episodes yet</div>
              </div>
            )}
            {past.map(ep => (
              <div key={ep.id} className="theme-card rounded-xl p-4 flex items-center justify-between gap-4 opacity-80">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={ep.status} />
                    <span className="font-semibold text-theme text-sm truncate">{ep.title}</span>
                  </div>
                  <div className="text-xs text-muted">{fmtDate(ep.scheduled_at)}</div>
                  {ep.recording_url && (
                    <a href={ep.recording_url} target="_blank" rel="noreferrer" className="text-xs text-accent hover:underline mt-0.5 block">
                      ▶ Watch Recording
                    </a>
                  )}
                </div>
                <Link to={`/live/episode/${ep.id}`} className="px-3 py-1.5 rounded-lg text-xs font-medium border border-theme text-muted hover:bg-surface-hover transition-colors">
                  View
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
