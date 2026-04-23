import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../lib/api';
import type { LiveQueueItem, LiveQueueGroup, LiveSendTarget } from '../../types';

const TARGET_LABELS: Record<string, string> = {
  chat: '💬 Chat',
  lower_third: '📺 Lower Third',
  caption: '🔤 Caption',
};

const TARGETS: LiveSendTarget[] = ['chat', 'lower_third', 'caption'];

function SendRow({ item, onSent }: { item: LiveQueueItem; onSent: (id: string, targets: string[]) => void }) {
  const [sending, setSending] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const send = async (targets: LiveSendTarget[]) => {
    setSending(targets.join(','));
    setMsg('');
    try {
      await api.sendQueueItem(item.id, targets);
      setMsg(`✅ Sent to ${targets.map(t => TARGET_LABELS[t]).join(', ')}`);
      onSent(item.id, targets);
    } catch (e: any) {
      setMsg(`❌ ${e.message}`);
    } finally { setSending(null); }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-1 flex-wrap">
        {TARGETS.map(t => (
          <button key={t} disabled={!!sending}
            onClick={() => send([t])}
            className="px-2.5 py-1 text-xs rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 hover:bg-indigo-200 transition-colors disabled:opacity-40">
            {sending === t ? '…' : TARGET_LABELS[t]}
          </button>
        ))}
        <button disabled={!!sending}
          onClick={() => send(TARGETS)}
          className="px-2.5 py-1 text-xs rounded-md bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 hover:bg-red-200 transition-colors disabled:opacity-40">
          {sending === TARGETS.join(',') ? '…' : 'All 3 ↑'}
        </button>
      </div>
      {msg && <p className={`text-xs ${msg.startsWith('❌') ? 'text-red-500' : 'text-green-600'}`}>{msg}</p>}
    </div>
  );
}

export default function LiveQueue() {
  const { id } = useParams<{ id: string }>();
  const [groups, setGroups] = useState<LiveQueueGroup[]>([]);
  const [items, setItems] = useState<LiveQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [episodeTitle, setEpisodeTitle] = useState('');

  // New group form
  const [newGroupLabel, setNewGroupLabel] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);

  // Custom item form
  const [customLabel, setCustomLabel] = useState('');
  const [customBody, setCustomBody] = useState('');
  const [customGroupId, setCustomGroupId] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Send now freetext
  const [freeText, setFreeText] = useState('');
  const [freeTargets, setFreeTargets] = useState<LiveSendTarget[]>(['chat']);
  const [sendingFree, setSendingFree] = useState(false);
  const [freeMsg, setFreeMsg] = useState('');

  useEffect(() => {
    if (!id) return;
    api.getLiveEpisode(id).then(r => setEpisodeTitle(r.episode?.title || '')).catch(() => {});
    load();
  }, [id]);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const r = await api.getQueue(id);
      setGroups(r.groups || []);
      setItems(r.items || []);
    } finally { setLoading(false); }
  };

  const addGroup = async () => {
    if (!newGroupLabel.trim() || !id) return;
    setAddingGroup(true);
    try {
      const g = await api.createQueueGroup(id, newGroupLabel.trim(), groups.length);
      setGroups(prev => [...prev, g]);
      setNewGroupLabel('');
    } finally { setAddingGroup(false); }
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm('Delete this group? Items will be ungrouped.')) return;
    await api.deleteQueueGroup(groupId);
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setItems(prev => prev.map(i => i.group_id === groupId ? { ...i, group_id: null } : i));
  };

  const addCustomItem = async () => {
    if (!customLabel.trim() || !customBody.trim() || !id) return;
    setAddingItem(true);
    try {
      const item = await api.addQueueItem(id, {
        type: 'custom',
        label: customLabel.trim(),
        body: customBody.trim(),
        group_id: customGroupId || undefined,
      });
      setItems(prev => [...prev, item]);
      setCustomLabel('');
      setCustomBody('');
    } finally { setAddingItem(false); }
  };

  const deleteItem = async (itemId: string) => {
    await api.deleteQueueItem(itemId);
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const markSent = (itemId: string, targets: string[]) => {
    setItems(prev => prev.map(i => i.id === itemId
      ? { ...i, sent_at: new Date().toISOString(), sent_targets: targets as LiveSendTarget[] }
      : i));
  };

  const sendFree = async () => {
    if (!freeText.trim() || !id || freeTargets.length === 0) return;
    setSendingFree(true);
    setFreeMsg('');
    try {
      await api.sendNow(id, { text: freeText, targets: freeTargets });
      setFreeMsg(`✅ Sent to ${freeTargets.map(t => TARGET_LABELS[t]).join(', ')}`);
      setFreeText('');
    } catch (e: any) {
      setFreeMsg(`❌ ${e.message}`);
    } finally { setSendingFree(false); }
  };

  const toggleFreeTarget = (t: LiveSendTarget) => {
    setFreeTargets(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  // Group items by group_id
  const ungrouped = items.filter(i => !i.group_id);
  const byGroup = (gid: string) => items.filter(i => i.group_id === gid);

  if (loading) return <div className="flex items-center justify-center min-h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link to="/live" className="hover:text-theme">Live Shows</Link>
        <span>/</span>
        {id && <Link to={`/live/episode/${id}`} className="hover:text-theme">{episodeTitle || 'Episode'}</Link>}
        <span>/</span>
        <span className="text-theme font-medium">Queue</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-theme">📋 Live Queue</h1>
        <div className="flex gap-2">
          <Link to="/live/bible" className="px-3 py-2 text-sm rounded-lg border border-theme text-muted hover:bg-surface-hover transition-colors">
            ✝️ Bible Browser
          </Link>
          {id && (
            <Link to={`/live/episode/${id}/dashboard`} className="px-3 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors">
              🔴 Control Room
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Queue */}
        <div className="lg:col-span-2 space-y-4">

          {/* Groups */}
          {groups.map(g => (
            <div key={g.id} className="theme-card rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 bg-surface-hover border-b border-theme">
                <span className="text-sm font-semibold text-theme">📁 {g.label}</span>
                <button onClick={() => deleteGroup(g.id)} className="text-xs text-muted hover:text-red-500 transition-colors">✕</button>
              </div>
              <div className="divide-y divide-theme">
                {byGroup(g.id).length === 0 && (
                  <p className="px-4 py-3 text-xs text-muted italic">No items — add from Bible browser or below</p>
                )}
                {byGroup(g.id).map(item => (
                  <QueueItemRow key={item.id} item={item} onDelete={deleteItem} onSent={markSent} />
                ))}
              </div>
            </div>
          ))}

          {/* Ungrouped */}
          {ungrouped.length > 0 && (
            <div className="theme-card rounded-xl overflow-hidden">
              {groups.length > 0 && (
                <div className="px-4 py-2.5 bg-surface-hover border-b border-theme">
                  <span className="text-sm font-semibold text-muted">Ungrouped</span>
                </div>
              )}
              <div className="divide-y divide-theme">
                {ungrouped.map(item => (
                  <QueueItemRow key={item.id} item={item} onDelete={deleteItem} onSent={markSent} />
                ))}
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="theme-card rounded-xl p-8 text-center text-muted">
              <div className="text-4xl mb-3">📋</div>
              <div className="font-medium mb-1">Queue is empty</div>
              <div className="text-sm">Browse the Bible or add custom items →</div>
            </div>
          )}
        </div>

        {/* Right — Add items + Send now */}
        <div className="space-y-4">
          {/* Add Group */}
          <div className="theme-card rounded-xl p-4">
            <h3 className="font-semibold text-theme text-sm mb-3">+ Add Group</h3>
            <input className="w-full theme-input rounded-lg px-3 py-2 text-sm mb-2"
              placeholder="e.g. Opening, Step 4 Verses, Closing"
              value={newGroupLabel}
              onChange={e => setNewGroupLabel(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addGroup()} />
            <button onClick={addGroup} disabled={addingGroup || !newGroupLabel.trim()}
              className="w-full px-3 py-2 text-sm rounded-lg theme-button-primary disabled:opacity-40">
              {addingGroup ? 'Adding…' : 'Add Group'}
            </button>
          </div>

          {/* Add Custom Item */}
          <div className="theme-card rounded-xl p-4">
            <h3 className="font-semibold text-theme text-sm mb-3">+ Custom Item</h3>
            <div className="space-y-2">
              <input className="w-full theme-input rounded-lg px-3 py-2 text-sm"
                placeholder="Label (e.g. Step 4 Opening)"
                value={customLabel} onChange={e => setCustomLabel(e.target.value)} />
              <textarea className="w-full theme-input rounded-lg px-3 py-2 text-sm resize-none" rows={3}
                placeholder="Text to send…"
                value={customBody} onChange={e => setCustomBody(e.target.value)} />
              {groups.length > 0 && (
                <select className="w-full theme-input rounded-lg px-3 py-2 text-sm"
                  value={customGroupId} onChange={e => setCustomGroupId(e.target.value)}>
                  <option value="">No group</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
                </select>
              )}
              <button onClick={addCustomItem} disabled={addingItem || !customLabel.trim() || !customBody.trim()}
                className="w-full px-3 py-2 text-sm rounded-lg theme-button-primary disabled:opacity-40">
                {addingItem ? 'Adding…' : '+ Add to Queue'}
              </button>
            </div>
          </div>

          {/* Send Now (freetext) */}
          <div className="theme-card rounded-xl p-4">
            <h3 className="font-semibold text-theme text-sm mb-3">⚡ Send Now</h3>
            <textarea className="w-full theme-input rounded-lg px-3 py-2 text-sm resize-none mb-2" rows={3}
              placeholder="Type anything to send instantly…"
              value={freeText} onChange={e => setFreeText(e.target.value)} />
            <div className="flex gap-2 mb-2 flex-wrap">
              {TARGETS.map(t => (
                <label key={t} className="flex items-center gap-1 text-xs cursor-pointer">
                  <input type="checkbox" checked={freeTargets.includes(t)} onChange={() => toggleFreeTarget(t)} />
                  {TARGET_LABELS[t]}
                </label>
              ))}
            </div>
            <button onClick={sendFree} disabled={sendingFree || !freeText.trim() || freeTargets.length === 0}
              className="w-full px-3 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-40">
              {sendingFree ? 'Sending…' : '→ Send Now'}
            </button>
            {freeMsg && <p className={`text-xs mt-2 ${freeMsg.startsWith('❌') ? 'text-red-500' : 'text-green-600'}`}>{freeMsg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function QueueItemRow({ item, onDelete, onSent }: {
  item: LiveQueueItem;
  onDelete: (id: string) => void;
  onSent: (id: string, targets: string[]) => void;
}) {
  const isSent = !!item.sent_at;

  return (
    <div className={`px-4 py-3 ${isSent ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-xs font-semibold text-accent">{item.label}</span>
            {isSent && (
              <span className="text-xs text-green-600 dark:text-green-400">
                ✅ sent to {item.sent_targets?.map(t => TARGET_LABELS[t]).join(', ')}
              </span>
            )}
          </div>
          <p className="text-sm text-theme line-clamp-2">{item.body}</p>
        </div>
        <button onClick={() => onDelete(item.id)}
          className="text-xs text-muted hover:text-red-500 transition-colors shrink-0 mt-0.5">✕</button>
      </div>
      <SendRow item={item} onSent={onSent} />
    </div>
  );
}
