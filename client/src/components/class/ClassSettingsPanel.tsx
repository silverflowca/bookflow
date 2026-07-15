import { useState, useEffect, useRef } from 'react';
import { Settings, BookOpen, Star, Trash2, Plus, Search, Check, Copy, Link, AlertCircle, ClipboardList, Image, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../lib/api';
import type { Book, ClubRegistrationSettings } from '../../types';
import RegistrationFormBuilder from './RegistrationFormBuilder';

interface ClubBook {
  id: string;
  book_id: string;
  is_current: boolean;
  book?: { id: string; title: string; cover_image_url?: string };
}

interface Club {
  id: string;
  name: string;
  description?: string;
  cover_image_url?: string;
  visibility: 'public' | 'private';
  max_members: number;
  books?: ClubBook[];
}

interface Props {
  club: Club;
  onReload: () => void;
}

export default function ClassSettingsPanel({ club, onReload }: Props) {
  // General settings
  const [name, setName] = useState(club.name);
  const [description, setDescription] = useState(club.description ?? '');
  const [visibility, setVisibility] = useState<'public' | 'private'>(club.visibility);
  const [maxMembers, setMaxMembers] = useState(String(club.max_members));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Book management
  const [books, setBooks] = useState<ClubBook[]>(club.books ?? []);
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState<Book[]>([]);
  const [bookSearching, setBookSearching] = useState(false);
  const [bookAdding, setBookAdding] = useState<string | null>(null);
  const [bookError, setBookError] = useState('');
  const bookDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Invite link
  const [inviteLink, setInviteLink] = useState('');
  const [generating, setGenerating] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Registration form
  const [regSettings, setRegSettings] = useState<ClubRegistrationSettings>({
    registration_enabled: false,
    registration_fields: [],
  });
  const [regExpanded, setRegExpanded] = useState(false);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgError, setBgError] = useState('');

  useEffect(() => {
    setBooks(club.books ?? []);
  }, [club.books]);

  useEffect(() => {
    if (bookQuery.trim().length < 2) { setBookResults([]); return; }
    if (bookDebounceRef.current) clearTimeout(bookDebounceRef.current);
    bookDebounceRef.current = setTimeout(async () => {
      setBookSearching(true);
      try {
        const results = await api.searchBooks(bookQuery.trim());
        // Filter out already-added books
        const addedIds = new Set(books.map(b => b.book_id));
        setBookResults(results.filter(b => !addedIds.has(b.id)));
      } catch { setBookResults([]); }
      finally { setBookSearching(false); }
    }, 300);
    return () => { if (bookDebounceRef.current) clearTimeout(bookDebounceRef.current); };
  }, [bookQuery, books]);

  // Load registration settings
  useEffect(() => {
    api.getClubRegistration(club.id)
      .then(data => {
        if (data.settings) setRegSettings(data.settings);
      })
      .catch(() => {});
  }, [club.id]);

  async function handleSaveSettings() {
    if (!name.trim()) { setSaveError('Name is required'); return; }
    const max = parseInt(maxMembers);
    if (isNaN(max) || max < 1 || max > 999) { setSaveError('Max students must be 1–999'); return; }
    setSaving(true);
    setSaveError('');
    try {
      await api.updateClub(club.id, { name: name.trim(), description: description.trim() || undefined, visibility, max_members: max });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onReload();
    } catch (err: any) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddBook(book: Book) {
    setBookAdding(book.id);
    setBookError('');
    try {
      const result = await api.addBookToClub(club.id, book.id, books.length === 0);
      // Optimistically update
      const newEntry: ClubBook = {
        id: result.id ?? '',
        book_id: book.id,
        is_current: books.length === 0,
        book: { id: book.id, title: book.title, cover_image_url: book.cover_image_url },
      };
      setBooks(prev => [newEntry, ...prev]);
      setBookQuery('');
      setBookResults([]);
      onReload();
    } catch (err: any) {
      setBookError(err.message);
    } finally {
      setBookAdding(null);
    }
  }

  async function handleSetCurrent(cb: ClubBook) {
    try {
      await api.setCurrentClubBook(club.id, cb.id);
      setBooks(prev => prev.map(b => ({ ...b, is_current: b.id === cb.id })));
      onReload();
    } catch (err: any) {
      setBookError(err.message);
    }
  }

  async function handleRemoveBook(cb: ClubBook) {
    if (!confirm(`Remove "${cb.book?.title}" from this class?`)) return;
    try {
      await api.removeBookFromClub(club.id, cb.id);
      setBooks(prev => prev.filter(b => b.id !== cb.id));
      onReload();
    } catch (err: any) {
      setBookError(err.message);
    }
  }

  async function generateInviteLink() {
    setGenerating(true);
    try {
      const result = await api.inviteClubMember(club.id, { email: `invite+${Date.now()}@placeholder.internal` });
      if (result.invite_token) {
        const link = `${window.location.origin}/clubs/accept/${result.invite_token}`;
        setInviteLink(link);
      }
    } catch (err: any) {
      // ignore
    } finally {
      setGenerating(false);
    }
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function handleBgUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBgUploading(true);
    setBgError('');
    try {
      const result = await api.uploadClubRegistrationBg(club.id, file);
      setRegSettings(prev => ({ ...prev, registration_bg_url: result.registration_bg_url }));
    } catch (err: any) {
      setBgError(err.message || 'Upload failed');
    } finally {
      setBgUploading(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── General settings ─────────────────────────────────── */}
      <div className="theme-section rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Settings className="h-5 w-5 text-muted" />
          <h2 className="font-semibold text-theme">General</h2>
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Class Name</label>
          <input
            className="w-full theme-input rounded-lg px-3 py-2 text-sm"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Class name"
          />
        </div>

        <div>
          <label className="block text-xs text-muted mb-1">Description</label>
          <textarea
            className="w-full theme-input rounded-lg px-3 py-2 text-sm resize-none"
            rows={3}
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What is this class about?"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1">Visibility</label>
            <select
              className="w-full theme-input rounded-lg px-3 py-2 text-sm"
              value={visibility}
              onChange={e => setVisibility(e.target.value as 'public' | 'private')}
            >
              <option value="private">Private (invite only)</option>
              <option value="public">Public (discoverable)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Max Students</label>
            <input
              type="number"
              min={1}
              max={999}
              className="w-full theme-input rounded-lg px-3 py-2 text-sm"
              value={maxMembers}
              onChange={e => setMaxMembers(e.target.value)}
            />
          </div>
        </div>

        {saveError && (
          <p className="text-xs text-red-500 flex items-center gap-1">
            <AlertCircle className="h-3.5 w-3.5" /> {saveError}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          {saved && <span className="text-xs text-emerald-500 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Saved</span>}
          {!saved && <span />}
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="theme-button-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* ── Book management ───────────────────────────────────── */}
      <div className="theme-section rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="h-5 w-5 text-muted" />
          <h2 className="font-semibold text-theme">Books</h2>
        </div>

        {bookError && <p className="text-xs text-red-500">{bookError}</p>}

        {/* Current books list */}
        {books.length > 0 && (
          <div className="space-y-2">
            {books.map(cb => {
              const book = Array.isArray(cb.book) ? (cb.book as any)[0] : cb.book;
              return (
                <div key={cb.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-strong/5">
                  {book?.cover_image_url ? (
                    <img src={book.cover_image_url} alt={book.title} className="w-8 h-11 object-cover rounded flex-shrink-0" />
                  ) : (
                    <div className="w-8 h-11 bg-gradient-to-br from-indigo-400 to-purple-500 rounded flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-3.5 w-3.5 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-theme truncate">{book?.title ?? 'Untitled'}</p>
                    {cb.is_current && (
                      <span className="text-xs text-violet-500 font-medium">Current book</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!cb.is_current && (
                      <button
                        onClick={() => handleSetCurrent(cb)}
                        className="text-xs flex items-center gap-1 text-muted hover:text-violet-500 transition-colors"
                        title="Set as current book"
                      >
                        <Star className="h-3.5 w-3.5" /> Set current
                      </button>
                    )}
                    <button
                      onClick={() => handleRemoveBook(cb)}
                      className="text-muted hover:text-red-500 transition-colors"
                      title="Remove book"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Book search */}
        <div>
          <label className="block text-xs text-muted mb-1.5">Add a book</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
            <input
              type="text"
              className="w-full theme-input rounded-lg pl-8 pr-3 py-2 text-sm"
              placeholder="Search for a book by title..."
              value={bookQuery}
              onChange={e => setBookQuery(e.target.value)}
            />
          </div>
          {bookSearching && <p className="text-xs text-muted mt-2">Searching...</p>}
          {bookResults.length > 0 && (
            <div className="mt-2 border border-strong/20 rounded-lg overflow-hidden">
              {bookResults.slice(0, 6).map(book => (
                <div key={book.id} className="flex items-center gap-3 p-2.5 hover:bg-strong/5 transition-colors">
                  {book.cover_image_url ? (
                    <img src={book.cover_image_url} alt={book.title} className="w-7 h-9 object-cover rounded flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-9 bg-gradient-to-br from-indigo-400 to-purple-500 rounded flex items-center justify-center flex-shrink-0">
                      <BookOpen className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-theme truncate">{book.title}</p>
                  </div>
                  <button
                    onClick={() => handleAddBook(book)}
                    disabled={bookAdding === book.id}
                    className="flex items-center gap-1 text-xs theme-button-primary px-2.5 py-1.5 rounded-lg disabled:opacity-50 flex-shrink-0"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    {bookAdding === book.id ? 'Adding...' : 'Add'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Enrollment / Invite link ─────────────────────────── */}
      <div className="theme-section rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Link className="h-5 w-5 text-muted" />
          <h2 className="font-semibold text-theme">Enrollment</h2>
        </div>

        <p className="text-sm text-muted">
          Generate a shareable invite link that lets anyone join this class directly.
        </p>

        {inviteLink ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 bg-strong/5 rounded-lg px-3 py-2">
              <span className="text-xs text-theme flex-1 truncate">{inviteLink}</span>
              <button
                onClick={copyInviteLink}
                className="flex items-center gap-1 text-xs text-muted hover:text-theme transition-colors flex-shrink-0"
              >
                {linkCopied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                {linkCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <button
              onClick={generateInviteLink}
              className="text-xs text-muted hover:text-theme transition-colors"
            >
              Generate new link
            </button>
          </div>
        ) : (
          <button
            onClick={generateInviteLink}
            disabled={generating}
            className="theme-button-secondary px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate Invite Link'}
          </button>
        )}
      </div>

      {/* ── Registration Form ─────────────────────────────────── */}
      <div className="theme-section rounded-xl overflow-hidden">
        <button
          onClick={() => setRegExpanded(prev => !prev)}
          className="w-full flex items-center gap-2 px-5 py-4 text-left hover:bg-strong/5 transition-colors"
        >
          <ClipboardList className="h-5 w-5 text-muted flex-shrink-0" />
          <h2 className="font-semibold text-theme flex-1">Registration Form</h2>
          {regSettings.registration_enabled && (
            <span className="text-xs text-emerald-500 font-medium mr-2">Enabled</span>
          )}
          {regExpanded ? <ChevronUp className="h-4 w-4 text-muted" /> : <ChevronDown className="h-4 w-4 text-muted" />}
        </button>

        {regExpanded && (
          <div className="px-5 pb-5 border-t border-theme space-y-5 pt-5">
            {/* Background image */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Image className="h-4 w-4 text-muted" />
                <span className="text-sm font-medium text-theme">Background Image</span>
              </div>
              {regSettings.registration_bg_url && (
                <img
                  src={regSettings.registration_bg_url}
                  alt="Registration background"
                  className="w-full h-28 object-cover rounded-lg mb-2"
                />
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <span className="theme-button-secondary px-3 py-1.5 rounded-lg text-xs">
                  {bgUploading ? 'Uploading…' : regSettings.registration_bg_url ? 'Change image' : 'Upload image'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleBgUpload}
                  disabled={bgUploading}
                />
              </label>
              {bgError && <p className="text-xs text-red-500 mt-1">{bgError}</p>}
              <p className="text-xs text-muted mt-1">This image appears behind all 3 registration steps. Max 10 MB.</p>
            </div>

            <RegistrationFormBuilder
              clubId={club.id}
              settings={regSettings}
              onSaved={setRegSettings}
            />
          </div>
        )}
      </div>

    </div>
  );
}
