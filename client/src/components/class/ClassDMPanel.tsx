import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import api from '../../lib/api';

interface Message {
  id: string;
  author_id: string;
  body: string;
  read_at?: string;
  created_at: string;
  author: { id: string; display_name: string; avatar_url?: string };
}

interface Props {
  clubId: string;
  currentUserId: string;
  otherUserId: string;
  otherName: string;
  otherAvatar?: string;
  onBack: () => void;
}

export default function ClassDMPanel({ clubId, currentUserId, otherUserId, otherName, otherAvatar, onBack }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getClassDMs(clubId, otherUserId)
      .then(msgs => { setMessages(msgs); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clubId, otherUserId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send() {
    if (!input.trim()) return;
    setSending(true);
    const text = input.trim();
    setInput('');
    try {
      const msg = await api.sendClassDM(clubId, otherUserId, text);
      setMessages(prev => [...prev, msg]);
    } catch {
      setInput(text); // restore on failure
    } finally {
      setSending(false);
    }
  }

  function groupDate(iso: string) {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  // Group messages by date
  const grouped: { date: string; msgs: Message[] }[] = [];
  for (const m of messages) {
    const d = groupDate(m.created_at);
    if (!grouped.length || grouped[grouped.length - 1].date !== d) {
      grouped.push({ date: d, msgs: [m] });
    } else {
      grouped[grouped.length - 1].msgs.push(m);
    }
  }

  return (
    <div className="flex flex-col h-[600px] max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b border-strong/20 flex-shrink-0">
        <button onClick={onBack} className="text-muted hover:text-theme transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden">
          {otherAvatar
            ? <img src={otherAvatar} alt="" className="w-full h-full object-cover" />
            : otherName.charAt(0)
          }
        </div>
        <div>
          <p className="font-semibold text-theme text-sm">{otherName}</p>
          <p className="text-xs text-muted">Private session</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-1">
        {loading && <p className="text-center text-muted text-sm py-4">Loading...</p>}
        {!loading && messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted text-sm">Start a private session with {otherName}.</p>
            <p className="text-muted text-xs mt-1">Messages are private between the two of you.</p>
          </div>
        )}
        {grouped.map(group => (
          <div key={group.date}>
            <div className="flex items-center gap-2 my-3">
              <div className="flex-1 h-px bg-strong/20" />
              <span className="text-xs text-muted">{group.date}</span>
              <div className="flex-1 h-px bg-strong/20" />
            </div>
            {group.msgs.map((m, i) => {
              const isMe = m.author_id === currentUserId;
              const showAvatar = !isMe && (i === 0 || group.msgs[i - 1]?.author_id !== m.author_id);
              return (
                <div key={m.id} className={`flex gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex-shrink-0 mt-0.5 ${showAvatar || isMe ? 'flex' : 'invisible'} items-center justify-center overflow-hidden`}>
                    {isMe ? (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white text-xs font-bold">
                        Me
                      </div>
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
                        {otherAvatar
                          ? <img src={otherAvatar} alt="" className="w-full h-full object-cover" />
                          : otherName.charAt(0)
                        }
                      </div>
                    )}
                  </div>
                  <div className={`max-w-[75%] group`}>
                    <div className={`rounded-2xl px-3 py-2 ${isMe ? 'bg-violet-600 text-white rounded-tr-sm' : 'bg-strong/10 text-theme rounded-tl-sm'}`}>
                      <p className="text-sm leading-relaxed">{m.body}</p>
                    </div>
                    <p className={`text-xs text-muted mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isMe ? 'text-right' : 'text-left'}`}>
                      {new Date(m.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 pt-3 border-t border-strong/20 flex-shrink-0">
        <input
          className="flex-1 theme-input rounded-xl px-4 py-2.5 text-sm"
          placeholder={`Message ${otherName}...`}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={sending}
          autoFocus
        />
        <button
          onClick={send}
          disabled={sending || !input.trim()}
          className="theme-button-primary px-4 py-2.5 rounded-xl disabled:opacity-50 flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
