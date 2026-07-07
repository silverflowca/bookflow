import { useEffect, useState } from 'react';
import { PenLine, ChevronDown, ChevronRight, User } from 'lucide-react';
import api from '../../lib/api';
import type { SignatureResponse } from '../../types';

interface SignatureBlock {
  content_id: string;
  label: string;
  chapter_title: string;
  anchor_text?: string;
  total: number;
  responses: SignatureResponse[];
}

const SIG_TYPE_LABEL: Record<string, string> = {
  drawn: 'Drawn',
  typed: 'Typed',
  checkbox: 'Agreed',
};

export default function SignatureStatusTab({ bookId }: { bookId: string }) {
  const [blocks, setBlocks] = useState<SignatureBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    api.getBookSignatures(bookId)
      .then(data => { setBlocks(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [bookId]);

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  if (loading) {
    return (
      <div className="py-6 text-center text-muted text-sm">Loading signature data…</div>
    );
  }

  if (error) {
    return (
      <div className="py-4 px-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
        Failed to load signatures: {error}
      </div>
    );
  }

  if (blocks.length === 0) {
    return (
      <div className="py-8 text-center">
        <PenLine className="h-8 w-8 text-muted mx-auto mb-3 opacity-40" />
        <p className="text-sm text-muted">No signature blocks added yet.</p>
        <p className="text-xs text-muted mt-1 opacity-70">
          Add a Signature component in the chapter editor to start collecting signatures.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {blocks.map(block => (
        <div key={block.content_id} className="border border-theme rounded-lg overflow-hidden">
          {/* Block header */}
          <button
            type="button"
            onClick={() => toggle(block.content_id)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-hover transition-colors"
          >
            <PenLine className="h-4 w-4 text-purple-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-theme truncate">{block.label}</p>
              <p className="text-xs text-muted truncate">{block.chapter_title}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                block.total > 0 ? 'bg-green-100 text-green-700' : 'bg-surface-hover text-muted'
              }`}>
                {block.total} signed
              </span>
              {expanded[block.content_id]
                ? <ChevronDown className="h-4 w-4 text-muted" />
                : <ChevronRight className="h-4 w-4 text-muted" />
              }
            </div>
          </button>

          {/* Expanded responses */}
          {expanded[block.content_id] && (
            <div className="border-t border-theme divide-y divide-[var(--color-border)]">
              {block.responses.length === 0 ? (
                <p className="px-4 py-3 text-sm text-muted">No signatures yet.</p>
              ) : (
                block.responses.map(r => (
                  <div key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="h-7 w-7 rounded-full bg-surface-hover flex items-center justify-center shrink-0">
                      {r.user?.avatar_url
                        ? <img src={r.user.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                        : <User className="h-3.5 w-3.5 text-muted" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-theme truncate">
                        {r.user?.display_name || r.signer_name || 'Reader'}
                      </p>
                      <p className="text-xs text-muted">
                        {SIG_TYPE_LABEL[r.signature_type] || r.signature_type}
                      </p>
                    </div>
                    <span className="text-xs text-muted shrink-0">
                      {new Date(r.agreed_at).toLocaleDateString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
