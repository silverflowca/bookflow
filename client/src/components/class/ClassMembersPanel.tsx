import { useState } from 'react';
import { Crown, Shield, UserPlus, GraduationCap, Copy, Check, MailX, ChevronDown } from 'lucide-react';
import api from '../../lib/api';
import ClassInviteModal from './ClassInviteModal';
import UserAvatar from '../profile/UserAvatar';

interface Member {
  id: string;
  role: string;
  user_id?: string;
  invite_accepted_at?: string;
  invited_email?: string;
  invite_token?: string;
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
  if (role === 'admin') return <span title="Teacher/Facilitator"><Shield className="h-3.5 w-3.5 text-blue-500" /></span>;
  return null;
}

function PendingRow({ member, clubId }: { member: Member; clubId: string; onRemoved?: () => void }) {
  const [token, setToken] = useState(member.invite_token ?? '');
  const [copied, setCopied] = useState(false);
  const [resending, setResending] = useState(false);

  const link = token ? `${window.location.origin}/clubs/accept/${token}` : '';

  async function resend() {
    setResending(true);
    try {
      const result = await api.resendClubInvite(clubId, member.id);
      setToken(result.invite_token);
    } catch { /* silent */ }
    finally { setResending(false); }
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="theme-section rounded-xl p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-full bg-strong/20 flex items-center justify-center flex-shrink-0">
        <MailX className="h-4 w-4 text-muted" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-theme truncate">{member.invited_email ?? 'Invited user'}</p>
        <p className="text-xs text-amber-500">
          Pending acceptance {member.role === 'admin' ? '· Teacher' : ''}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {link && (
          <button onClick={copyLink} className="text-xs flex items-center gap-1 text-muted hover:text-theme transition-colors">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
        )}
        <button onClick={resend} disabled={resending} className="text-xs text-muted hover:text-theme transition-colors disabled:opacity-50">
          {resending ? 'Resending...' : 'Resend'}
        </button>
      </div>
    </div>
  );
}

function MemberRow({
  member,
  clubId,
  canChangeRole,
  onRoleChanged,
}: {
  member: Member;
  clubId: string;
  canChangeRole: boolean;
  onRoleChanged: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [changing, setChanging] = useState(false);
  const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;

  async function setRole(role: 'admin' | 'member') {
    setChanging(true);
    setShowMenu(false);
    try {
      await api.updateClubMemberRole(clubId, member.id, role);
      onRoleChanged();
    } catch { /* silent */ }
    finally { setChanging(false); }
  }

  return (
    <div className="theme-section rounded-xl flex items-center gap-3 p-3">
      {profile?.id ? (
        <UserAvatar
          userId={profile.id}
          displayName={profile.display_name}
          avatarUrl={profile.avatar_url}
          size="lg"
          showName
          nameClassName="text-sm font-medium text-theme truncate"
          className="flex-1 min-w-0"
        />
      ) : (
        <>
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
            {(profile?.display_name ?? '?').charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-theme truncate">{profile?.display_name ?? 'Member'}</p>
          </div>
        </>
      )}
      <div className="flex items-center gap-1.5">
        <RoleBadge role={member.role} />
        {canChangeRole && member.role !== 'owner' ? (
          <div className="relative">
            <button
              onClick={() => setShowMenu(v => !v)}
              disabled={changing}
              className="flex items-center gap-1 text-xs text-muted hover:text-theme transition-colors disabled:opacity-50 px-2 py-1 rounded-lg hover:bg-strong/10"
            >
              <span className="capitalize">{member.role === 'admin' ? 'Teacher' : 'Student'}</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 theme-section rounded-xl shadow-lg border border-strong/20 z-10 overflow-hidden">
                <button
                  onClick={() => setRole('admin')}
                  disabled={member.role === 'admin'}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-strong/10 transition-colors flex items-center gap-2 disabled:opacity-40"
                >
                  <Shield className="h-3.5 w-3.5 text-blue-500" />
                  Make Teacher
                </button>
                <button
                  onClick={() => setRole('member')}
                  disabled={member.role === 'member'}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-strong/10 transition-colors flex items-center gap-2 disabled:opacity-40"
                >
                  <GraduationCap className="h-3.5 w-3.5 text-muted" />
                  Make Student
                </button>
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted capitalize">
            {member.role === 'admin' ? 'Teacher' : member.role === 'owner' ? 'Owner' : 'Student'}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ClassMembersPanel({ club, isTeacher, onReload }: Props) {
  const [showInviteStudent, setShowInviteStudent] = useState(false);
  const [showInviteTeacher, setShowInviteTeacher] = useState(false);

  const allMembers = club.members ?? [];
  const members = allMembers.filter(m => m.invite_accepted_at);
  const pending = allMembers.filter(m => !m.invite_accepted_at && m.invited_email);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-sm font-semibold text-muted uppercase tracking-wide">
          Class Members ({members.length})
        </h2>
        {isTeacher && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowInviteTeacher(true)}
              className="flex items-center gap-1.5 theme-button-secondary px-3 py-2 rounded-lg text-sm"
            >
              <Shield className="h-4 w-4 text-blue-500" /> Add Teacher
            </button>
            <button
              onClick={() => setShowInviteStudent(true)}
              className="flex items-center gap-1.5 theme-button-primary px-3 py-2 rounded-lg text-sm"
            >
              <UserPlus className="h-4 w-4" /> Add Student
            </button>
          </div>
        )}
      </div>

      {/* Members list */}
      {members.length === 0 ? (
        <div className="text-center py-8 text-muted">
          <p className="text-sm">No members enrolled yet.</p>
          {isTeacher && (
            <p className="text-xs mt-1">Use the buttons above to invite students or teachers.</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {members.map(m => (
            <MemberRow
              key={m.id}
              member={m}
              clubId={club.id}
              canChangeRole={isTeacher}
              onRoleChanged={onReload}
            />
          ))}
        </div>
      )}

      {/* Pending invites (teacher only) */}
      {isTeacher && pending.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">
            Pending Invites ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map(m => (
              <PendingRow key={m.id} member={m} clubId={club.id} onRemoved={onReload} />
            ))}
          </div>
        </div>
      )}

      {/* Add Student modal */}
      {showInviteStudent && (
        <ClassInviteModal
          clubId={club.id}
          clubName={club.name}
          inviteRole="member"
          onClose={() => setShowInviteStudent(false)}
          onAdded={() => { onReload(); }}
        />
      )}

      {/* Add Teacher modal */}
      {showInviteTeacher && (
        <ClassInviteModal
          clubId={club.id}
          clubName={club.name}
          inviteRole="admin"
          onClose={() => setShowInviteTeacher(false)}
          onAdded={() => { onReload(); }}
        />
      )}
    </div>
  );
}
