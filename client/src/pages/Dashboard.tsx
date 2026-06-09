import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Edit, Trash2, Settings, MoreVertical, Upload, Loader2, Globe, Lock, Copy, Check, Users, LayoutDashboard } from 'lucide-react';
import api from '../lib/api';
import type { Book } from '../types';

export default function Dashboard() {
  const [books, setBooks] = useState<Book[]>([]);
  const [collaboratingBooks, setCollaboratingBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewBookModal, setShowNewBookModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadBooks();
  }, []);

  async function loadBooks() {
    try {
      const [ownBooks, collabBooks] = await Promise.all([
        api.getMyBooks(),
        api.getCollaboratingBooks().catch(() => []),
      ]);
      setBooks(ownBooks);
      setCollaboratingBooks(collabBooks);
    } catch (err) {
      console.error('Failed to load books:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteBook(id: string) {
    if (!confirm('Are you sure you want to delete this book? This cannot be undone.')) {
      return;
    }

    try {
      await api.deleteBook(id);
      setBooks(books.filter(b => b.id !== id));
    } catch (err) {
      console.error('Failed to delete book:', err);
    }
  }

  function handleCoverUpdate(bookId: string, coverUrl: string) {
    setBooks(books.map(b =>
      b.id === bookId ? { ...b, cover_image_url: coverUrl } : b
    ));
  }

  function handleBookUpdate(updated: Book) {
    setBooks(books.map(b => b.id === updated.id ? updated : b));
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-theme theme-title">My Books</h1>
          <p className="text-muted mt-1">Create and manage your interactive books</p>
        </div>
        <button
          onClick={() => setShowNewBookModal(true)}
          className="flex items-center gap-2 theme-button-primary px-4 py-2 rounded-lg font-medium self-start sm:self-auto"
        >
          <Plus className="h-5 w-5" />
          New Book
        </button>
      </div>

      {/* Books Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-strong"></div>
        </div>
      ) : books.length === 0 ? (
        <div className="text-center py-12 theme-section border-dashed">
          <BookOpen className="h-12 w-12 text-muted mx-auto mb-4" />
          <h3 className="text-lg font-medium text-theme mb-2">No books yet</h3>
          <p className="text-muted mb-4">Get started by creating your first book</p>
          <button
            onClick={() => setShowNewBookModal(true)}
            className="inline-flex items-center gap-2 theme-button-primary px-4 py-2 rounded-lg font-medium"
          >
            <Plus className="h-5 w-5" />
            Create Book
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onDelete={() => handleDeleteBook(book.id)}
              onCoverUpdate={handleCoverUpdate}
              onUpdate={handleBookUpdate}
            />
          ))}
        </div>
      )}

      {/* Collaborating Books */}
      {collaboratingBooks.length > 0 && (
        <div className="mt-10">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-theme">Collaborating On</h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {collaboratingBooks.map((book) => (
              <div key={book.id} className="theme-section rounded-xl p-4 flex gap-4">
                {book.cover_image_url ? (
                  <img src={book.cover_image_url} alt={book.title} className="w-16 h-20 object-cover rounded-lg flex-shrink-0" />
                ) : (
                  <div className="w-16 h-20 bg-surface-hover rounded-lg flex items-center justify-center flex-shrink-0">
                    <BookOpen className="h-6 w-6 text-muted" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-theme truncate">{book.title}</p>
                  {book.author && (
                    <p className="text-xs text-muted mt-0.5">by {book.author.display_name}</p>
                  )}
                  {(book as Book & { userRole?: string }).userRole && (
                    <span className="inline-block mt-1.5 text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium capitalize">
                      {(book as Book & { userRole?: string }).userRole}
                    </span>
                  )}
                  <Link
                    to={`/edit/book/${book.id}`}
                    className="flex items-center gap-1 mt-2 text-xs text-accent hover:underline"
                  >
                    <Edit className="h-3 w-3" />
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Book Clubs Quick Link */}
      <div className="mt-10">
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-theme">Book Clubs</h2>
        </div>
        <Link
          to="/clubs"
          className="flex items-center gap-4 theme-section rounded-xl p-4 hover:shadow-md transition-shadow group w-full sm:w-fit"
        >
          <div className="h-12 w-12 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <Users className="h-6 w-6 text-indigo-400" />
          </div>
          <div>
            <p className="font-medium text-theme group-hover:text-accent transition-colors">My Clubs</p>
            <p className="text-xs text-muted">Read and discuss books with others</p>
          </div>
        </Link>
      </div>

      {/* New Book Modal */}
      {showNewBookModal && (
        <NewBookModal
          onClose={() => setShowNewBookModal(false)}
          onCreate={(book) => {
            setShowNewBookModal(false);
            navigate(`/edit/book/${book.id}`);
          }}
        />
      )}
    </div>
  );
}

function BookCard({ book, onDelete, onCoverUpdate, onUpdate }: { book: Book; onDelete: () => void; onCoverUpdate: (bookId: string, coverUrl: string) => void; onUpdate: (book: Book) => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showCoverUpload, setShowCoverUpload] = useState(false);
  const [togglingVisibility, setTogglingVisibility] = useState(false);
  const [copied, setCopied] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMenu) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const bookUrl = `${window.location.origin}/book/${book.id}`;

  async function handleToggleVisibility() {
    setTogglingVisibility(true);
    try {
      const newVisibility = book.visibility === 'public' ? 'private' : 'public';
      const newStatus = newVisibility === 'public' && book.status === 'draft' ? 'published' : book.status;
      const updated = await api.updateBook(book.id, { visibility: newVisibility, status: newStatus });
      onUpdate(updated);
    } catch (err) {
      console.error('Failed to update visibility:', err);
    } finally {
      setTogglingVisibility(false);
    }
  }

  function handleCopyUrl() {
    navigator.clipboard.writeText(bookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }

    setUploadingCover(true);
    try {
      const { cover_image_url } = await api.uploadBookCover(book.id, file);
      onCoverUpdate(book.id, cover_image_url);
    } catch (err) {
      console.error('Failed to upload cover:', err);
      alert('Failed to upload cover image');
    } finally {
      setUploadingCover(false);
      setShowCoverUpload(false);
      if (coverInputRef.current) {
        coverInputRef.current.value = '';
      }
    }
  }

  return (
    <div className="theme-card rounded-xl overflow-hidden">
      {/* Cover */}
      <Link to={`/edit/book/${book.id}`}>
        <div
          className="aspect-[3/2] bg-gradient-to-br from-surface-hover to-surface flex items-center justify-center relative group cursor-pointer"
          onMouseEnter={() => setShowCoverUpload(true)}
          onMouseLeave={() => !uploadingCover && setShowCoverUpload(false)}
          onClick={(e) => { e.preventDefault(); coverInputRef.current?.click(); }}
        >
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            onChange={handleCoverUpload}
            className="hidden"
          />
          {book.cover_image_url ? (
            <img
              src={book.cover_image_url}
              alt={book.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <BookOpen className="h-12 w-12 text-accent opacity-30" />
          )}
          {(showCoverUpload || uploadingCover) && (
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center">
              {uploadingCover ? (
                <Loader2 className="h-6 w-6 text-white animate-spin" />
              ) : (
                <Upload className="h-6 w-6 text-white opacity-80" />
              )}
            </div>
          )}
        </div>
      </Link>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/edit/book/${book.id}`} className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate text-theme">{book.title}</h3>
            {book.subtitle && (
              <p className="text-xs text-muted truncate mt-0.5">{book.subtitle}</p>
            )}
          </Link>

          {/* Three-dots menu */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 -mr-1 text-muted hover:text-theme rounded-lg transition-colors"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 w-48 theme-modal rounded-xl shadow-lg z-10 overflow-hidden py-1">
                <Link
                  to={`/edit/book/${book.id}/settings`}
                  onClick={() => setShowMenu(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm text-theme hover:bg-surface-hover"
                >
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </Link>
                {book.visibility === 'public' && (
                  <button
                    onClick={() => { setShowMenu(false); handleCopyUrl(); }}
                    className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-theme hover:bg-surface-hover"
                  >
                    {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied ? 'Copied!' : 'Copy Link'}
                  </button>
                )}
                <div className="my-1 border-t border-[var(--color-border)]" />
                <button
                  onClick={() => { setShowMenu(false); onDelete(); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2 text-sm text-red-500 hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center justify-between mt-2 mb-3">
          <span className="text-xs text-muted">
            {book.chapters?.length || 0} {book.chapters?.length === 1 ? 'chapter' : 'chapters'}
          </span>
          <button
            onClick={handleToggleVisibility}
            disabled={togglingVisibility}
            className={`flex items-center gap-1 text-xs font-medium transition-colors ${
              book.visibility === 'public' ? 'text-green-600' : 'text-muted'
            }`}
          >
            {togglingVisibility ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : book.visibility === 'public' ? (
              <Globe className="h-3 w-3" />
            ) : (
              <Lock className="h-3 w-3" />
            )}
            {book.visibility === 'public' ? 'Public' : 'Private'}
          </button>
        </div>

        {/* Edit / View / Dashboard buttons */}
        <div className="flex gap-2">
          <Link
            to={`/edit/book/${book.id}`}
            className="flex-1 text-center py-1.5 theme-button-primary rounded-lg font-medium text-sm"
          >
            Edit
          </Link>
          <Link
            to={`/book/${book.id}`}
            className="flex-1 text-center py-1.5 theme-button-secondary rounded-lg font-medium text-sm"
          >
            View
          </Link>
          <Link
            to={`/edit/book/${book.id}/dashboard`}
            className="flex items-center justify-center px-2.5 py-1.5 theme-button-secondary rounded-lg"
            title="Dashboard"
          >
            <LayoutDashboard className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function NewBookModal({ onClose, onCreate }: { onClose: () => void; onCreate: (book: Book) => void }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const book = await api.createBook({ title, subtitle, description });
      onCreate(book);
    } catch (err: any) {
      setError(err.message || 'Failed to create book');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="theme-modal rounded-lg max-w-md w-full mx-4">
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4 text-theme theme-title">Create New Book</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border-2 border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-theme mb-1">
                Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 theme-input rounded-md"
                placeholder="My Amazing Book"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-theme mb-1">
                Subtitle
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full px-3 py-2 theme-input rounded-md"
                placeholder="A subtitle for your book"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-theme mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 theme-input rounded-md"
                placeholder="What is your book about?"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 theme-button-secondary rounded-md"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-4 py-2 theme-button-primary rounded-md disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Book'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
