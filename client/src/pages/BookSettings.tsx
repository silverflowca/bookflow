import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Save, Upload, Image, X, Loader2, Globe, Lock, Copy, Check, Users, History, Share2, Activity, BarChart2, Download, Edit, ExternalLink } from 'lucide-react';
import QRCode from 'qrcode';
import api from '../lib/api';
import type { Book, BookSettings as BookSettingsType } from '../types';
import SignatureStatusTab from '../components/signatures/SignatureStatusTab';

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

  // Slug editor
  const [slugValue, setSlugValue] = useState('');
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState('');
  const [savingSlug, setSavingSlug] = useState(false);
  const [slugSaved, setSlugSaved] = useState(false);

  // QR code for book URL
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrCopied, setQrCopied] = useState(false);


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
      if (data.slug) {
        setSlugValue(data.slug);
        const url = `${window.location.origin}/read/${data.slug}`;
        QRCode.toDataURL(url, { width: 512, margin: 2 }).then(setQrDataUrl);
      }
    } catch (err) {
      console.error('Failed to load book:', err);
    } finally {
      setLoading(false);
    }
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

  async function handleSaveSlug() {
    if (!slugInput.trim() || !bookId) return;
    setSavingSlug(true);
    try {
      const updated = await api.patchBookSlug(bookId, slugInput.trim());
      setSlugValue(updated.slug);
      setBook(prev => prev ? { ...prev, slug: updated.slug } : null);
      const url = `${window.location.origin}/read/${updated.slug}`;
      const qr = await QRCode.toDataURL(url, { width: 512, margin: 2 });
      setQrDataUrl(qr);
      setEditingSlug(false);
      setSlugSaved(true);
      setTimeout(() => setSlugSaved(false), 3000);
    } catch (err: any) {
      alert(err?.message || 'Failed to save slug');
    } finally {
      setSavingSlug(false);
    }
  }

  function downloadQr() {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `qr-book-${slugValue || bookId}.png`;
    a.click();
  }

  async function copyQr(url: string) {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob, 'text/plain': new Blob([url], { type: 'text/plain' }) }),
      ]);
    } catch {
      // Fallback: copy URL as text
      await navigator.clipboard.writeText(url).catch(() => {});
    }
    setQrCopied(true);
    setTimeout(() => setQrCopied(false), 2000);
  }

  function updateSetting(key: keyof BookSettingsType, value: boolean | number | string) {
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
          {(book.slug || book.visibility === 'public') && (
            <div className="mt-4 space-y-3">
              {/* Slug editor */}
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Public URL slug</label>
                {editingSlug ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted shrink-0">{window.location.origin}/read/</span>
                    <input
                      type="text"
                      value={slugInput}
                      onChange={e => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                      className="flex-1 min-w-0 px-2 py-1.5 text-sm bg-surface border-2 border-theme rounded-lg focus:outline-none focus:border-accent text-theme"
                      autoFocus
                      placeholder="my-book-slug"
                    />
                    <button onClick={handleSaveSlug} disabled={savingSlug} className="px-3 py-1.5 text-sm theme-button-primary rounded-lg shrink-0 flex items-center gap-1">
                      {savingSlug ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Save
                    </button>
                    <button onClick={() => setEditingSlug(false)} className="text-muted hover:text-theme p-1.5 shrink-0">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                    <Globe className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="text-sm text-green-800 dark:text-green-300 flex-1 truncate">
                      {slugValue ? `${window.location.origin}/read/${slugValue}` : <span className="italic text-muted">No slug yet — click Edit to set one</span>}
                    </span>
                    {slugValue && (
                      <a href={`/read/${slugValue}`} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1 text-green-600 hover:text-green-800">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <button onClick={() => { setSlugInput(slugValue); setEditingSlug(true); }} className="shrink-0 p-1 text-muted hover:text-theme" title="Edit slug">
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {slugSaved && <p className="text-xs text-green-600 mt-1">Slug saved!</p>}
              </div>

              {/* QR Code */}
              {qrDataUrl && (
                <div className="flex items-start gap-4 p-4 bg-surface-hover border-2 border-theme rounded-xl">
                  <button
                    onClick={() => copyQr(`${window.location.origin}/bl/${slugValue || bookId}`)}
                    title="Click to copy QR + URL"
                    className="relative group shrink-0 rounded-lg overflow-hidden border border-[var(--color-border)] focus:outline-none"
                  >
                    <img src={qrDataUrl} alt="Book QR Code" className="w-28 h-28 block" />
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">
                      {qrCopied ? <><Check className="h-4 w-4 mr-1" />Copied!</> : 'Copy'}
                    </div>
                  </button>
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium text-theme">Book QR Code</p>
                    <p className="text-xs text-muted">Click QR to copy image + URL. Scan to open this book.</p>
                    <button
                      onClick={downloadQr}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium theme-button-secondary rounded-lg"
                    >
                      <Download className="h-3.5 w-3.5" /> Download PNG
                    </button>
                  </div>
                </div>
              )}

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

          {/* Chapter QR tip */}
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <p className="text-xs text-muted">
              <strong className="text-theme">Chapter QR codes:</strong> Go to the{' '}
              <Link to={`/edit/book/${bookId}`} className="text-accent hover:underline">Chapter List</Link>{' '}
              and click the Share button on any chapter to get its QR code.
            </p>
          </div>
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

            <ToggleSetting
              label="Show reader source filters"
              description="Display the All / Author / Mine filter buttons in the live reader header. Defaults to All selected."
              checked={settings.show_reader_content_filters ?? true}
              onChange={(v) => updateSetting('show_reader_content_filters', v)}
            />

            <ToggleSetting
              label="Auto play media"
              description="When a reader starts a chapter audio or video item, continue through the chapter's native media items in content order."
              checked={settings.auto_play_media ?? false}
              onChange={(v) => updateSetting('auto_play_media', v)}
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

        {/* Listen & Chat */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-theme">Listen & Chat</h2>
          <p className="text-sm text-muted mb-4">
            Control the Listen button and the book-level chat feature.
          </p>
          <div className="space-y-4">
            <ToggleSetting
              label="Enable Listen button"
              description="Show the Listen (text-to-speech) button to all authenticated readers. When off, the button is hidden for everyone."
              checked={settings.enable_listen ?? true}
              onChange={(v) => updateSetting('enable_listen', v)}
            />

            <ToggleSetting
              label="Enable Book Chat"
              description="Allow readers to chat together. A Chat button will appear in the reader toolbar."
              checked={settings.enable_book_chat ?? false}
              onChange={(v) => updateSetting('enable_book_chat', v)}
            />

            {(settings.enable_book_chat ?? false) && (
              <div className="ml-6 pl-4 border-l-2 border-[var(--color-border)] space-y-3">
                <ToggleSetting
                  label="Share reader progress with other readers"
                  description="When a reader starts a new chapter, a status update is posted in the book chat."
                  checked={settings.chat_share_reader_progress ?? true}
                  onChange={(v) => updateSetting('chat_share_reader_progress', v)}
                />
                <ToggleSetting
                  label="Share book completion"
                  description="When a reader finishes the book, a completion message is posted in the book chat."
                  checked={settings.chat_share_book_progress ?? true}
                  onChange={(v) => updateSetting('chat_share_book_progress', v)}
                />
              </div>
            )}
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

            {/* Editor preview mode — live vs minimal */}
            <div>
              <p className="text-sm font-medium text-theme mb-1">Inline component display</p>
              <p className="text-xs text-muted mb-3">
                Choose how embedded components (images, polls, questions, forms) appear while writing in the editor.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {(['live', 'minimal'] as const).map(mode => {
                  const active = (settings.editor_preview_mode ?? 'live') === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => updateSetting('editor_preview_mode', mode)}
                      className={`flex flex-col items-start gap-1.5 px-4 py-3 rounded-xl border-2 text-left transition-all ${
                        active
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40'
                          : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-300 dark:hover:border-blue-700'
                      }`}
                    >
                      <span className={`text-sm font-semibold ${active ? 'text-blue-600 dark:text-blue-400' : 'text-theme'}`}>
                        {mode === 'live' ? '🖼 Live Preview' : '🏷 Minimal'}
                      </span>
                      <span className="text-xs text-muted leading-snug">
                        {mode === 'live'
                          ? 'Components render exactly as readers see them — full images, polls, forms, etc.'
                          : 'Components show as compact labelled badges so they stay out of your way while writing.'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* E-Signatures */}
      <div className="p-6">
        <h2 className="text-lg font-semibold mb-1 text-theme">E-Signatures</h2>
        <p className="text-sm text-muted mb-4">
          Track signature requests and responses from readers. Add a <strong>Signature</strong> component in the chapter editor to start collecting signatures.
        </p>
        {bookId && <SignatureStatusTab bookId={bookId} />}
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
