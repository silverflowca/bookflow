import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Save, Upload, Image, X, Loader2, Globe, Lock, Copy, Check, Users, History, Share2, Activity } from 'lucide-react';
import api from '../lib/api';
import type { Book, BookSettings as BookSettingsType } from '../types';

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
      <div className="flex gap-3 mb-8">
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
        <div className="p-6">
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
        </div>

        {/* Book Cover */}
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4 text-theme">Book Cover</h2>
          <p className="text-sm text-muted mb-4">
            Upload a cover image for your book (recommended: 600x900px)
          </p>

          <div className="flex items-start gap-6">
            {/* Cover Preview */}
            <div className="w-32 h-48 rounded-lg border-2 border-dashed border-theme flex items-center justify-center overflow-hidden bg-surface-hover flex-shrink-0">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt="Book cover"
                  className="w-full h-full object-cover"
                />
              ) : (
                <Image className="h-12 w-12 text-muted" />
              )}
            </div>

            {/* Upload Controls */}
            <div className="flex-1 space-y-3">
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverUpload}
                className="hidden"
              />

              <button
                onClick={() => coverInputRef.current?.click()}
                disabled={uploadingCover}
                className="flex items-center gap-2 px-4 py-2 theme-button-primary rounded-lg disabled:opacity-50"
              >
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
              </button>

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
