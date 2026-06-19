import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Save, Upload, Image, X, Loader2, Globe, Lock, Copy, Check, Users, History, Share2, Activity, BarChart2, QrCode, Download, Edit2, ExternalLink } from 'lucide-react';
import QRCode from 'qrcode';
import api from '../lib/api';
import type { Book, BookSettings as BookSettingsType, Chapter } from '../types';

export default function BookSettings() {
  const { bookId } = useParams<{ bookId: string }>();
  const [book, setBook] = useState<Book | null>(null);
  const [settings, setSettings] = useState<BookSettingsType | null>(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [copied, setCopied] = useState(false);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  // QR code state
  const [bookQrDataUrl, setBookQrDataUrl] = useState<string | null>(null);
  const [chapterQrUrls, setChapterQrUrls] = useState<Record<string, string>>({});
  const [editingBookSlug, setEditingBookSlug] = useState(false);
  const [bookSlugInput, setBookSlugInput] = useState('');
  const [savingBookSlug, setSavingBookSlug] = useState(false);
  const [editingChapterSlug, setEditingChapterSlug] = useState<string | null>(null);
  const [chapterSlugInput, setChapterSlugInput] = useState('');
  const [savingChapterSlug, setSavingChapterSlug] = useState(false);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    if (bookId) {
      loadBook();
    }
  }, [bookId]);

  async function loadBook() {
    try {
      const data = await api.getBook(bookId!);
      setBook(data);
      setSettings(data.settings || null);
      setCoverUrl(data.cover_image_url || null);
      setTitle(data.title || '');
      setSubtitle(data.subtitle || '');
      setDescription(data.description || '');
      if (data.visibility === 'public') {
        loadChaptersAndQr(data);
      }
    } catch (err) {
      console.error('Failed to load book:', err);
    } finally {
      setLoading(false);
    }
  }

  const loadChaptersAndQr = useCallback(async (b: typeof book) => {
    if (!b || !bookId) return;
    try {
      const chs = await api.getChapters(bookId);
      setChapters(chs);
      // Generate book QR
      const landingUrl = `${window.location.origin}/book-landing/${b.slug || b.id}`;
      const bookQr = await QRCode.toDataURL(landingUrl, { width: 512, margin: 2 });
      setBookQrDataUrl(bookQr);
      // Generate chapter QRs
      const chUrls: Record<string, string> = {};
      for (const ch of chs) {
        const chUrl = `${window.location.origin}/book-landing/${b.slug || b.id}?chapter=${ch.slug || ch.id}`;
        chUrls[ch.id] = await QRCode.toDataURL(chUrl, { width: 256, margin: 2 });
      }
      setChapterQrUrls(chUrls);
    } catch (err) {
      console.error('Failed to load chapters/QR:', err);
    }
  }, [bookId]);

  async function handleSaveBookSlug() {
    if (!bookId || !book || !bookSlugInput.trim()) return;
    setSavingBookSlug(true);
    try {
      const updated = await api.patchBookSlug(bookId, bookSlugInput.trim());
      setBook(prev => prev ? { ...prev, slug: updated.slug } : null);
      setEditingBookSlug(false);
      // Regenerate QR with new slug
      const landingUrl = `${window.location.origin}/book-landing/${updated.slug}`;
      const bookQr = await QRCode.toDataURL(landingUrl, { width: 512, margin: 2 });
      setBookQrDataUrl(bookQr);
    } catch (err: any) {
      alert(err?.message || 'Failed to save slug');
    } finally {
      setSavingBookSlug(false);
    }
  }

  async function handleSaveChapterSlug(chapterId: string) {
    if (!bookId || !chapterSlugInput.trim()) return;
    setSavingChapterSlug(true);
    try {
      const updated = await api.patchChapterSlug(chapterId, chapterSlugInput.trim());
      setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, slug: updated.slug } : c));
      setEditingChapterSlug(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to save chapter slug');
    } finally {
      setSavingChapterSlug(false);
    }
  }

  async function handleGenerateChapterSlug(chapterId: string) {
    if (!bookId) return;
    try {
      const updated = await api.generateChapterSlug(bookId, chapterId);
      setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, slug: updated.slug } : c));
      // Regenerate QR for this chapter
      const bookSlug = book?.slug || book?.id || '';
      const chUrl = `${window.location.origin}/book-landing/${bookSlug}?chapter=${updated.slug}`;
      const qr = await QRCode.toDataURL(chUrl, { width: 256, margin: 2 });
      setChapterQrUrls(prev => ({ ...prev, [chapterId]: qr }));
    } catch (err: any) {
      alert(err?.message || 'Failed to generate slug');
    }
  }

  function downloadQr(dataUrl: string, filename: string) {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !bookId) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setUploadingCover(true);
    try {
      const { cover_image_url } = await api.uploadBookCover(bookId, file);
      setCoverUrl(cover_image_url);
      setBook(prev => prev ? { ...prev, cover_image_url } : null);
    } catch (err) {
      console.error('Failed to upload cover:', err);
      alert('Failed to upload cover image');
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) {
        coverInputRef.current.value = '';
      }
    }
  }

  async function handleRemoveCover() {
    if (!bookId || !coverUrl) return;

    if (!confirm('Remove the cover image?')) return;

    try {
      await api.updateBook(bookId, { cover_image_url: null as any });
      setCoverUrl(null);
      setBook(prev => prev ? { ...prev, cover_image_url: undefined } : null);
    } catch (err) {
      console.error('Failed to remove cover:', err);
      alert('Failed to remove cover image');
    }
  }

  async function handleSave() {
    if (!bookId || !settings) return;
    setSaving(true);
    setSaved(false);
    try {
      const [updatedBook] = await Promise.all([
        api.updateBook(bookId, { title: title.trim(), subtitle: subtitle.trim() || undefined, description: description.trim() || undefined }),
        api.updateBookSettings(bookId, settings),
      ]);
      setBook(prev => prev ? { ...prev, ...updatedBook } : null);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleVisibility() {
    if (!bookId || !book) return;
    setTogglingVisibility(true);
    try {
      const newVisibility = book.visibility === 'public' ? 'private' : 'public';
      const newStatus = newVisibility === 'public' && book.status === 'draft' ? 'published' : book.status;
      const updated = await api.updateBook(bookId, { visibility: newVisibility, status: newStatus });
      setBook(updated);
    } catch (err) {
      console.error('Failed to update visibility:', err);
    } finally {
      setTogglingVisibility(false);
    }
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(`${window.location.origin}/book/${bookId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function updateSetting(key: keyof BookSettingsType, value: boolean | number) {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    if (secs === 0) return `${mins}m`;
    return `${mins}m ${secs}s`;
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!book || !settings) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-gray-500">Book not found</p>
        <Link to="/dashboard" className="text-primary-600 hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to={`/edit/book/${bookId}`} className="text-muted hover:text-theme">
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-theme">Book Settings</h1>
          <p className="text-muted">{title || book.title}</p>
        </div>
      </div>

      {/* Quick links */}
      <div id="bf-settings-quicklinks" className="flex gap-3 mb-8">
        <Link
          to={`/edit/book/${bookId}/collaborators`}
          className="flex items-center gap-2 px-4 py-2 theme-section rounded-lg text-sm font-medium text-muted hover:text-theme transition-colors"
        >
          <Users className="h-4 w-4" />
          Collaborators
        </Link>
        <Link
          to={`/edit/book/${bookId}/versions`}
          className="flex items-center gap-2 px-4 py-2 theme-section rounded-lg text-sm font-medium text-muted hover:text-theme transition-colors"
        >
          <History className="h-4 w-4" />
          Versions
        </Link>
        <Link
          to={`/edit/book/${bookId}/activity`}
          className="flex items-center gap-2 px-4 py-2 theme-section rounded-lg text-sm font-medium text-muted hover:text-theme transition-colors"
        >
          <Activity className="h-4 w-4" />
          Activity
        </Link>
        <Link
          to={`/edit/book/${bookId}/dashboard`}
          className="flex items-center gap-2 px-4 py-2 theme-section rounded-lg text-sm font-medium text-muted hover:text-theme transition-colors"
        >
          <BarChart2 className="h-4 w-4" />
          Dashboard
        </Link>
        {book.slug && (
          <a
            href={`/read/${book.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 theme-section rounded-lg text-sm font-medium text-muted hover:text-theme transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Public URL
          </a>
        )}
      </div>

      {/* Settings Form */}
      <div className="theme-section divide-y divide-[var(--color-border)]">
        {/* Book Details */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-theme">Book Details</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-theme mb-1">Title <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-surface border-2 border-theme rounded-lg focus:outline-none focus:border-accent text-theme"
                placeholder="Book title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme mb-1">Subtitle</label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full px-3 py-2 bg-surface border-2 border-theme rounded-lg focus:outline-none focus:border-accent text-theme"
                placeholder="Optional subtitle"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-theme mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 bg-surface border-2 border-theme rounded-lg focus:outline-none focus:border-accent text-theme resize-none"
                placeholder="A short description of your book"
              />
            </div>
          </div>
        </div>

        {/* Publishing */}
        <div id="bf-settings-publish" className="p-6">
          <h2 className="text-lg font-semibold mb-1 text-theme">Publishing</h2>
          <p className="text-sm text-muted mb-4">Control who can access this book</p>

          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleVisibility}
              disabled={togglingVisibility}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                book.visibility === 'public'
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-surface-hover text-muted hover:border-strong border-2 border-theme'
              }`}
            >
              {togglingVisibility ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : book.visibility === 'public' ? (
                <Globe className="h-4 w-4" />
              ) : (
                <Lock className="h-4 w-4" />
              )}
              {book.visibility === 'public' ? 'Public' : 'Private'}
            </button>
            <span className="text-sm text-muted">
              {book.visibility === 'public'
                ? 'Anyone with the link can read this book'
                : 'Only you can see this book'}
            </span>
          </div>

          {book.visibility === 'public' && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-surface-hover border-2 border-theme rounded-lg">
              <span className="text-sm text-muted flex-1 truncate">
                {window.location.origin}/book/{bookId}
              </span>
              <button
                onClick={handleCopyUrl}
                className="flex items-center gap-1 px-3 py-1 text-sm theme-button-secondary rounded-md"
              >
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}

          {/* Public slug + share token (set by publish flow) */}
          {book.slug && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <Globe className="h-4 w-4 text-green-600 flex-shrink-0" />
                <span className="text-sm text-green-800 flex-1 truncate">
                  {window.location.origin}/read/{book.slug}
                </span>
              </div>
              {book.share_token && (
                <div className="flex items-center gap-2 p-3 bg-surface-hover border-2 border-theme rounded-lg">
                  <Lock className="h-4 w-4 text-muted flex-shrink-0" />
                  <span className="text-xs text-muted flex-1 truncate">
                    Private link: {window.location.origin}/read/share/{book.share_token}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* QR Code Section — only when public */}
          {book.visibility === 'public' && (
            <div className="mt-6 pt-5 border-t border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-1">
                <QrCode className="h-5 w-5 text-accent" />
                <h3 className="text-base font-semibold text-theme">QR Codes</h3>
              </div>
              <p className="text-sm text-muted mb-4">
                Print these QR codes in your physical book, flyers, or bulletins to link readers to this interactive BookFlow edition.
              </p>

              {/* Book QR */}
              <div className="p-4 bg-surface-hover border border-[var(--color-border)] rounded-xl mb-4">
                <p className="text-sm font-semibold text-theme mb-3">Book Landing Page</p>
                <div className="flex flex-col sm:flex-row items-center gap-5">
                  {bookQrDataUrl ? (
                    <img src={bookQrDataUrl} alt="Book QR code" className="w-36 h-36 rounded-lg border border-[var(--color-border)]" />
                  ) : (
                    <div className="w-36 h-36 rounded-lg border border-[var(--color-border)] flex items-center justify-center bg-surface">
                      <Loader2 className="h-6 w-6 animate-spin text-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* Book slug editor */}
                    <div>
                      <p className="text-xs text-muted mb-1">Landing page URL</p>
                      {editingBookSlug ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted shrink-0">{window.location.origin}/book-landing/</span>
                          <input
                            type="text"
                            value={bookSlugInput}
                            onChange={e => setBookSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                            className="flex-1 px-2 py-1 text-sm bg-surface border border-[var(--color-border)] rounded focus:outline-none focus:border-accent text-theme"
                            autoFocus
                          />
                          <button
                            onClick={handleSaveBookSlug}
                            disabled={savingBookSlug}
                            className="px-3 py-1 text-xs theme-button-primary rounded"
                          >
                            {savingBookSlug ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                          </button>
                          <button onClick={() => setEditingBookSlug(false)} className="px-2 py-1 text-xs text-muted hover:text-theme">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-theme bg-surface px-2 py-1 rounded border border-[var(--color-border)] flex-1 truncate">
                            {window.location.origin}/book-landing/{book.slug || book.id}
                          </code>
                          <button
                            onClick={() => { setBookSlugInput(book.slug || ''); setEditingBookSlug(true); }}
                            className="flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-theme theme-button-secondary rounded"
                          >
                            <Edit2 className="h-3 w-3" /> Edit
                          </button>
                          <a
                            href={`/book-landing/${book.slug || book.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-theme theme-button-secondary rounded"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                    {/* Download */}
                    {bookQrDataUrl && (
                      <button
                        onClick={() => downloadQr(bookQrDataUrl, `qr-${book.slug || book.id}.png`)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs theme-button-secondary rounded-lg"
                      >
                        <Download className="h-3.5 w-3.5" /> Download QR PNG
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Chapter QR codes */}
              <div className="p-4 bg-surface-hover border border-[var(--color-border)] rounded-xl">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-theme">Chapter QR Codes</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.enable_chapter_qr_codes ?? true}
                      onChange={e => updateSetting('enable_chapter_qr_codes', e.target.checked)}
                      className="w-4 h-4 accent-[var(--color-accent)]"
                    />
                    <span className="text-xs text-muted">Enabled</span>
                  </label>
                </div>

                {(settings?.enable_chapter_qr_codes ?? true) && (
                  <div className="space-y-4">
                    {chapters.length === 0 && (
                      <p className="text-sm text-muted italic">No chapters yet.</p>
                    )}
                    {chapters.map((ch, i) => (
                      <div key={ch.id} className="flex flex-col sm:flex-row items-start gap-4 p-3 bg-surface rounded-lg border border-[var(--color-border)]">
                        {/* QR thumbnail */}
                        {chapterQrUrls[ch.id] ? (
                          <img src={chapterQrUrls[ch.id]} alt={`QR for ${ch.title}`} className="w-20 h-20 rounded border border-[var(--color-border)] shrink-0" />
                        ) : (
                          <div className="w-20 h-20 rounded border border-[var(--color-border)] flex items-center justify-center bg-surface-hover shrink-0">
                            <Loader2 className="h-4 w-4 animate-spin text-muted" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <p className="text-sm font-medium text-theme truncate">
                            <span className="text-muted mr-1">Ch {i + 1}:</span> {ch.title}
                          </p>
                          {/* Chapter slug editor */}
                          {editingChapterSlug === ch.id ? (
                            <div className="flex items-center gap-2 flex-wrap">
                              <input
                                type="text"
                                value={chapterSlugInput}
                                onChange={e => setChapterSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                                placeholder="chapter-slug"
                                className="flex-1 min-w-0 px-2 py-1 text-xs bg-surface border border-[var(--color-border)] rounded focus:outline-none focus:border-accent text-theme"
                                autoFocus
                              />
                              <button
                                onClick={() => handleSaveChapterSlug(ch.id)}
                                disabled={savingChapterSlug}
                                className="px-2 py-1 text-xs theme-button-primary rounded"
                              >
                                {savingChapterSlug ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                              </button>
                              <button onClick={() => setEditingChapterSlug(null)} className="text-xs text-muted hover:text-theme">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <code className="text-xs text-muted bg-surface-hover px-1.5 py-0.5 rounded border border-[var(--color-border)] truncate max-w-[180px]">
                                {ch.slug || <span className="italic">no slug</span>}
                              </code>
                              <button
                                onClick={() => { setChapterSlugInput(ch.slug || ''); setEditingChapterSlug(ch.id); }}
                                className="flex items-center gap-1 text-xs text-muted hover:text-theme"
                              >
                                <Edit2 className="h-3 w-3" /> Edit
                              </button>
                              {!ch.slug && (
                                <button
                                  onClick={() => handleGenerateChapterSlug(ch.id)}
                                  className="text-xs text-accent hover:underline"
                                >
                                  Auto-generate
                                </button>
                              )}
                            </div>
                          )}
                          {/* Download button */}
                          {chapterQrUrls[ch.id] && (
                            <button
                              onClick={() => downloadQr(chapterQrUrls[ch.id], `qr-ch${i + 1}-${ch.slug || ch.id}.png`)}
                              className="flex items-center gap-1 text-xs text-muted hover:text-theme"
                            >
                              <Download className="h-3 w-3" /> Download PNG
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Book Cover */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-theme">Book Cover</h2>
          <p className="text-sm text-muted mb-4">
            Upload a cover image for your book (recommended: 600x900px)
          </p>

          <div className="flex items-start gap-6">
            {/* Cover Preview — input inside label so click natively opens picker */}
            <label className="w-32 h-48 rounded-lg border-2 border-dashed border-theme flex items-center justify-center overflow-hidden bg-surface-hover flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity relative group block">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden"
              />
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt="Book cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Image className="h-12 w-12 text-muted" />
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Upload className="h-6 w-6 text-white" />
              </div>
            </label>

            {/* Upload Controls */}
            <div className="flex-1 space-y-3">
              <label
                className={`flex items-center gap-2 px-4 py-2 theme-button-primary rounded-lg cursor-pointer ${uploadingCover ? 'opacity-50 pointer-events-none' : ''}`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleCoverUpload}
                  className="hidden"
                />
                {uploadingCover ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {coverUrl ? 'Change Cover' : 'Upload Cover'}
                  </>
                )}
              </label>

              {coverUrl && (
                <button
                  onClick={handleRemoveCover}
                  className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg border-2 border-transparent hover:border-red-200"
                >
                  <X className="h-4 w-4" />
                  Remove Cover
                </button>
              )}

              <p className="text-xs text-gray-500">
                <span className="text-muted">Supported formats: JPG, PNG, WebP. Max size: 5MB.</span>
              </p>
            </div>
          </div>
        </div>

        {/* Reader Permissions */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-theme">Reader Permissions</h2>
          <p className="text-sm text-muted mb-4">
            Control what readers can add to your book
          </p>

          <div className="space-y-4">
            <ToggleSetting
              label="Allow reader highlights"
              description="Readers can highlight text in your book"
              checked={settings.allow_reader_highlights}
              onChange={(v) => updateSetting('allow_reader_highlights', v)}
            />

            <ToggleSetting
              label="Allow reader notes"
              description="Readers can add notes to your book"
              checked={settings.allow_reader_notes}
              onChange={(v) => updateSetting('allow_reader_notes', v)}
            />

            <ToggleSetting
              label="Allow reader questions"
              description="Readers can ask questions about content"
              checked={settings.allow_reader_questions}
              onChange={(v) => updateSetting('allow_reader_questions', v)}
            />

            <ToggleSetting
              label="Allow reader polls"
              description="Readers can create polls (requires approval)"
              checked={settings.allow_reader_polls}
              onChange={(v) => updateSetting('allow_reader_polls', v)}
            />
          </div>
        </div>

        {/* Reader Media & Links */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-theme">Reader Media & Links</h2>
          <p className="text-sm text-muted mb-4">
            Control what media readers can add
          </p>

          <div className="space-y-4">
            <ToggleSetting
              label="Allow reader audio"
              description="Readers can add audio clips"
              checked={settings.allow_reader_audio ?? false}
              onChange={(v) => updateSetting('allow_reader_audio', v)}
            />

            <ToggleSetting
              label="Allow reader video"
              description="Readers can add video clips"
              checked={settings.allow_reader_video ?? false}
              onChange={(v) => updateSetting('allow_reader_video', v)}
            />

            <ToggleSetting
              label="Allow reader links"
              description="Readers can add external links"
              checked={settings.allow_reader_links ?? false}
              onChange={(v) => updateSetting('allow_reader_links', v)}
            />

            <ToggleSetting
              label="Enable Listen button for public"
              description="Show the Listen (text-to-speech) button to unauthenticated readers of this public book"
              checked={settings.allow_public_tts ?? false}
              onChange={(v) => updateSetting('allow_public_tts', v)}
            />
          </div>
        </div>

        {/* Progress Tracking */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-theme">Progress Tracking</h2>
          <p className="text-sm text-muted mb-4">
            Track reader completion of interactive elements (forms, audio, video) and display a progress indicator in the chapter menu.
          </p>

          <div className="space-y-4">
            <ToggleSetting
              label="Enable progress tracking"
              description="Readers see a progress button in the chapter sidebar showing how many interactive items they've completed. Each completed item gets a green border."
              checked={settings.enable_progress_tracking ?? false}
              onChange={(v) => updateSetting('enable_progress_tracking', v)}
            />
          </div>
        </div>

        {/* Component Panel */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-theme">Component Panel</h2>
          <p className="text-sm text-muted mb-4">
            When readers click a component icon (question, poll, audio, etc.) in the chapter header bar, open a detail panel on the right side. When off, clicking scrolls directly to the component in the chapter.
          </p>
          <div className="space-y-4">
            <ToggleSetting
              label="Show component detail panel"
              description="Open the right-side detail panel when clicking a component icon. Off by default — clicking just scrolls to the item."
              checked={settings.show_component_panel ?? false}
              onChange={(v) => updateSetting('show_component_panel', v)}
            />
          </div>
        </div>

        {/* Ratings */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-theme">Ratings</h2>
          <p className="text-sm text-muted mb-4">
            Allow readers to rate your book 1–5 stars and display the aggregate rating on the book card.
          </p>

          <div className="space-y-4">
            <ToggleSetting
              label="Show star ratings"
              description="Display a star rating widget in the reader sidebar and show the average rating on the public book listing."
              checked={settings.show_ratings ?? true}
              onChange={(v) => updateSetting('show_ratings', v)}
            />
          </div>
        </div>

        {/* Author Content Options */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-theme">Author Content Options</h2>
          <p className="text-sm text-muted mb-4">
            Control your own content abilities
          </p>

          <div className="space-y-4">
            <ToggleSetting
              label="Enable author audio"
              description="Add audio clips to your chapters"
              checked={settings.allow_author_audio ?? true}
              onChange={(v) => updateSetting('allow_author_audio', v)}
            />

            <ToggleSetting
              label="Enable author video"
              description="Add video clips to your chapters"
              checked={settings.allow_author_video ?? true}
              onChange={(v) => updateSetting('allow_author_video', v)}
            />

            <ToggleSetting
              label="Enable author links"
              description="Add external links to your chapters"
              checked={settings.allow_author_links ?? true}
              onChange={(v) => updateSetting('allow_author_links', v)}
            />
          </div>
        </div>

        {/* Media Duration Settings */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-theme">Media Duration Limit</h2>
          <p className="text-sm text-muted mb-4">
            Maximum recording duration for audio and video clips
          </p>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-theme">
              Max duration (seconds)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="30"
                max="300"
                step="30"
                value={settings.max_media_duration ?? 60}
                onChange={(e) => updateSetting('max_media_duration', parseInt(e.target.value) as any)}
                className="flex-1 h-2 bg-surface-hover rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
              />
              <span className="w-20 text-center font-mono bg-surface-hover border border-theme px-3 py-1 rounded text-theme">
                {formatDuration(settings.max_media_duration ?? 60)}
              </span>
            </div>
            <p className="text-xs text-muted">
              Choose between 30 seconds and 5 minutes
            </p>
          </div>
        </div>

        {/* Author Content Visibility */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-theme">Author Content Visibility</h2>
          <p className="text-sm text-muted mb-4">
            Control visibility of your annotations
          </p>

          <div className="space-y-4">
            <ToggleSetting
              label="Show author highlights"
              description="Display your highlights to readers"
              checked={settings.show_author_highlights}
              onChange={(v) => updateSetting('show_author_highlights', v)}
            />

            <ToggleSetting
              label="Show author notes"
              description="Display your notes to readers"
              checked={settings.show_author_notes}
              onChange={(v) => updateSetting('show_author_notes', v)}
            />
          </div>
        </div>

        {/* Editor Options */}
        <div className="p-6 border-t border-theme">
          <h2 className="text-lg font-semibold mb-4 text-theme">Editor Options</h2>
          <p className="text-sm text-muted mb-4">
            Configure how the chapter editor behaves while writing.
          </p>

          <div className="space-y-4">
            <ToggleSetting
              label="Show inline form preview below editor"
              description="Displays a live preview strip under the editor showing inline form items (textboxes, selects, etc.) with their highlighted anchor text beside the actual input control."
              checked={settings.show_inline_form_preview ?? true}
              onChange={(v) => updateSetting('show_inline_form_preview', v)}
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="mt-6 flex items-center justify-between">
        <div>
          {saved && (
            <span className="text-green-600 text-sm">Settings saved successfully!</span>
          )}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 theme-button-primary rounded-lg disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer">
      <div className="pt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="w-5 h-5 rounded border-theme accent-[var(--color-accent)]"
        />
      </div>
      <div>
        <p className="font-medium text-theme">{label}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
    </label>
  );
}
