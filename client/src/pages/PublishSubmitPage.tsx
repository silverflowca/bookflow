import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Send, Package, Clock, CheckCircle, XCircle, AlertCircle, Loader2, Trash2, ExternalLink } from 'lucide-react';
import api from '../lib/api';

type Tab = 'package' | 'direct' | 'history';
type Platform = 'draft2digital' | 'smashwords';

interface Submission {
  id: string;
  platform: string;
  status: string;
  submission_id?: string;
  publisher_url?: string;
  submitted_at: string;
  metadata?: Record<string, unknown>;
}

const STATUS_ICON: Record<string, JSX.Element> = {
  submitted: <Clock size={14} className="text-blue-500" />,
  processing: <Loader2 size={14} className="text-yellow-500 animate-spin" />,
  published: <CheckCircle size={14} className="text-green-500" />,
  failed: <XCircle size={14} className="text-red-500" />,
  pending: <AlertCircle size={14} className="text-gray-400" />,
  cancelled: <XCircle size={14} className="text-gray-400" />,
};

export default function PublishSubmitPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const [tab, setTab] = useState<Tab>('package');
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Package form
  const [genres, setGenres] = useState('');
  const [isbn, setIsbn] = useState('');

  // Direct submit forms
  const [platform, setPlatform] = useState<Platform>('draft2digital');
  const [apiToken, setApiToken] = useState('');
  const [price, setPrice] = useState('0');

  useEffect(() => {
    if (!bookId) return;
    Promise.all([
      api.getPublisherMetadata(bookId).then(setMetadata).catch(() => {}),
      api.getSubmissions(bookId).then(setSubmissions).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [bookId]);

  async function handleGeneratePackage() {
    if (!bookId) return;
    setWorking(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await api.exportSubmissionPackage(bookId, {
        genres: genres.split(',').map(g => g.trim()).filter(Boolean),
        isbn: isbn.trim() || undefined,
      });
      if (result?.download_url) {
        window.open(result.download_url, '_blank');
        setSuccess('Submission package generated and saved to FileFlow. Download started.');
      } else {
        setSuccess('Package generated — check your downloads.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate package');
    } finally {
      setWorking(false);
    }
  }

  async function handleDirectSubmit() {
    if (!bookId || !apiToken.trim()) return;
    setWorking(true);
    setError(null);
    setSuccess(null);
    try {
      const genreList = genres.split(',').map(g => g.trim()).filter(Boolean);
      const data = { api_token: apiToken.trim(), genres: genreList, isbn: isbn.trim() || undefined, price: parseFloat(price) || 0 };
      const result = platform === 'draft2digital'
        ? await api.submitToDraft2Digital(bookId, data)
        : await api.submitToSmashwords(bookId, data);

      setSuccess(`Submitted to ${platform === 'draft2digital' ? 'Draft2Digital' : 'Smashwords'} successfully!`);
      setSubmissions(prev => [result.submission, ...prev]);
      setApiToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setWorking(false);
    }
  }

  async function handleDeleteSubmission(submissionId: string) {
    if (!bookId) return;
    await api.deleteSubmission(bookId, submissionId).catch(() => {});
    setSubmissions(prev => prev.filter(s => s.id !== submissionId));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to={`/edit/book/${bookId}`} className="text-muted hover:text-primary">
          <ChevronLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Publish to Stores</h1>
          {metadata && <p className="text-sm text-muted">{String(metadata.title || '')}</p>}
        </div>
      </div>

      {/* Metadata summary */}
      {metadata && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6 text-sm grid grid-cols-2 gap-2">
          <div><span className="text-muted">Author:</span> <strong>{String(metadata.author_name || '—')}</strong></div>
          <div><span className="text-muted">Words:</span> <strong>{Number(metadata.word_count || 0).toLocaleString()}</strong></div>
          <div><span className="text-muted">Chapters:</span> <strong>{String(metadata.chapter_count || 0)}</strong></div>
          <div><span className="text-muted">Language:</span> <strong>{String(metadata.language || 'en')}</strong></div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {([['package', 'Download Package', Package], ['direct', 'Direct Submit', Send], ['history', 'History', Clock]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
          <XCircle size={16} className="mt-0.5 shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-start gap-2">
          <CheckCircle size={16} className="mt-0.5 shrink-0" />{success}
        </div>
      )}

      {/* ── Tab: Download Package ── */}
      {tab === 'package' && (
        <div className="space-y-5">
          <p className="text-sm text-muted">
            Generate a submission-ready ZIP containing your book in EPUB, PDF, JSON formats plus a metadata file.
            Upload it manually to any publisher (Amazon KDP, IngramSpark, Kobo Writing Life, etc.).
          </p>

          <div>
            <label className="block text-sm font-medium mb-1">Genres <span className="text-muted font-normal">(comma separated)</span></label>
            <input
              type="text"
              value={genres}
              onChange={e => setGenres(e.target.value)}
              placeholder="Fiction, Literary, Contemporary"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">ISBN <span className="text-muted font-normal">(optional)</span></label>
            <input
              type="text"
              value={isbn}
              onChange={e => setIsbn(e.target.value)}
              placeholder="978-0-000-00000-0"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={handleGeneratePackage}
            disabled={working}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-60"
          >
            {working ? <Loader2 size={15} className="animate-spin" /> : <Package size={15} />}
            {working ? 'Building package…' : 'Generate Submission Package'}
          </button>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs text-muted font-medium mb-2">Supported publishers:</p>
            <div className="flex flex-wrap gap-2">
              {['Amazon KDP', 'Draft2Digital', 'Smashwords', 'IngramSpark', 'Kobo Writing Life', 'Apple Books', 'Barnes & Noble Press'].map(p => (
                <span key={p} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{p}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Direct Submit ── */}
      {tab === 'direct' && (
        <div className="space-y-5">
          <p className="text-sm text-muted">
            Submit directly to Draft2Digital or Smashwords using your API key. Your book will be converted to EPUB and uploaded automatically.
          </p>

          <div>
            <label className="block text-sm font-medium mb-1">Platform</label>
            <div className="flex gap-3">
              {(['draft2digital', 'smashwords'] as Platform[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    platform === p ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {p === 'draft2digital' ? 'Draft2Digital' : 'Smashwords'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              API Token <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={apiToken}
              onChange={e => setApiToken(e.target.value)}
              placeholder="Your API token"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted mt-1">
              {platform === 'draft2digital'
                ? 'Get your token at draft2digital.com → Account → API Access'
                : 'Get your token at smashwords.com → Account → API'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Genres <span className="text-muted font-normal">(comma separated)</span></label>
            <input
              type="text"
              value={genres}
              onChange={e => setGenres(e.target.value)}
              placeholder="Fiction, Literary"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Price (USD)</label>
              <input
                type="number"
                min="0"
                step="0.99"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
              <p className="text-xs text-muted mt-1">Set 0 for free</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ISBN <span className="text-muted font-normal">(optional)</span></label>
              <input
                type="text"
                value={isbn}
                onChange={e => setIsbn(e.target.value)}
                placeholder="978-0-000-00000-0"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            onClick={handleDirectSubmit}
            disabled={working || !apiToken.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium text-sm hover:bg-indigo-700 disabled:opacity-60"
          >
            {working ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {working ? 'Submitting…' : `Submit to ${platform === 'draft2digital' ? 'Draft2Digital' : 'Smashwords'}`}
          </button>
        </div>
      )}

      {/* ── Tab: History ── */}
      {tab === 'history' && (
        <div>
          {submissions.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <Send size={32} className="mx-auto mb-3 opacity-30" />
              <p>No submissions yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map(s => (
                <div key={s.id} className="flex items-start gap-3 p-4 border border-gray-200 rounded-lg">
                  <div className="mt-0.5">{STATUS_ICON[s.status] || STATUS_ICON.pending}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm capitalize">
                        {s.platform === 'draft2digital' ? 'Draft2Digital' : s.platform === 'smashwords' ? 'Smashwords' : s.platform}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        s.status === 'published' ? 'bg-green-100 text-green-700'
                        : s.status === 'failed' ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-600'
                      }`}>{s.status}</span>
                    </div>
                    <div className="text-xs text-muted mt-0.5">
                      {new Date(s.submitted_at).toLocaleString()}
                      {s.submission_id && ` · ID: ${s.submission_id}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {s.publisher_url && (
                      <a href={s.publisher_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-600">
                        <ExternalLink size={15} />
                      </a>
                    )}
                    <button
                      onClick={() => handleDeleteSubmission(s.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
