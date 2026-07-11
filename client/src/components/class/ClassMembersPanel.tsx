import { Crown, Shield } from 'lucide-react';

interface Member {
  id: string;
  role: string;
  user_id?: string;
  invite_accepted_at?: string;
  profile?: { id: string; display_name: string; avatar_url?: string };
}

interface Club {
  id: string;
  name: string;
  members?: Member[];
  member_count?: number;
}

interface Props {
  club: Club;
  isTeacher: boolean;
  onReload: () => void;
}

function RoleBadge({ role }: { role: string }) {
  if (role === 'owner') return <span title="Owner"><Crown className="h-3.5 w-3.5 text-yellow-500" /></span>;
  if (role === 'admin') return <span title="Admin"><Shield className="h-3.5 w-3.5 text-blue-500" /></span>;
  return null;
}

export default function ClassMembersPanel({ club }: Props) {
  const members = (club.members ?? []).filter(m => m.invite_accepted_at);

  return (
    <div>
      <h2 className="text-sm font-semibold text-muted uppercase tracking-wide mb-4">
        Class Members ({members.length})
      </h2>

      {members.length === 0 ? (
        <div className="text-center py-12 text-muted">
          <p>No members yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => {
            const profile = Array.isArray(m.profile) ? m.profile[0] : m.profile;
            return (
              <div key={m.id} className="theme-section rounded-xl flex items-center gap-3 p-3">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
                    : (profile?.display_name ?? '?').charAt(0).toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-theme truncate">{profile?.display_name ?? 'Member'}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <RoleBadge role={m.role} />
                  <span className="text-xs text-muted capitalize">{m.role}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
