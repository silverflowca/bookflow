import { useState, useEffect, useRef, useCallback } from 'react';
import { Settings, BookOpen, Star, Trash2, Plus, Search, Check, Copy, Link, AlertCircle, ClipboardList, Image, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
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
  const [bookAdding, setBookAdding] = useState<string | null>(null);
  const [bookError, setBookError] = useState('');

  // Paginated book picker
  const PAGE_SIZE = 24;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [pickerPage, setPickerPage] = useState(0);
  const [pickerResults, setPickerResults] = useState<Book[]>([]);
  const [pickerCount, setPickerCount] = useState(0);
  const [pickerLoading, setPickerLoading] = useState(false);
  const pickerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Response visibility settings
  const [allowStudentsSetVisibility, setAllowStudentsSetVisibility] = useState(false);
  const [responsesVisibleToAll, setResponsesVisibleToAll] = useState(false);
  const [visSaving, setVisSaving] = useState(false);
  const [visSaved, setVisSaved] = useState(false);

  useEffect(() => {
    // Only sync from parent when the picker is closed, to avoid wiping optimistic updates
    if (!pickerOpen) {
      setBooks(club.books ?? []);
    }
  }, [club.books, pickerOpen]);

  const loadPickerPage = useCallback((query: string, page: number) => {
    if (pickerDebounceRef.current) clearTimeout(pickerDebounceRef.current);
    pickerDebounceRef.current = setTimeout(async () => {
      setPickerLoading(true);
      try {
        const result = await api.searchBooksPaged(query, page * PAGE_SIZE, PAGE_SIZE);
        setPickerResults(result.data);
        setPickerCount(result.count);
      } catch { setPickerResults([]); setPickerCount(0); }
      finally { setPickerLoading(false); }
    }, 300);
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    setPickerPage(0);
    loadPickerPage(pickerQuery, 0);
    return () => { if (pickerDebounceRef.current) clearTimeout(pickerDebounceRef.current); };
  }, [pickerQuery, pickerOpen, loadPickerPage]);

  useEffect(() => {
    if (!pickerOpen) return;
    loadPickerPage(pickerQuery, pickerPage);
    return () => { if (pickerDebounceRef.current) clearTimeout(pickerDebounceRef.current); };
  }, [pickerPage]);

  // Load registration settings
  useEffect(() => {
    api.getClubRegistration(club.id)
      .then(data => {
        if (data.settings) setRegSettings(data.settings);
      })
      .catch(() => {});
  }, [club.id]);

  // Load current response visibility settings
  useEffect(() => {
    api.getClub(club.id)
      .then(data => {
        const s = data?.settings;
        if (s) {
          setAllowStudentsSetVisibility(s.allow_students_set_visibility ?? false);
          setResponsesVisibleToAll(s.responses_visible_to_all ?? false);
        }
      })
      .catch(() => {});
  }, [club.id]);

  async function handleSaveVisibility() {
    setVisSaving(true);
    try {
      await api.updateClubSettings(club.id, {
        allow_students_set_visibility: allowStudentsSetVisibility,
        responses_visible_to_all: responsesVisibleToAll,
      });
      setVisSaved(true);
      setTimeout(() => setVisSaved(false), 2500);
    } catch (err: any) {
      console.error('Failed to save visibility settings:', err);
    } finally {
      setVisSaving(false);
    }
  }

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
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-muted" />
            <h2 className="font-semibold text-theme">Books</h2>
            {books.length > 0 && (
              <span className="text-xs font-medium text-muted bg-strong/10 px-2 py-0.5 rounded-full">{books.length}</span>
            )}
          </div>
          <button
            onClick={() => { setPickerOpen(true); setPickerQuery(''); setPickerPage(0); }}
            className="flex items-center gap-1.5 text-xs theme-button-primary px-3 py-1.5 rounded-lg"
          >
            <Plus className="h-3.5 w-3.5" /> Add Books
          </button>
        </div>

        {bookError && <p className="text-xs text-red-500">{bookError}</p>}

        {/* Selected books list */}
        {books.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">No books added yet. Click "Add Books" to get started.</p>
        ) : (
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
      </div>

      {/* ── Book Picker Modal ─────────────────────────────────── */}
      {pickerOpen && (() => {
        const addedIds = new Set(books.map(b => b.book_id));
        const totalPages = Math.ceil(pickerCount / PAGE_SIZE);
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-strong/10 flex-shrink-0">
                <div>
                  <h3 className="font-semibold text-theme text-lg">Add Books</h3>
                  {pickerCount > 0 && (
                    <p className="text-xs text-muted mt-0.5">{pickerCount.toLocaleString()} book{pickerCount !== 1 ? 's' : ''} found</p>
                  )}
                </div>
                <button onClick={() => setPickerOpen(false)} className="text-muted hover:text-theme transition-colors p-1 rounded-lg hover:bg-strong/10">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Search */}
              <div className="px-5 py-3 border-b border-strong/10 flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
                  <input
                    type="text"
                    autoFocus
                    className="w-full theme-input rounded-xl pl-9 pr-9 py-2.5 text-sm"
                    placeholder="Search books by title..."
                    value={pickerQuery}
                    onChange={e => setPickerQuery(e.target.value)}
                  />
                  {pickerQuery && (
                    <button onClick={() => setPickerQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-theme">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Grid */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {pickerLoading ? (
                  <div className="flex items-center justify-center h-48 text-muted text-sm">Loading...</div>
                ) : pickerResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted">
                    <BookOpen className="h-8 w-8 opacity-30" />
                    <p className="text-sm">{pickerQuery ? 'No books match your search' : 'No books available'}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                    {pickerResults.map(book => {
                      const isAdded = addedIds.has(book.id);
                      const isAdding = bookAdding === book.id;
                      return (
                        <button
                          key={book.id}
                          disabled={isAdded || isAdding}
                          onClick={async () => {
                            if (isAdded) return;
                            await handleAddBook(book);
                          }}
                          className={`relative group flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all text-left ${
                            isAdded
                              ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 cursor-default'
                              : 'border-transparent hover:border-violet-300 hover:bg-strong/5 cursor-pointer'
                          }`}
                        >
                          {/* Cover */}
                          <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden flex-shrink-0">
                            {book.cover_image_url ? (
                              <img src={book.cover_image_url} alt={book.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center">
                                <BookOpen className="h-5 w-5 text-white" />
                              </div>
                            )}
                            {/* Added overlay */}
                            {isAdded && (
                              <div className="absolute inset-0 bg-emerald-600/50 flex items-center justify-center">
                                <div className="bg-white rounded-full p-1 shadow-lg">
                                  <Check className="h-5 w-5 text-emerald-600" />
                                </div>
                              </div>
                            )}
                            {/* Adding spinner */}
                            {isAdding && (
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                            {/* Hover add badge */}
                            {!isAdded && !isAdding && (
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                                <div className="bg-white rounded-full p-1">
                                  <Plus className="h-4 w-4 text-violet-600" />
                                </div>
                              </div>
                            )}
                          </div>
                          {/* Title */}
                          <p className={`text-[11px] font-medium text-center leading-tight line-clamp-2 w-full ${isAdded ? 'text-emerald-600 dark:text-emerald-400' : 'text-theme'}`}>
                            {book.title}
                          </p>
                          {isAdded && (
                            <span className="text-[10px] font-semibold text-emerald-500 flex items-center gap-0.5">
                              <Check className="h-2.5 w-2.5" /> Added
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pagination footer */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-3 border-t border-strong/10 flex-shrink-0">
                  <button
                    disabled={pickerPage === 0}
                    onClick={() => setPickerPage(p => p - 1)}
                    className="flex items-center gap-1 text-sm text-muted hover:text-theme disabled:opacity-30 transition-colors px-2 py-1 rounded-lg hover:bg-strong/10 disabled:hover:bg-transparent"
                  >
                    <ChevronLeft className="h-4 w-4" /> Previous
                  </button>
                  <span className="text-xs text-muted">
                    Page {pickerPage + 1} of {totalPages}
                  </span>
                  <button
                    disabled={pickerPage >= totalPages - 1}
                    onClick={() => setPickerPage(p => p + 1)}
                    className="flex items-center gap-1 text-sm text-muted hover:text-theme disabled:opacity-30 transition-colors px-2 py-1 rounded-lg hover:bg-strong/10 disabled:hover:bg-transparent"
                  >
                    Next <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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

      {/* ── Response Visibility ───────────────────────────────── */}
      <div className="theme-section rounded-xl p-5 space-y-5">
        <div className="flex items-center gap-2 mb-1">
          <Eye className="h-5 w-5 text-muted" />
          <h2 className="font-semibold text-theme">Response Visibility</h2>
        </div>

        <p className="text-sm text-muted -mt-2">
          Control whether students can see each other's answers to book activities.
          By default all responses are private — only you can view them.
        </p>

        {/* Toggle: let students choose */}
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <div className="relative mt-0.5 flex-shrink-0">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={allowStudentsSetVisibility}
              onChange={e => {
                setAllowStudentsSetVisibility(e.target.checked);
                // If this is turned off, all-visible can't be on either
                if (!e.target.checked) setResponsesVisibleToAll(false);
              }}
            />
            <div className="w-9 h-5 rounded-full bg-strong/20 peer-checked:bg-violet-500 transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-theme">Allow students to share their responses</p>
            <p className="text-xs text-muted mt-0.5">
              Students get a per-response toggle to make their answer visible to classmates.
              Responses remain private until each student opts in.
            </p>
          </div>
        </label>

        {/* Toggle: force all visible */}
        <label className={`flex items-start gap-3 cursor-pointer select-none ${!allowStudentsSetVisibility ? 'opacity-40 pointer-events-none' : ''}`}>
          <div className="relative mt-0.5 flex-shrink-0">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={responsesVisibleToAll}
              disabled={!allowStudentsSetVisibility}
              onChange={e => setResponsesVisibleToAll(e.target.checked)}
            />
            <div className="w-9 h-5 rounded-full bg-strong/20 peer-checked:bg-violet-500 transition-colors" />
            <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
          </div>
          <div>
            <p className="text-sm font-medium text-theme">Make all responses visible by default</p>
            <p className="text-xs text-muted mt-0.5">
              All member responses are shown to the class automatically — students don't need to opt in individually.
              Requires "Allow students to share" to be enabled first.
            </p>
          </div>
        </label>

        <div className="flex items-center justify-between pt-1">
          {visSaved
            ? <span className="text-xs text-emerald-500 flex items-center gap-1"><Check className="h-3.5 w-3.5" /> Saved</span>
            : <span />
          }
          <button
            onClick={handleSaveVisibility}
            disabled={visSaving}
            className="theme-button-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50"
          >
            {visSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
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
