import { Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Club {
  id: string;
  name: string;
  visibility: 'public' | 'private';
  max_members: number;
}

interface Props {
  club: Club;
  onReload: () => void;
}

export default function ClassSettingsPanel({ club }: Props) {
  const navigate = useNavigate();

  return (
    <div className="max-w-lg">
      <div className="theme-section rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Settings className="h-5 w-5 text-muted" />
          <h2 className="font-semibold text-theme">Class Settings</h2>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Name</span>
            <span className="text-theme font-medium">{club.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Visibility</span>
            <span className="text-theme font-medium capitalize">{club.visibility}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Max Students</span>
            <span className="text-theme font-medium">{club.max_members}</span>
          </div>
        </div>

        <p className="text-xs text-muted mt-4">
          Full class settings (enrollment, invite links, book management) are available in the standard club settings.
        </p>

        <button
          onClick={() => navigate(`/clubs/${club.id}?tab=settings`)}
          className="theme-button-secondary px-4 py-2 rounded-lg text-sm w-full mt-2"
        >
          Open Full Settings
        </button>
      </div>
    </div>
  );
}
