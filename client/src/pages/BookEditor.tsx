import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Plus, GripVertical, Edit, Trash2, Eye, Settings, ChevronLeft, Save } from 'lucide-react';
import api from '../lib/api';
import type { Book, Chapter } from '../types';

export default function BookEditor() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
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
        <p className="text-gray-500">Book not found</p>
        <Link to="/dashboard" className="text-primary-600 hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/dashboard" className="text-gray-500 hover:text-gray-700">
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
                {book.subtitle && <p className="text-gray-500">{book.subtitle}</p>}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingBook(true)}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                >
                  <Edit className="h-5 w-5" />
                </button>
                <Link
                  to={`/edit/book/${bookId}/settings`}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                >
                  <Settings className="h-5 w-5" />
                </Link>
                <Link
                  to={`/book/${bookId}`}
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
                >
                  <Eye className="h-5 w-5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between bg-white rounded-lg border p-4 mb-6">
        <div className="flex items-center gap-4">
          <span className={`px-2 py-1 text-sm font-medium rounded ${
            book.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            {book.status}
          </span>
          <span className="text-sm text-gray-500">
            {chapters.length} chapters
          </span>
        </div>
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
      </div>

      {/* Chapters */}
      <div className="bg-white rounded-lg border">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">Chapters</h2>
          <button
            onClick={() => setShowNewChapter(true)}
            className="flex items-center gap-1 text-primary-600 hover:text-primary-700 text-sm font-medium"
          >
            <Plus className="h-4 w-4" />
            Add Chapter
          </button>
        </div>

        {chapters.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <p className="mb-4">No chapters yet</p>
            <button
              onClick={() => setShowNewChapter(true)}
              className="inline-flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" />
              Create First Chapter
            </button>
          </div>
        ) : (
          <div className="divide-y">
            {chapters.map((chapter, index) => (
              <div key={chapter.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                <GripVertical className="h-5 w-5 text-gray-400 cursor-move" />
                <div className="flex-1">
                  <Link
                    to={`/edit/book/${bookId}/chapter/${chapter.id}`}
                    className="font-medium hover:text-primary-600"
                  >
                    Chapter {index + 1}: {chapter.title}
                  </Link>
                  <div className="flex gap-3 text-sm text-gray-500">
                    <span>{chapter.word_count || 0} words</span>
                    <span>{chapter.estimated_read_time_minutes || 1} min read</span>
                    <span className={chapter.status === 'published' ? 'text-green-600' : 'text-yellow-600'}>
                      {chapter.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    to={`/edit/book/${bookId}/chapter/${chapter.id}`}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  >
                    <Edit className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => handleDeleteChapter(chapter.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
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
        className="w-full text-2xl font-bold border-b border-gray-300 focus:border-primary-500 focus:outline-none py-1"
        placeholder="Book Title"
      />
      <input
        type="text"
        value={subtitle}
        onChange={(e) => setSubtitle(e.target.value)}
        className="w-full text-gray-500 border-b border-gray-200 focus:border-primary-500 focus:outline-none py-1"
        placeholder="Subtitle (optional)"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        className="w-full text-sm border rounded p-2 focus:border-primary-500 focus:outline-none"
        rows={2}
        placeholder="Description"
      />
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ title, subtitle, description })}
          disabled={saving}
          className="flex items-center gap-1 bg-primary-600 text-white px-3 py-1 rounded text-sm hover:bg-primary-700 disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded text-sm"
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
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
        <h2 className="text-lg font-bold mb-4">New Chapter</h2>
        <form onSubmit={(e) => { e.preventDefault(); onCreate(title); }}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
            placeholder="Chapter Title"
            autoFocus
            required
          />
          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
