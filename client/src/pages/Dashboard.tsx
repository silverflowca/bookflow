import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Edit, Trash2, Eye, Settings, MoreVertical, Upload, Image, Loader2 } from 'lucide-react';
import api from '../lib/api';
import type { Book } from '../types';

export default function Dashboard() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewBookModal, setShowNewBookModal] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadBooks();
  }, []);

  async function loadBooks() {
    try {
      const data = await api.getMyBooks();
      setBooks(data);
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-theme theme-title">My Books</h1>
          <p className="text-muted mt-2">Create and manage your interactive books</p>
        </div>
        <button
          onClick={() => setShowNewBookModal(true)}
          className="flex items-center gap-2 theme-button-primary px-4 py-2 rounded-lg font-medium"
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
            />
          ))}
        </div>
      )}

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

function BookCard({ book, onDelete, onCoverUpdate }: { book: Book; onDelete: () => void; onCoverUpdate: (bookId: string, coverUrl: string) => void }) {
  const [showMenu, setShowMenu] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showCoverUpload, setShowCoverUpload] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const statusColors = {
    draft: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
    published: 'bg-green-100 text-green-800 border border-green-300',
    archived: 'bg-surface-hover text-muted border border-theme'
  };

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
    <div className="theme-card rounded-lg overflow-hidden">
      {/* Cover */}
      <div
        className="aspect-[3/2] bg-gradient-to-br from-surface-hover to-surface flex items-center justify-center border-b-2 border-theme relative group cursor-pointer"
        onMouseEnter={() => setShowCoverUpload(true)}
        onMouseLeave={() => !uploadingCover && setShowCoverUpload(false)}
        onClick={() => coverInputRef.current?.click()}
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
          <BookOpen className="h-16 w-16 text-accent opacity-50" />
        )}

        {/* Upload Overlay */}
        {(showCoverUpload || uploadingCover) && (
          <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center transition-opacity">
            {uploadingCover ? (
              <>
                <Loader2 className="h-8 w-8 text-white animate-spin" />
                <span className="text-white text-sm mt-2">Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="h-8 w-8 text-white" />
                <span className="text-white text-sm mt-2">
                  {book.cover_image_url ? 'Change Cover' : 'Upload Cover'}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg truncate text-theme">{book.title}</h3>
            {book.subtitle && (
              <p className="text-sm text-muted truncate">{book.subtitle}</p>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-1 text-muted hover:text-theme rounded transition-colors"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 mt-1 w-48 theme-modal rounded-md z-10">
                <Link
                  to={`/edit/book/${book.id}`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-theme hover:bg-surface-hover"
                >
                  <Edit className="h-4 w-4" />
                  Edit
                </Link>
                <Link
                  to={`/book/${book.id}`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-theme hover:bg-surface-hover"
                >
                  <Eye className="h-4 w-4" />
                  Preview
                </Link>
                <Link
                  to={`/edit/book/${book.id}/settings`}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-theme hover:bg-surface-hover"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
                <button
                  onClick={() => { setShowMenu(false); onDelete(); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span className={`px-2 py-0.5 text-xs font-medium rounded ${statusColors[book.status]}`}>
            {book.status}
          </span>
          <span className="text-xs text-muted">
            {book.chapters?.length || 0} chapters
          </span>
        </div>

        <div className="flex gap-2 mt-4">
          <Link
            to={`/edit/book/${book.id}`}
            className="flex-1 text-center py-2 theme-button-primary rounded font-medium text-sm"
          >
            Edit
          </Link>
          <Link
            to={`/book/${book.id}`}
            className="flex-1 text-center py-2 theme-button-secondary rounded font-medium text-sm"
          >
            View
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
