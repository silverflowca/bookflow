import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import api from '../lib/api';

export default function BookPrintPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [html, setHtml] = useState<string | null>(null);
  const [title, setTitle] = useState('book');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Options passed via navigation state from BookEditor
  const options: Record<string, boolean> = (location.state as any)?.options ?? {};

  useEffect(() => {
    if (!bookId) return;
    api.exportPdf(bookId, options)
      .then((res: any) => {
        setHtml(res.html);
        setTitle(res.title || 'book');
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [bookId]);

  // Write HTML into iframe once loaded
  useEffect(() => {
    if (!html || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [html]);

  function handlePrint() {
    iframeRef.current?.contentWindow?.print();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-muted text-sm">Building PDF preview…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface">
        <div className="text-center max-w-sm">
          <p className="text-red-500 font-medium mb-2">Failed to load preview</p>
          <p className="text-muted text-sm mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-sm rounded-lg border border-theme text-theme hover:bg-surface-hover"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface border-b border-theme flex-shrink-0 shadow-sm">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted hover:text-theme transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to editor
        </button>

        <div className="flex-1 text-center">
          <span className="text-sm font-medium text-theme truncate">{title}</span>
        </div>

        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--color-accent)' }}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
          Print / Save as PDF
        </button>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          title="PDF Preview"
          className="w-full h-full border-0 bg-white"
          sandbox="allow-same-origin allow-modals"
        />
      </div>
    </div>
  );
}
