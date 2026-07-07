import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquarePlus, Inbox } from 'lucide-react';

interface Props {
  onClick: () => void;
}

export default function FeedbackButton({ onClick }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        title="Feedback"
        className="relative p-2 text-muted hover:text-theme rounded-md transition-colors hover:bg-surface-hover"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute right-0 mt-1 w-48 bg-surface border-2 border-strong rounded-xl shadow-xl z-50 overflow-hidden">
          <button
            onClick={() => { setOpen(false); onClick(); }}
            className="flex items-center gap-2.5 w-full px-4 py-3 text-sm font-medium text-theme hover:bg-surface-hover transition-colors"
          >
            <MessageSquarePlus className="h-4 w-4 text-accent flex-shrink-0" />
            Submit Feedback
          </button>
          <Link
            to="/my-feedback"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-theme hover:bg-surface-hover transition-colors border-t border-theme"
          >
            <Inbox className="h-4 w-4 text-accent flex-shrink-0" />
            My Feedback
          </Link>
        </div>
      )}
    </div>
  );
}
