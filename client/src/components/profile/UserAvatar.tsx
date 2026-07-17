import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MemberProfilePopup from './MemberProfilePopup';

interface Props {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
  /** Visual size of the avatar circle */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Show display name next to the avatar */
  showName?: boolean;
  /** Hide the avatar circle and only show the name (for name-only clickable triggers) */
  hideAvatar?: boolean;
  /** Extra class on the outer wrapper button */
  className?: string;
  /** Class applied to the name span */
  nameClassName?: string;
}

const SIZE_MAP = {
  xs: 'w-5 h-5 text-[9px]',
  sm: 'w-7 h-7 text-xs',
  md: 'w-8 h-8 text-sm',
  lg: 'w-10 h-10 text-base',
};

/**
 * Drop-in avatar (+ optional name) that opens a MemberProfilePopup on click.
 * Use this everywhere a user avatar or name is displayed.
 */
export default function UserAvatar({
  userId,
  displayName,
  avatarUrl,
  size = 'md',
  showName = false,
  hideAvatar = false,
  className = '',
  nameClassName = '',
}: Props) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const initial = displayName?.[0]?.toUpperCase() || '?';

  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(v => !v);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        className={`inline-flex items-center gap-1.5 cursor-pointer group select-none bg-transparent border-0 p-0 ${className}`}
        aria-label={`View ${displayName}'s profile`}
      >
        {/* Avatar circle */}
        {!hideAvatar && (
          <span className={`${SIZE_MAP[size]} rounded-full bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden group-hover:ring-2 group-hover:ring-violet-400 group-hover:ring-offset-1 transition-all`}>
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              : initial
            }
          </span>
        )}

        {/* Optional name */}
        {showName && (
          <span className={`group-hover:text-violet-600 transition-colors ${nameClassName}`}>
            {displayName}
          </span>
        )}
      </button>

      {open && createPortal(
        <MemberProfilePopup
          userId={userId}
          anchorRef={triggerRef}
          onClose={() => setOpen(false)}
        />,
        document.body,
      )}
    </>
  );
}
