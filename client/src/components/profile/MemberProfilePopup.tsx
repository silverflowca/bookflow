import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Globe, BookOpen, Users, BookMarked, MessageCircle, ExternalLink } from 'lucide-react';
import api from '../../lib/api';

interface ProfileData {
  profile: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    bio: string | null;
    is_author: boolean;
    website_url: string | null;
    location: string | null;
    profile_public: boolean;
    created_at: string;
  };
  stats: {
    total_read: number;
    clubs_count: number;
    books_authored: number;
  } | null;
  is_private?: boolean;
}

interface Props {
  userId: string;
  /** Anchor element the popup positions relative to */
  anchorRef: React.RefObject<HTMLElement | null>;
  onClose: () => void;
}

/** Position preference — we auto-flip if not enough room */
function getPopupStyle(anchor: HTMLElement): React.CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const popupW = 288; // w-72
  const popupH = 280; // approx

  let top = rect.bottom + 8;
  let left = rect.left;

  if (left + popupW > vw - 8) left = vw - popupW - 8;
  if (left < 8) left = 8;
  if (top + popupH > vh - 8) top = rect.top - popupH - 8;

  return { position: 'fixed', top, left, zIndex: 9999 };
}

export default function MemberProfilePopup({ userId, anchorRef, onClose }: Props) {
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getPublicProfile(userId)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [userId]);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (
        popupRef.current && !popupRef.current.contains(target) &&
        anchorRef.current && !anchorRef.current.contains(target)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const style = anchorRef.current ? getPopupStyle(anchorRef.current) : { position: 'fixed' as const, top: 100, left: 100, zIndex: 9999 };

  return (
    <div
      ref={popupRef}
      style={style}
      className="w-72 theme-modal rounded-2xl shadow-2xl border border-strong/10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150"
    >
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="h-6 w-6 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
        </div>
      ) : !data ? (
        <div className="p-5 text-sm text-muted text-center">Profile not found</div>
      ) : data.is_private ? (
        <PrivateProfile profile={data.profile} />
      ) : (
        <PublicProfile data={data} onClose={onClose} />
      )}
    </div>
  );
}

function Avatar({ profile, size = 'md' }: { profile: ProfileData['profile']; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'w-16 h-16 text-2xl' : size === 'md' ? 'w-12 h-12 text-lg' : 'w-8 h-8 text-sm';
  const initials = profile.display_name?.[0]?.toUpperCase() || '?';
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden`}>
      {profile.avatar_url
        ? <img src={profile.avatar_url} alt={profile.display_name} className="w-full h-full object-cover" />
        : initials
      }
    </div>
  );
}

function PrivateProfile({ profile }: { profile: ProfileData['profile'] }) {
  return (
    <div className="p-5">
      <div className="flex items-center gap-3 mb-3">
        <Avatar profile={profile} />
        <div>
          <p className="font-semibold text-theme">{profile.display_name}</p>
          <p className="text-xs text-muted mt-0.5">Private profile</p>
        </div>
      </div>
      <p className="text-xs text-muted">This member keeps their profile private.</p>
    </div>
  );
}

function PublicProfile({ data, onClose }: { data: ProfileData; onClose: () => void }) {
  const { profile, stats } = data;
  const joined = new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

  return (
    <>
      {/* Header banner */}
      <div className="h-12 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

      <div className="px-4 pb-4">
        {/* Avatar overlapping banner */}
        <div className="-mt-7 mb-3 flex items-end justify-between">
          <div className="ring-4 ring-white dark:ring-gray-900 rounded-full">
            <Avatar profile={profile} size="lg" />
          </div>
          {profile.is_author && (
            <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
              Author
            </span>
          )}
        </div>

        {/* Name + meta */}
        <p className="font-semibold text-theme text-base leading-tight">{profile.display_name}</p>
        <p className="text-xs text-muted mt-0.5">Joined {joined}</p>

        {profile.bio && (
          <p className="text-xs text-theme/80 mt-2 line-clamp-2">{profile.bio}</p>
        )}

        {(profile.location || profile.website_url) && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            {profile.location && (
              <span className="flex items-center gap-1 text-xs text-muted">
                <MapPin className="h-3 w-3" /> {profile.location}
              </span>
            )}
            {profile.website_url && (
              <a
                href={profile.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-violet-500 hover:text-violet-600"
                onClick={e => e.stopPropagation()}
              >
                <Globe className="h-3 w-3" /> Website
              </a>
            )}
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div className="flex gap-3 mt-3 pt-3 border-t border-strong/10">
            {stats.total_read > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted">
                <BookMarked className="h-3.5 w-3.5 text-violet-400" />
                <span className="font-semibold text-theme">{stats.total_read}</span> read
              </div>
            )}
            {stats.clubs_count > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted">
                <Users className="h-3.5 w-3.5 text-indigo-400" />
                <span className="font-semibold text-theme">{stats.clubs_count}</span> clubs
              </div>
            )}
            {stats.books_authored > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted">
                <BookOpen className="h-3.5 w-3.5 text-amber-400" />
                <span className="font-semibold text-theme">{stats.books_authored}</span> authored
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <Link
            to={`/profile/${profile.id}`}
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium theme-button-primary px-3 py-2 rounded-xl"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View profile
          </Link>
          {/* Message button placeholder — wired up when DMs are built */}
          <button
            disabled
            title="Direct messaging coming soon"
            className="flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-strong/5 text-muted cursor-not-allowed opacity-50"
          >
            <MessageCircle className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}
