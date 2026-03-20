import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Plus, GripVertical, Edit, Trash2, Eye, Settings, ChevronLeft, Save, Users, History } from 'lucide-react';
import api from '../lib/api';
import type { Book, Chapter, BookCollaborator, CollaboratorRole, ReviewRequest } from '../types';
import CollaboratorBadges from '../components/collaboration/CollaboratorBadges';
import ReviewBanner from '../components/review/ReviewBanner';

const ROLE_BADGE: Record<CollaboratorRole, { label: string; className: string }> = {
  owner:    { label: 'Owner',    className: 'bg-purple-100 text-purple-800' },
  author:   { label: 'Author',   className: 'bg-blue-100 text-blue-800' },
  editor:   { label: 'Editor',   className: 'bg-green-100 text-green-800' },
  reviewer: { label: 'Reviewer', className: 'bg-yellow-100 text-yellow-800' },
};

export default function BookEditor() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [collaborators, setCollaborators] = useState<BookCollaborator[]>([]);
  const [userRole, setUserRole] = useState<CollaboratorRole>('owner');
  const [latestReview, setLatestReview] = useState<ReviewRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingBook, setEditingBook] = useState(false);
  const [showNewChapter, setShowNewChapter] = useState(false);

  useEffect(() => {
    if (bookId) {
      loadBook();
    }
  }, [bookId]);

  async function loadBook() {
    try {
      const bookData = await api.getBook(bookId!);
      setBook(bookData);
      setChapters(bookData.chapters || []);
      // Load current user's role (works for all collaborators)
      api.getMyRole(bookId!).then(r => setUserRole(r.role)).catch(() => {});
      // Load collaborators list (owner only — silently fail for non-owners)
      api.getCollaborators(bookId!).then(setCollaborators).catch(() => {});
      // Load latest review request
      api.getReviews(bookId!).then(reviews => {
        if (reviews.length > 0) setLatestReview(reviews[0]);
      }).catch(() => {});
    } catch (err) {
      console.error('Failed to load book:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveBook(data: Partial<Book>) {
    if (!bookId) return;
    setSaving(true);
    try {
      const updated = await api.updateBook(bookId, data);
      setBook({ ...book!, ...updated });
      setEditingBook(false);
    } catch (err) {
      console.error('Failed to save book:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateChapter(title: string) {
    if (!bookId) return;
    try {
      const chapter = await api.createChapter(bookId, { title });
      setChapters([...chapters, chapter]);
      setShowNewChapter(false);
      navigate(`/edit/book/${bookId}/chapter/${chapter.id}`);
    } catch (err) {
      console.error('Failed to create chapter:', err);
    }
  }

  async function handleDeleteChapter(id: string) {
    if (!confirm('Delete this chapter?')) return;
    try {
      await api.deleteChapter(id);
      setChapters(chapters.filter(c => c.id !== id));
    } catch (err) {
      console.error('Failed to delete chapter:', err);
    }
  }

  async function handlePublish() {
    if (!bookId) return;
    const newStatus = book?.status === 'published' ? 'draft' : 'published';
    await handleSaveBook({ status: newStatus, visibility: newStatus === 'published' ? 'public' : 'private' });
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-muted">Book not found</p>
        <Link to="/dashboard" className="text-accent hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/dashboard" className="text-muted hover:text-theme">
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          {editingBook ? (
            <EditBookForm
              book={book}
              onSave={handleSaveBook}
              onCancel={() => setEditingBook(false)}
              saving={saving}
            />
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{book.title}</h1>
                {book.subtitle && <p className="text-muted">{book.subtitle}</p>}
              </div>
              <div className="flex items-center gap-2">
                {/* My role badge */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[userRole].className}`}>
                  {ROLE_BADGE[userRole].label}
                </span>
                {collaborators.length > 0 && (
                  <CollaboratorBadges collaborators={collaborators} bookId={bookId!} />
                )}
                {userRole === 'owner' && (
                  <Link
                    to={`/edit/book/${bookId}/collaborators`}
                    className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded"
                    title="Collaborators"
                  >
                    <Users className="h-5 w-5" />
                  </Link>
                )}
                <Link
                  to={`/edit/book/${bookId}/versions`}
                  className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded"
                  title="Version history"
                >
                  <History className="h-5 w-5" />
                </Link>
                {userRole === 'owner' && (
                  <button
                    onClick={() => setEditingBook(true)}
                    className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                )}
                {userRole === 'owner' && (
                  <Link
                    to={`/edit/book/${bookId}/settings`}
                    className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded"
                  >
                    <Settings className="h-5 w-5" />
                  </Link>
                )}
                <Link
                  to={`/book/${bookId}`}
                  className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded"
                >
                  <Eye className="h-5 w-5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between bg-surface rounded-lg border-theme border p-4 mb-6">
        <div className="flex items-center gap-4">
          <span className={`px-2 py-1 text-sm font-medium rounded ${
            book.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {book.status}
          </span>
          <span className="text-sm text-muted">
            {chapters.length} chapters
          </span>
        </div>
        {userRole === 'owner' && (
          <button
            onClick={handlePublish}
            disabled={saving}
            className={`px-4 py-2 rounded font-medium ${
              book.status === 'published'
                ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {book.status === 'published' ? 'Unpublish' : 'Publish'}
          </button>
        )}
      </div>

      {/* Review Banner — visible to all collaborators */}
      {['owner', 'author', 'reviewer'].includes(userRole) && (
        <ReviewBanner
          bookId={bookId!}
          reviewStatus={book.review_status || 'none'}
          userRole={userRole}
          latestReview={latestReview}
          onStatusChange={(status) => {
            setBook({ ...book!, review_status: status as Book['review_status'] });
            api.getReviews(bookId!).then(reviews => {
              if (reviews.length > 0) setLatestReview(reviews[0]);
            }).catch(() => {});
          }}
        />
      )}

      {/* Chapters */}
      <div className="theme-section">
        <div className="flex items-center justify-between p-4 border-b border-theme">
          <h2 className="font-semibold">Chapters</h2>
          {['owner', 'author', 'editor'].includes(userRole) && (
            <button
              onClick={() => setShowNewChapter(true)}
              className="flex items-center gap-1 text-accent hover:text-accent text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              Add Chapter
            </button>
          )}
        </div>

        {chapters.length === 0 ? (
          <div className="p-8 text-center text-muted">
            <p className="mb-4">No chapters yet</p>
            <button
              onClick={() => setShowNewChapter(true)}
              className="inline-flex items-center gap-2 theme-button-primary px-4 py-2 rounded"
            >
              <Plus className="h-4 w-4" />
              Create First Chapter
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {chapters.map((chapter, index) => (
              <div key={chapter.id} className="flex items-center gap-4 p-4 hover:bg-surface-hover">
                <GripVertical className="h-5 w-5 text-muted cursor-move" />
                <div className="flex-1">
                  <Link
                    to={`/edit/book/${bookId}/chapter/${chapter.id}`}
                    className="font-medium hover:text-accent"
                  >
                    Chapter {index + 1}: {chapter.title}
                  </Link>
                  <div className="flex gap-3 text-sm text-muted">
                    <span>{chapter.word_count || 0} words</span>
                    <span>{chapter.estimated_read_time_minutes || 1} min read</span>
                    <span className={chapter.status === 'published' ? 'text-green-600' : 'text-yellow-600'}>
                      {chapter.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {['owner', 'author', 'editor'].includes(userRole) && (
                    <Link
                      to={`/edit/book/${bookId}/chapter/${chapter.id}`}
                      className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                  )}
                  {userRole === 'owner' && (
                    <button
                      onClick={() => handleDeleteChapter(chapter.id)}
                      className="p-2 text-muted hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Chapter Modal */}
      {showNewChapter && (
        <NewChapterModal
          onClose={() => setShowNewChapter(false)}
          onCreate={handleCreateChapter}
        />
      )}
    </div>
  );
}

function EditBookForm({
  book,
  onSave,
  onCancel,
  saving
}: {
  book: Book;
  onSave: (data: Partial<Book>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [title, setTitle] = useState(book.title);
  const [subtitle, setSubtitle] = useState(book.subtitle || '');
  const [description, setDescription] = useState(book.description || '');

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full text-2xl font-bold border-b border-theme focus:border-primary-500 focus:outline-none py-1"
        placeholder="Book Title"
      />
      <input
        type="text"
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        className="w-full text-muted border-b border-theme focus:border-primary-500 focus:outline-none py-1"
        placeholder="Subtitle (optional)"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full text-sm theme-input p-2 focus:border-primary-500 focus:outline-none"
        rows={2}
        placeholder="Description"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ title, subtitle, description })}
          disabled={saving}
          className="flex items-center gap-1 theme-button-primary px-3 py-1 rounded text-sm disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-muted hover:bg-surface-hover rounded text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function NewChapterModal({
  onClose,
  onCreate
}: {
  onClose: () => void;
  onCreate: (title: string) => void;
}) {
  const [title, setTitle] = useState('');

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-bold mb-4">New Chapter</h2>
        <form onSubmit={(e) => { e.preventDefault(); onCreate(title); }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 theme-input focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Chapter Title"
            autoFocus
            required
          />
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 theme-button-secondary rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 theme-button-primary rounded"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
