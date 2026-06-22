import { MessageSquarePlus } from 'lucide-react';

interface Props {
  onClick: () => void;
}

export default function FeedbackButton({ onClick }: Props) {
  return (
    <button
      onClick={onClick}
      title="Send Feedback"
      className="relative p-2 text-muted hover:text-theme rounded-md transition-colors hover:bg-surface-hover"
    >
      <MessageSquarePlus className="h-5 w-5" />
    </button>
  );
}
