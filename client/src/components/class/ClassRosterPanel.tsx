import { useEffect, useState } from 'react';
import { GraduationCap, MessageSquare } from 'lucide-react';
import api from '../../lib/api';
import type { ClassRosterEntry } from '../../types';
import ClassStudentDetailPanel from './ClassStudentDetailPanel';
import ClassDMPanel from './ClassDMPanel';

function SegmentedProgressBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-2 bg-strong/20 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted w-9 text-right">{pct}%</span>
    </div>
  );
}

function timeAgo(str?: string | null) {
  if (!str) return '—';
  const diff = Date.now() - new Date(str).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface Props {
  clubId: string;
  currentUserId: string;
}

export default function ClassRosterPanel({ clubId, currentUserId }: Props) {
  const [data, setData] = useState<{ members: ClassRosterEntry[]; chapters: { id: string; title: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'name' | 'progress' | 'last_active'>('progress');
  const [viewStudent, setViewStudent] = useState<{ id: string } | null>(null);
  const [dmStudent, setDmStudent] = useState<{ id: string; name: string; avatar?: string } | null>(null);

  useEffect(() => {
    api.getClassRoster(clubId)
      .then(d => setData(d))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [clubId]);

  if (loading) return (
    <div className="flex justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-strong" />
    </div>
  );

  // DM panel
  if (dmStudent) {
    return (
      <ClassDMPanel
        clubId={clubId}
        currentUserId={currentUserId}
        otherUserId={dmStudent.id}
        otherName={dmStudent.name}
        otherAvatar={dmStudent.avatar}
        onBack={() => setDmStudent(null)}
      />
    );
  }

  // Student detail panel
  if (viewStudent) {
    return (
      <ClassStudentDetailPanel
        clubId={clubId}
        studentId={viewStudent.id}
        currentUserId={currentUserId}
        onBack={() => setViewStudent(null)}
        onOpenDM={(id, name) => { setViewStudent(null); setDmStudent({ id, name }); }}
      />
    );
  }

  if (!data || data.members.length === 0) return (
    <div className="text-center py-16 theme-section border-dashed rounded-xl">
      <GraduationCap className="h-12 w-12 text-muted mx-auto mb-4" />
      <h3 className="font-semibold text-theme mb-2">No students enrolled yet</h3>
      <p className="text-muted text-sm">Invite students to your class to see their progress here.</p>
    </div>
  );

  const sorted = [...data.members].sort((a, b) => {
    if (sortBy === 'progress') return b.completion_pct - a.completion_pct;
    if (sortBy === 'last_active') return (b.last_active ?? '').localeCompare(a.last_active ?? '');
    return a.display_name.localeCompare(b.display_name);
  });

  return (
    <div>
      {/* Sort controls */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        <span className="text-muted">Sort:</span>
        {(['progress', 'last_active', 'name'] as const).map(s => (
          <button
            key={s}
            onClick={() => setSortBy(s)}
            className={`px-2 py-1 rounded ${sortBy === s ? 'theme-button-primary' : 'text-muted hover:text-theme'}`}
          >
            {s === 'last_active' ? 'Last Active' : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {sorted.map(member => (
          <div key={member.user_id} className="theme-section rounded-xl overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              {/* Avatar */}
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                {member.avatar_url
                  ? <img src={member.avatar_url} alt={member.display_name} className="w-full h-full object-cover" />
                  : member.display_name.charAt(0).toUpperCase()
                }
              </div>

              {/* Name — clickable to drill in */}
              <button
                className="w-32 flex-shrink-0 text-left"
                onClick={() => setViewStudent({ id: member.user_id })}
              >
                <p className="text-sm font-medium text-theme truncate hover:text-violet-500 transition-colors">{member.display_name}</p>
                <p className="text-xs text-muted">{member.role}</p>
              </button>

              {/* Progress bar */}
              <div className="flex-1 min-w-0">
                <SegmentedProgressBar pct={member.completion_pct} />
              </div>

              {/* Submissions */}
              <div className="hidden sm:flex flex-col items-end flex-shrink-0 w-24">
                <span className="text-xs text-theme">{member.submissions_submitted + member.submissions_graded} submitted</span>
                <span className="text-xs text-muted">{member.submissions_graded} graded</span>
              </div>

              {/* Last active */}
              <div className="hidden md:block text-xs text-muted flex-shrink-0 w-20 text-right">
                {timeAgo(member.last_active)}
              </div>

              {/* DM button */}
              <button
                onClick={() => setDmStudent({ id: member.user_id, name: member.display_name, avatar: member.avatar_url ?? undefined })}
                className="text-muted hover:text-violet-500 transition-colors flex-shrink-0"
                title="Send private message"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
