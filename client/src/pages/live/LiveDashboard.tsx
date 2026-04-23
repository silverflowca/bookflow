import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../../lib/api';
import type { LiveEpisode, LiveSlide, LiveChatMessage, LiveRequest, LiveQueueItem, LiveQueueGroup, LiveSendTarget } from '../../types';

const TARGET_LABELS: Record<string, string> = {
  chat: '💬', lower_third: '📺', caption: '🔤',
};

const PLATFORM_ICON: Record<string, string> = {
  youtube: '▶', facebook: 'f', twitch: '🎮', restream: '📡',
};
const PLATFORM_COLOR: Record<string, string> = {
  youtube: 'text-red-500', facebook: 'text-blue-500', twitch: 'text-purple-500', restream: 'text-orange-400',
};

const SLIDE_TYPE_ICON: Record<string, string> = {
  title: '🎬', heading: '📌', content: '📝', scripture: '✝️', list: '📋', discussion: '💬', closing: '🙏',
};

export default function LiveDashboard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [episode, setEpisode] = useState<LiveEpisode | null>(null);
  const [slides, setSlides] = useState<LiveSlide[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [chat, setChat] = useState<LiveChatMessage[]>([]);
  const [requests, setRequests] = useState<LiveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [ending, setEnding] = useState(false);
  const [flagBody, setFlagBody] = useState('');
  const [flagType, setFlagType] = useState<'prayer' | 'question' | 'comment'>('prayer');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);

  // Restream stream status
  const [streamChannels, setStreamChannels] = useState<any[]>([]);
  const [goingLiveRestream, setGoingLiveRestream] = useState(false);
  const streamPollRef = useRef<number | null>(null);

  // Left panel tab: slides | queue
  const [leftTab, setLeftTab] = useState<'slides' | 'queue'>('slides');

  // Queue
  const [_queueGroups, setQueueGroups] = useState<LiveQueueGroup[]>([]);
  const [queueItems, setQueueItems] = useState<LiveQueueItem[]>([]);
  const [sendingQueueItem, setSendingQueueItem] = useState<string | null>(null);
  const [freeText, setFreeText] = useState('');
  const [freeTargets, setFreeTargets] = useState<LiveSendTarget[]>(['chat']);
  const [sendingFree, setSendingFree] = useState(false);
  const [sendMsg, setSendMsg] = useState('');

  const loadChat = useCallback(async () => {
    if (!id) return;
    const [c, r] = await Promise.all([
      api.getLiveChat(id).catch(() => ({ messages: [] })),
      api.getLiveRequests(id).catch(() => ({ requests: [] })),
    ]);
    setChat(c.messages ?? []);
    setRequests(r.requests ?? []);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    api.getLiveEpisode(id).then(r => {
      setEpisode(r.episode);
      setSlides(r.episode.slide_deck?.slides ?? []);
    }).catch(() => {}).finally(() => setLoading(false));

    loadChat();
    pollRef.current = window.setInterval(loadChat, 4000);

    // Load queue
    api.getQueue(id).then(r => {
      setQueueGroups(r.groups || []);
      setQueueItems(r.items || []);
    }).catch(() => {});

    // Poll Restream stream status every 30s
    const loadStreamStatus = () => {
      api.getRestreamStreamStatus().then(r => setStreamChannels(r.channels ?? [])).catch(() => {});
    };
    loadStreamStatus();
    streamPollRef.current = window.setInterval(loadStreamStatus, 30000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (streamPollRef.current) clearInterval(streamPollRef.current);
    };
  }, [id, loadChat]);

  const goLiveRestream = async () => {
    setGoingLiveRestream(true);
    try {
      await api.restreamGoLive();
      const r = await api.getRestreamStreamStatus();
      setStreamChannels(r.channels ?? []);
    } catch (e: any) {
      alert(e.message || 'Could not enable Restream channels');
    } finally {
      setGoingLiveRestream(false);
    }
  };

  const fsAction = async (action: string) => {
    await api.freeshowAction(action).catch(() => {});
  };

  const goToSlide = async (index: number) => {
    setCurrentSlide(index);
    await fsAction(`nextSlide`); // FreeShow advances; for exact slide: would need slide id
  };

  const prevSlide = async () => {
    const next = Math.max(0, currentSlide - 1);
    setCurrentSlide(next);
    await fsAction('previousSlide');
  };

  const nextSlide = async () => {
    const next = Math.min(slides.length - 1, currentSlide + 1);
    setCurrentSlide(next);
    await fsAction('nextSlide');
  };

  const flagRequest = async () => {
    if (!id || !flagBody.trim()) return;
    const r = await api.flagLiveRequest(id, { type: flagType, body: flagBody.trim() });
    setRequests(prev => [...prev, r.request]);
    setFlagBody('');
  };

  const resolveRequest = async (requestId: string) => {
    await api.resolveLiveRequest(requestId);
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, resolved: true } : r));
  };

  const flagFromChat = async (msg: LiveChatMessage) => {
    if (!id) return;
    const r = await api.flagLiveRequest(id, { message_id: msg.id, type: 'prayer', body: msg.body });
    setRequests(prev => [...prev, r.request]);
  };

  const sendQueueItem = async (item: LiveQueueItem, targets: LiveSendTarget[]) => {
    setSendingQueueItem(item.id);
    setSendMsg('');
    try {
      await api.sendQueueItem(item.id, targets);
      setSendMsg(`✅ Sent "${item.label}"`);
      setQueueItems(prev => prev.map(i => i.id === item.id
        ? { ...i, sent_at: new Date().toISOString(), sent_targets: targets }
        : i));
    } catch (e: any) {
      setSendMsg(`❌ ${e.message}`);
    } finally { setSendingQueueItem(null); }
  };

  const sendFreeNow = async () => {
    if (!id || !freeText.trim() || freeTargets.length === 0) return;
    setSendingFree(true);
    setSendMsg('');
    try {
      await api.sendNow(id, { text: freeText, targets: freeTargets });
      setSendMsg(`✅ Sent to ${freeTargets.join(', ')}`);
      setFreeText('');
    } catch (e: any) {
      setSendMsg(`❌ ${e.message}`);
    } finally { setSendingFree(false); }
  };

  const endShow = async () => {
    if (!id) return;
    if (!confirm('End this live show?')) return;
    setEnding(true);
    await api.endLiveEpisode(id).catch(() => {});
    navigate(`/live/episode/${id}`);
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-500" /></div>;
  if (!episode) return <div className="flex items-center justify-center min-h-screen text-muted">Episode not found.</div>;

  const activeRequests = requests.filter(r => !r.resolved);
  const currentSl = slides[currentSlide];

  return (
    <div className="h-screen flex flex-col bg-theme overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-red-700 text-white shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">🔴 LIVE</span>
          <span className="text-sm font-medium opacity-90 truncate max-w-xs">{episode.title}</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to={`/live/episode/${id}`} className="text-xs opacity-75 hover:opacity-100 transition-opacity">
            ← Episode
          </Link>
          <button onClick={endShow} disabled={ending} className="bg-white text-red-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-red-50 transition-colors disabled:opacity-50">
            {ending ? '…' : 'End Show'}
          </button>
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Slides / Queue */}
        <div className="w-72 shrink-0 flex flex-col border-r border-theme overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-theme shrink-0">
            {(['slides', 'queue'] as const).map(tab => (
              <button key={tab} onClick={() => setLeftTab(tab)}
                className={`flex-1 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${leftTab === tab ? 'text-accent border-b-2 border-accent' : 'text-muted hover:text-theme'}`}>
                {tab === 'slides' ? '🎬 Slides' : '📋 Queue'}
              </button>
            ))}
          </div>

          {leftTab === 'slides' && (
            <>
              <div className="p-3 border-b border-theme shrink-0">
                <div className="flex gap-2">
                  <button onClick={prevSlide} className="flex-1 px-2 py-2 rounded-lg text-sm border border-theme text-muted hover:bg-surface-hover transition-colors">← Prev</button>
                  <button onClick={nextSlide} className="flex-1 px-2 py-2 rounded-lg text-sm theme-button-primary">Next →</button>
                </div>
                <div className="text-xs text-muted text-center mt-2">
                  {slides.length > 0 ? `Slide ${currentSlide + 1} / ${slides.length}` : 'No deck loaded'}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {slides.length === 0 && (
                  <div className="text-center text-muted text-xs py-8">No slide deck.<br />Build one in Episode settings.</div>
                )}
                {slides.map((slide, i) => (
                  <button key={slide.id} onClick={() => goToSlide(i)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors ${i === currentSlide ? 'bg-accent text-white' : 'hover:bg-surface-hover text-theme'}`}>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span>{SLIDE_TYPE_ICON[slide.type]}</span>
                      <span className="opacity-60 font-mono">{i + 1}</span>
                      <span className="capitalize opacity-70">{slide.type}</span>
                    </div>
                    <div className="truncate opacity-80">
                      {slide.text?.slice(0, 50) || slide.reference || slide.items?.[0] || ''}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {leftTab === 'queue' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Queue items */}
              <div className="flex-1 overflow-y-auto divide-y divide-theme">
                {queueItems.length === 0 && (
                  <div className="text-center text-muted text-xs py-8 px-3">
                    Queue empty.<br />
                    <Link to="/live/bible" className="text-accent underline">Browse Bible →</Link>
                  </div>
                )}
                {queueItems.map(item => (
                  <div key={item.id} className={`px-3 py-2 ${item.sent_at ? 'opacity-40' : ''}`}>
                    <div className="text-xs font-semibold text-accent mb-0.5 flex items-center justify-between">
                      <span className="truncate">{item.label}</span>
                      {item.sent_at && <span className="text-green-500 shrink-0 ml-1">✅</span>}
                    </div>
                    <p className="text-xs text-muted line-clamp-1 mb-1.5">{item.body}</p>
                    <div className="flex gap-1 flex-wrap">
                      {(['chat', 'lower_third', 'caption'] as LiveSendTarget[]).map(t => (
                        <button key={t} disabled={sendingQueueItem === item.id}
                          onClick={() => sendQueueItem(item, [t])}
                          className="px-1.5 py-0.5 text-xs rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 hover:bg-indigo-200 transition-colors disabled:opacity-40"
                          title={t.replace('_', ' ')}>
                          {TARGET_LABELS[t]}
                        </button>
                      ))}
                      <button disabled={sendingQueueItem === item.id}
                        onClick={() => sendQueueItem(item, ['chat', 'lower_third', 'caption'])}
                        className="px-1.5 py-0.5 text-xs rounded bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200 transition-colors disabled:opacity-40">
                        All
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Send msg */}
              {sendMsg && (
                <div className={`px-3 py-1.5 text-xs border-t border-theme ${sendMsg.startsWith('❌') ? 'text-red-500' : 'text-green-600'}`}>
                  {sendMsg}
                </div>
              )}

              {/* Freetext send */}
              <div className="p-3 border-t border-theme shrink-0 space-y-2">
                <textarea className="w-full theme-input rounded-lg px-2 py-1.5 text-xs resize-none" rows={2}
                  placeholder="Send anything now…"
                  value={freeText} onChange={e => setFreeText(e.target.value)} />
                <div className="flex gap-2 flex-wrap">
                  {(['chat', 'lower_third', 'caption'] as LiveSendTarget[]).map(t => (
                    <label key={t} className="flex items-center gap-1 text-xs cursor-pointer">
                      <input type="checkbox" checked={freeTargets.includes(t)}
                        onChange={() => setFreeTargets(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])} />
                      {TARGET_LABELS[t]}
                    </label>
                  ))}
                </div>
                <button onClick={sendFreeNow} disabled={sendingFree || !freeText.trim() || freeTargets.length === 0}
                  className="w-full py-1.5 text-xs rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-40">
                  {sendingFree ? 'Sending…' : '→ Send Now'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* CENTER — Current slide preview + stream embed */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Current slide display */}
          {currentSl && (
            <div className="p-4 border-b border-theme bg-surface shrink-0">
              <div className="max-w-lg mx-auto text-center">
                <div className="text-xs text-muted uppercase tracking-wider mb-1">{SLIDE_TYPE_ICON[currentSl.type]} {currentSl.type}</div>
                {currentSl.reference && <div className="text-xs text-accent mb-1">{currentSl.reference}</div>}
                <div className="text-theme font-semibold text-lg leading-snug">
                  {currentSl.text?.slice(0, 150) || currentSl.items?.join(' · ') || ''}
                </div>
              </div>
            </div>
          )}

          {/* Restream Studio embed / instructions */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 bg-surface text-center gap-4">
            <div className="text-5xl">📡</div>
            <div className="text-theme font-semibold text-lg">Restream Studio</div>
            <p className="text-muted text-sm max-w-sm">
              Your live stream is managed in Restream. Click below to open Restream Studio in a new tab — your guests join via the invite link.
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              <a
                href="https://restream.io/studio"
                target="_blank"
                rel="noreferrer"
                className="theme-button-primary px-6 py-3 rounded-xl text-sm font-bold"
              >
                Open Restream Studio ↗
              </a>
              <button
                onClick={goLiveRestream}
                disabled={goingLiveRestream}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
              >
                {goingLiveRestream ? '…' : '🔴 Enable All Channels'}
              </button>
            </div>

            {/* Channel status */}
            {streamChannels.length > 0 && (
              <div className="w-full max-w-sm mt-2">
                <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-2 text-left">Platform Status</div>
                <div className="space-y-1.5">
                  {streamChannels.map((ch: any) => (
                    <div key={ch.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-hover text-sm text-left">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${ch.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
                      <span className="flex-1 truncate text-theme">{ch.displayName || ch.name || ch.id}</span>
                      <span className="text-xs text-muted shrink-0">{ch.enabled ? 'Live' : 'Off'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(episode.guest_invite_url || episode.live_shows?.guest_invite_url) && (
              <div className="w-full max-w-sm">
                <div className="text-xs text-muted mb-1">Guest Invite Link</div>
                <div className="flex gap-2">
                  <input readOnly className="flex-1 theme-input rounded-lg px-3 py-1.5 text-xs" value={episode.guest_invite_url || episode.live_shows?.guest_invite_url || ''} />
                  <button onClick={() => navigator.clipboard.writeText(episode.guest_invite_url || episode.live_shows?.guest_invite_url || '')}
                    className="px-3 py-1.5 rounded-lg text-xs border border-theme text-muted hover:bg-surface-hover">
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Chat + requests */}
        <div className="w-72 shrink-0 flex flex-col border-l border-theme overflow-hidden">
          {/* Chat */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-theme flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold text-muted uppercase tracking-wider">Live Chat</span>
              <span className="text-xs text-muted">{chat.length} msgs</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {chat.length === 0 && (
                <div className="text-center text-muted text-xs py-6">
                  Chat messages will appear here.<br />
                  Configure Restream webhook to enable.
                </div>
              )}
              {chat.map(msg => (
                <div key={msg.id} className="group flex gap-2 hover:bg-surface-hover rounded-lg px-2 py-1.5">
                  <span className={`text-sm font-bold shrink-0 ${PLATFORM_COLOR[msg.platform] ?? ''}`} title={msg.platform}>
                    {PLATFORM_ICON[msg.platform] ?? '•'}
                  </span>
                  <div className="flex-1 min-w-0">
                    {msg.platform_user && <div className="text-xs font-semibold text-muted truncate">{msg.platform_user}</div>}
                    <div className="text-xs text-theme leading-relaxed">{msg.body}</div>
                  </div>
                  <button onClick={() => flagFromChat(msg)} title="Flag as prayer request" className="opacity-0 group-hover:opacity-100 text-amber-500 text-xs shrink-0 transition-opacity">
                    🙏
                  </button>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
          </div>

          {/* Manual flag input */}
          <div className="border-t border-theme p-2 shrink-0">
            <div className="flex gap-1 mb-1.5">
              {(['prayer', 'question', 'comment'] as const).map(t => (
                <button key={t} onClick={() => setFlagType(t)} className={`flex-1 text-xs py-1 rounded-md transition-colors capitalize ${flagType === t ? 'theme-button-primary' : 'border border-theme text-muted hover:bg-surface-hover'}`}>
                  {t}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              <input
                className="flex-1 theme-input rounded-lg px-2 py-1.5 text-xs"
                value={flagBody}
                onChange={e => setFlagBody(e.target.value)}
                placeholder={`Add ${flagType}…`}
                onKeyDown={e => { if (e.key === 'Enter') flagRequest(); }}
              />
              <button onClick={flagRequest} disabled={!flagBody.trim()} className="theme-button-primary px-2 py-1.5 rounded-lg text-xs disabled:opacity-40">+</button>
            </div>
          </div>

          {/* Prayer / requests panel */}
          {activeRequests.length > 0 && (
            <div className="border-t border-theme shrink-0 max-h-48 overflow-y-auto">
              <div className="px-3 py-2 text-xs font-semibold text-muted uppercase tracking-wider">
                Requests ({activeRequests.length})
              </div>
              {activeRequests.map(req => (
                <div key={req.id} className="flex items-start gap-2 px-3 py-2 border-t border-theme">
                  <span className="text-base shrink-0">{req.type === 'prayer' ? '🙏' : req.type === 'question' ? '❓' : '💬'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-theme leading-relaxed">{req.body}</div>
                  </div>
                  <button onClick={() => resolveRequest(req.id)} title="Mark resolved" className="text-green-500 text-xs shrink-0 hover:text-green-600">✓</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
