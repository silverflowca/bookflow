import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import type { LiveEpisode } from '../../types';

interface BibleVerse { verse: number; text: string; }

const TARGET_LABELS: Record<string, string> = {
  chat: '💬 Chat',
  lower_third: '📺 Lower Third',
  caption: '🔤 Caption',
};

function SendButtons({ onSend, sending }: { onSend: (targets: string[]) => void; sending: boolean }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {(['chat', 'lower_third', 'caption'] as const).map(t => (
        <button key={t} disabled={sending} onClick={() => onSend([t])}
          className="px-2 py-1 text-xs rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 hover:bg-indigo-200 transition-colors disabled:opacity-40">
          {TARGET_LABELS[t]}
        </button>
      ))}
      <button disabled={sending} onClick={() => onSend(['chat', 'lower_third', 'caption'])}
        className="px-2 py-1 text-xs rounded-md bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200 transition-colors disabled:opacity-40">
        All 3 ↑
      </button>
    </div>
  );
}

export default function LiveBible() {
  const [books, setBooks] = useState<{ book_name: string; book_order: number }[]>([]);
  const [selectedBook, setSelectedBook] = useState('John');
  const [chapters, setChapters] = useState<number[]>([]);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [verses, setVerses] = useState<BibleVerse[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  // Episode selection for queuing
  const [episodes, setEpisodes] = useState<LiveEpisode[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState('');

  // Selection state
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rangeStart, setRangeStart] = useState<number | null>(null);

  // Send state
  const [sending, setSending] = useState<string | null>(null); // itemId or 'freetext'
  const [sentMsg, setSentMsg] = useState('');
  const [addingToQueue, setAddingToQueue] = useState(false);
  const [queueMsg, setQueueMsg] = useState('');

  useEffect(() => {
    api.getBibleBooks().then(setBooks).catch(() => {});
    api.getLiveEpisodes().then(r => {
      const eps = (r.episodes || []).filter((e: LiveEpisode) => e.status === 'scheduled' || e.status === 'live');
      setEpisodes(eps);
      if (eps.length > 0) setSelectedEpisodeId(eps[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    api.getBibleChapters(selectedBook).then(chs => {
      setChapters(chs);
      setSelectedChapter(chs[0] || 1);
    }).catch(() => {});
  }, [selectedBook]);

  useEffect(() => {
    setVerses([]);
    setSelected(new Set());
    api.getBibleChapter(selectedBook, selectedChapter).then(setVerses).catch(() => {});
  }, [selectedBook, selectedChapter]);

  const doSearch = useCallback(async () => {
    if (searchQ.trim().length < 2) return;
    setSearching(true);
    try {
      const r = await api.searchBible(searchQ);
      setSearchResults(r);
    } finally { setSearching(false); }
  }, [searchQ]);

  const toggleVerse = (v: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  };

  const handleVerseClick = (v: number, shiftKey: boolean) => {
    if (shiftKey && rangeStart !== null) {
      const min = Math.min(rangeStart, v);
      const max = Math.max(rangeStart, v);
      setSelected(prev => {
        const next = new Set(prev);
        for (let i = min; i <= max; i++) next.add(i);
        return next;
      });
    } else {
      setRangeStart(v);
      toggleVerse(v);
    }
  };

  const buildItem = () => {
    const sorted = [...selected].sort((a, b) => a - b);
    if (sorted.length === 0) return null;
    const min = sorted[0], max = sorted[sorted.length - 1];
    const label = sorted.length === 1
      ? `${selectedBook} ${selectedChapter}:${min}`
      : `${selectedBook} ${selectedChapter}:${min}–${max}`;
    const body = verses
      .filter(v => selected.has(v.verse))
      .map(v => `${v.verse} ${v.text}`)
      .join(' ');
    return { type: 'verse', label, body, book_ref: selectedBook, chapter_ref: selectedChapter, verse_start: min, verse_end: max };
  };

  const addToQueue = async () => {
    const item = buildItem();
    if (!item || !selectedEpisodeId) return;
    setAddingToQueue(true);
    setQueueMsg('');
    try {
      await api.addQueueItem(selectedEpisodeId, item);
      setQueueMsg(`✅ Added "${item.label}" to queue`);
      setSelected(new Set());
    } catch (e: any) {
      setQueueMsg(`❌ ${e.message}`);
    } finally { setAddingToQueue(false); }
  };

  const sendNow = async (targets: string[]) => {
    const item = buildItem();
    if (!item || !selectedEpisodeId) return;
    setSending('selection');
    setSentMsg('');
    try {
      await api.sendNow(selectedEpisodeId, { text: item.body, label: item.label, targets });
      setSentMsg(`✅ Sent "${item.label}" to ${targets.join(', ')}`);
      setSelected(new Set());
    } catch (e: any) {
      setSentMsg(`❌ ${e.message}`);
    } finally { setSending(null); }
  };

  const sendSingleVerse = async (v: BibleVerse, targets: string[]) => {
    if (!selectedEpisodeId) return;
    const label = `${selectedBook} ${selectedChapter}:${v.verse}`;
    const body = v.text;
    setSending(`v${v.verse}`);
    setSentMsg('');
    try {
      await api.sendNow(selectedEpisodeId, { text: body, label, targets });
      setSentMsg(`✅ Sent ${label}`);
    } catch (e: any) {
      setSentMsg(`❌ ${e.message}`);
    } finally { setSending(null); }
  };

  const addSingleToQueue = async (v: BibleVerse) => {
    if (!selectedEpisodeId) return;
    const label = `${selectedBook} ${selectedChapter}:${v.verse}`;
    setAddingToQueue(true);
    try {
      await api.addQueueItem(selectedEpisodeId, {
        type: 'verse', label, body: v.text,
        book_ref: selectedBook, chapter_ref: selectedChapter,
        verse_start: v.verse, verse_end: v.verse,
      });
      setQueueMsg(`✅ Added ${label} to queue`);
    } catch (e: any) {
      setQueueMsg(`❌ ${e.message}`);
    } finally { setAddingToQueue(false); }
  };

  const sendSearchResult = async (r: any, targets: string[]) => {
    const label = `${r.book_name} ${r.chapter}:${r.verse}`;
    setSending(`s${r.verse}`);
    try {
      await api.sendNow(selectedEpisodeId, { text: r.text, label, targets });
      setSentMsg(`✅ Sent ${label}`);
    } catch (e: any) {
      setSentMsg(`❌ ${e.message}`);
    } finally { setSending(null); }
  };

  const addSearchToQueue = async (r: any) => {
    const label = `${r.book_name} ${r.chapter}:${r.verse}`;
    try {
      await api.addQueueItem(selectedEpisodeId, {
        type: 'verse', label, body: r.text,
        book_ref: r.book_name, chapter_ref: r.chapter,
        verse_start: r.verse, verse_end: r.verse,
      });
      setQueueMsg(`✅ Added ${label} to queue`);
    } catch (e: any) {
      setQueueMsg(`❌ ${e.message}`);
    }
  };

  const selectionItem = buildItem();
  const hasSelection = selected.size > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link to="/live" className="hover:text-theme transition-colors">Live Shows</Link>
        <span>/</span>
        <span className="text-theme font-medium">Bible</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-theme">✝️ Bible</h1>
        {/* Episode picker */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted">Queue for:</label>
          <select className="theme-input text-sm rounded-lg px-2 py-1"
            value={selectedEpisodeId} onChange={e => setSelectedEpisodeId(e.target.value)}>
            {episodes.length === 0 && <option value="">No active episodes</option>}
            {episodes.map(ep => (
              <option key={ep.id} value={ep.id}>{ep.title}</option>
            ))}
          </select>
          {selectedEpisodeId && (
            <Link to={`/live/episode/${selectedEpisodeId}/queue`}
              className="text-xs text-accent hover:underline">View Queue →</Link>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="flex gap-2 mb-6">
        <input
          className="flex-1 theme-input rounded-lg px-3 py-2 text-sm"
          placeholder="Search verses… e.g. 'love one another'"
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doSearch()}
        />
        <button onClick={doSearch} disabled={searching}
          className="px-4 py-2 rounded-lg text-sm font-medium theme-button-primary disabled:opacity-40">
          {searching ? '…' : 'Search'}
        </button>
        {searchQ && <button onClick={() => { setSearchQ(''); setSearchResults([]); }}
          className="px-3 py-2 rounded-lg text-sm border border-theme text-muted hover:bg-surface-hover">✕</button>}
      </div>

      {/* Search results */}
      {searchResults.length > 0 && (
        <div className="theme-card rounded-xl p-4 mb-6">
          <h3 className="font-semibold text-theme text-sm mb-3">Search Results ({searchResults.length})</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {searchResults.map((r, i) => (
              <div key={i} className="flex items-start gap-3 py-2 border-b border-theme last:border-0">
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-semibold text-accent">{r.book_name} {r.chapter}:{r.verse}</span>
                  <p className="text-sm text-theme mt-0.5">{r.text}</p>
                </div>
                <div className="shrink-0 space-y-1">
                  <button onClick={() => addSearchToQueue(r)} disabled={!selectedEpisodeId}
                    className="block w-full px-2 py-1 text-xs rounded bg-surface-hover text-muted hover:text-theme transition-colors disabled:opacity-40">
                    + Queue
                  </button>
                  <SendButtons onSend={t => sendSearchResult(r, t)} sending={sending === `s${r.verse}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Book / Chapter selectors */}
      <div className="flex gap-3 mb-4">
        <select className="theme-input rounded-lg px-3 py-2 text-sm"
          value={selectedBook} onChange={e => setSelectedBook(e.target.value)}>
          {books.map(b => <option key={b.book_name} value={b.book_name}>{b.book_name}</option>)}
        </select>
        <select className="theme-input rounded-lg px-3 py-2 text-sm w-28"
          value={selectedChapter} onChange={e => setSelectedChapter(Number(e.target.value))}>
          {chapters.map(c => <option key={c} value={c}>Chapter {c}</option>)}
        </select>
        <span className="text-xs text-muted self-center">Click verse to select · Shift+click for range</span>
      </div>

      {/* Selection action bar */}
      {hasSelection && selectionItem && (
        <div className="theme-card rounded-xl p-4 mb-4 border-l-4 border-accent">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-accent mb-1">{selectionItem.label} ({selected.size} verse{selected.size > 1 ? 's' : ''})</div>
              <p className="text-sm text-theme line-clamp-2">{selectionItem.body}</p>
            </div>
            <div className="shrink-0 space-y-2">
              <button onClick={addToQueue} disabled={addingToQueue || !selectedEpisodeId}
                className="block w-full px-3 py-1.5 text-xs rounded-lg bg-accent text-white hover:opacity-90 transition-colors disabled:opacity-40">
                {addingToQueue ? '…' : '+ Add to Queue'}
              </button>
              <SendButtons onSend={sendNow} sending={sending === 'selection'} />
            </div>
          </div>
          {(sentMsg || queueMsg) && (
            <p className={`text-xs mt-2 ${(sentMsg || queueMsg).startsWith('❌') ? 'text-red-500' : 'text-green-600'}`}>
              {sentMsg || queueMsg}
            </p>
          )}
        </div>
      )}

      {/* Verse list */}
      <div className="theme-card rounded-xl overflow-hidden">
        {verses.length === 0 ? (
          <div className="p-8 text-center text-muted">Loading verses…</div>
        ) : (
          <div className="divide-y divide-theme">
            {verses.map(v => (
              <div key={v.verse}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${selected.has(v.verse) ? 'bg-accent/10' : 'hover:bg-surface-hover'}`}
                onClick={e => handleVerseClick(v.verse, e.shiftKey)}>
                <span className="text-xs font-bold text-accent w-6 shrink-0 mt-0.5">{v.verse}</span>
                <p className="flex-1 text-sm text-theme leading-relaxed select-none">{v.text}</p>
                <div className="shrink-0 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={e => e.stopPropagation()}>
                  <button onClick={() => addSingleToQueue(v)} disabled={!selectedEpisodeId || addingToQueue}
                    className="px-2 py-1 text-xs rounded bg-surface-hover text-muted hover:text-theme transition-colors disabled:opacity-40">
                    +Q
                  </button>
                  {(['chat', 'lower_third', 'caption'] as const).map(t => (
                    <button key={t} disabled={sending === `v${v.verse}`}
                      onClick={() => sendSingleVerse(v, [t])}
                      className="px-2 py-1 text-xs rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 hover:bg-indigo-200 transition-colors disabled:opacity-40"
                      title={TARGET_LABELS[t]}>
                      {t === 'chat' ? '💬' : t === 'lower_third' ? '📺' : '🔤'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(sentMsg || queueMsg) && !hasSelection && (
        <p className={`text-xs mt-3 text-center ${(sentMsg || queueMsg).startsWith('❌') ? 'text-red-500' : 'text-green-600'}`}>
          {sentMsg || queueMsg}
        </p>
      )}
    </div>
  );
}
