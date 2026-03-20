import { Link } from 'react-router-dom';
import { Users } from 'lucide-react';
import type { BookCollaborator } from '../../types';

interface CollaboratorBadgesProps {
  collaborators: BookCollaborator[];
  bookId: string;
  max?: number;
}

const ROLE_COLORS: Record<string, string> = {
  author: 'bg-blue-100 text-blue-700 border-blue-200',
  editor: 'bg-green-100 text-green-700 border-green-200',
  reviewer: 'bg-yellow-100 text-yellow-700 border-yellow-200',
};

export default function CollaboratorBadges({ collaborators, bookId, max = 4 }: CollaboratorBadgesProps) {
  const active = collaborators.filter(c => c.invite_accepted_at);
  const visible = active.slice(0, max);
  const overflow = active.length - max;

  if (active.length === 0) return null;

  return (
    <Link
      to={`/edit/book/${bookId}/collaborators`}
      className="flex items-center gap-1.5 text-muted hover:text-theme transition-colors group"
      title={`${active.length} collaborator${active.length !== 1 ? 's' : ''}`}
    >
      <div className="flex -space-x-2">
        {visible.map(collab => (
          <div
            key={collab.id}
            className={`h-7 w-7 rounded-full border-2 border-surface flex items-center justify-center text-xs font-semibold ${
              ROLE_COLORS[collab.role] || 'bg-surface-hover text-muted border-theme'
            }`}
            title={`${collab.user?.display_name || collab.invited_email || 'Unknown'} (${collab.role})`}
          >
            {(collab.user?.display_name || collab.invited_email || '?')[0].toUpperCase()}
          </div>
        ))}
        {overflow > 0 && (
          <div className="h-7 w-7 rounded-full border-2 border-surface bg-surface-hover flex items-center justify-center text-xs font-semibold text-muted">
            +{overflow}
          </div>
        )}
      </div>
      <Users className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity ml-0.5" />
    </Link>
  );
}
