import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Plus, GripVertical, Edit, Trash2, Eye, Settings, ChevronLeft, Save, Users, History, MessageSquare, ChevronDown, ChevronUp, Loader2, Download, Send, Globe, Lock, Copy, Check, X, Mail } from 'lucide-react';
import api from '../lib/api';
import type { Book, Chapter, BookCollaborator, CollaboratorRole, ReviewRequest, BookComment } from '../types';
import CollaboratorBadges from '../components/collaboration/CollaboratorBadges';
import ReviewBanner from '../components/review/ReviewBanner';

// ── Publish Modal ─────────────────────────────────────────────────────────────
function PublishModal({ book, bookId, onClose, onPublished, onUnpublished }: {
  book: Book;
  bookId: string;
  onClose: () => void;
  onPublished: (b: Partial<Book>) => void;
  onUnpublished: (b: Partial<Book>) => void;
}) {
  const origin = window.location.origin;
  const publicUrl = book.slug ? `${origin}/read/${book.slug}` : null;
  const shareUrl = book.share_token ? `${origin}/read/share/${book.share_token}` : null;
  const directUrl = `${origin}/book/${bookId}`;

  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState<{ ok: boolean; text: string } | null>(null);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const r = await api.publishBook(bookId);
      onPublished(r);
    } finally { setPublishing(false); }
  };

  const handleUnpublish = async () => {
    if (!confirm('Unpublish this book? Public readers will no longer be able to access it.')) return;
    setPublishing(true);
    try {
      const r = await api.unpublishBook(bookId);
      onUnpublished(r);
    } finally { setPublishing(false); }
  };

  const handleInvite = async () => {
    const emails = inviteEmails.split(/[\s,;]+/).map(e => e.trim()).filter(Boolean);
    if (!emails.length) return;
    setInviting(true);
    try {
      const r = await api.inviteReaders(bookId, emails, inviteMsg);
      if (r.manual) {
        setInviteSent({ ok: true, text: `No email server configured. Share this link manually: ${r.url}` });
      } else {
        setInviteSent({ ok: true, text: `Invite sent to ${r.sent} ${r.sent === 1 ? 'person' : 'people'}!` });
      }
      setInviteEmails('');
      setInviteMsg('');
    } catch (err: any) {
      setInviteSent({ ok: false, text: err.message || 'Failed to send invite' });
    } finally { setInviting(false); }
  };

  const isPublished = book.status === 'published';

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between ${isPublished ? 'bg-green-600' : 'bg-accent'}`}>
          <div className="flex items-center gap-2 text-white">
            {isPublished ? <Globe className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            <span className="font-bold text-lg">{isPublished ? 'Published' : 'Publish Book'}</span>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="h-5 w-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status + action */}
          {!isPublished ? (
            <div>
              <p className="text-muted text-sm mb-4">Publishing makes your book publicly accessible via a unique URL. You can unpublish at any time.</p>
              <button onClick={handlePublish} disabled={publishing} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {publishing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Globe className="h-5 w-5" />}
                {publishing ? 'Publishing…' : 'Publish Now'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Public URL */}
              {publicUrl && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-green-600 mb-1.5">
                    <Globe className="h-3.5 w-3.5" /> Public URL
                  </div>
                  <div className="flex gap-2">
                    <a href={publicUrl} target="_blank" rel="noreferrer" className="flex-1 text-xs bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 px-3 py-2 rounded-lg truncate hover:underline">
                      {publicUrl}
                    </a>
                    <button onClick={() => copy(publicUrl, 'public')} className="px-3 py-2 rounded-lg border border-theme text-muted hover:bg-surface-hover text-xs shrink-0">
                      {copied === 'public' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Private share link */}
              {shareUrl && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted mb-1.5">
                    <Lock className="h-3.5 w-3.5" /> Private share link (no login required)
                  </div>
                  <div className="flex gap-2">
                    <input readOnly value={shareUrl} className="flex-1 text-xs theme-input px-3 py-2 rounded-lg truncate" />
                    <button onClick={() => copy(shareUrl, 'share')} className="px-3 py-2 rounded-lg border border-theme text-muted hover:bg-surface-hover text-xs shrink-0">
                      {copied === 'share' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Direct authenticated link */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted mb-1.5">
                  Direct link (for signed-in users)
                </div>
                <div className="flex gap-2">
                  <input readOnly value={directUrl} className="flex-1 text-xs theme-input px-3 py-2 rounded-lg truncate" />
                  <button onClick={() => copy(directUrl, 'direct')} className="px-3 py-2 rounded-lg border border-theme text-muted hover:bg-surface-hover text-xs shrink-0">
                    {copied === 'direct' ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Email invite */}
          {isPublished && (
            <div className="border-t border-theme pt-5">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-theme mb-3">
                <Mail className="h-4 w-4 text-accent" /> Invite Readers by Email
              </div>
              <input
                className="w-full theme-input rounded-lg px-3 py-2 text-sm mb-2"
                placeholder="reader@example.com, another@example.com"
                value={inviteEmails}
                onChange={e => setInviteEmails(e.target.value)}
              />
              <textarea
                className="w-full theme-input rounded-lg px-3 py-2 text-sm resize-none mb-2"
                rows={2}
                placeholder="Personal message (optional)"
                value={inviteMsg}
                onChange={e => setInviteMsg(e.target.value)}
              />
              {inviteSent && (
                <p className={`text-xs mb-2 ${inviteSent.ok ? 'text-green-600' : 'text-red-500'}`}>{inviteSent.text}</p>
              )}
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmails.trim()}
                className="w-full theme-button-primary py-2 rounded-lg text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {inviting ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          )}

          {/* Unpublish + go to stores */}
          <div className="flex gap-2 pt-1">
            {isPublished && (
              <button onClick={handleUnpublish} disabled={publishing} className="flex-1 px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
                Unpublish
              </button>
            )}
            <Link to={`/edit/book/${bookId}/submit`} onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-theme text-muted text-sm font-medium hover:bg-surface-hover transition-colors text-center flex items-center justify-center gap-1.5">
              <Send className="h-3.5 w-3.5" /> Submit to Stores
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const [expandedChapterComments, setExpandedChapterComments] = useState<Set<string>>(new Set());
  const [chapterComments, setChapterComments] = useState<Record<string, BookComment[]>>({});
  const [chapterCommentsLoading, setChapterCommentsLoading] = useState<Record<string, boolean>>({});
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [chapterCommentsPage, setChapterCommentsPage] = useState<Record<string, number>>({});
  const PAGE_SIZE = 5;

  const toggleChapterComments = useCallback(async (chapterId: string) => {
    setExpandedChapterComments(prev => {
      const next = new Set(prev);
      if (next.has(chapterId)) {
        next.delete(chapterId);
      } else {
        next.add(chapterId);
      }
      return next;
    });

    // Fetch comments if not yet loaded
    if (!chapterComments[chapterId]) {
      setChapterCommentsLoading(prev => ({ ...prev, [chapterId]: true }));
      try {
        const data = await api.getChapterComments(chapterId);
        setChapterComments(prev => ({ ...prev, [chapterId]: data }));
        setChapterCommentsPage(prev => ({ ...prev, [chapterId]: 1 }));
      } catch {
        setChapterComments(prev => ({ ...prev, [chapterId]: [] }));
      } finally {
        setChapterCommentsLoading(prev => ({ ...prev, [chapterId]: false }));
      }
    }
  }, [chapterComments]);

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

  async function handleExport(format: 'json' | 'pdf' | 'epub' | 'docx') {
    if (!bookId) return;
    setExporting(format);
    setShowExportMenu(false);
    try {
      if (format === 'json') {
        await api.exportJson(bookId);
      } else {
        const methodMap = { pdf: 'exportPdf', epub: 'exportEpub', docx: 'exportDocx' } as const;
        const result = await api[methodMap[format]](bookId);
        if (result?.download_url) window.open(result.download_url, '_blank');
      }
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(null);
    }
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
    <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
      {/* Header */}
      <div className="flex items-start gap-3 mb-6">
        <Link to="/dashboard" className="text-muted hover:text-theme mt-1 flex-shrink-0">
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <div className="flex-1 min-w-0">
          {editingBook ? (
            <EditBookForm
              book={book}
              onSave={handleSaveBook}
              onCancel={() => setEditingBook(false)}
              saving={saving}
            />
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold truncate">{book.title}</h1>
                {book.subtitle && <p className="text-muted text-sm truncate">{book.subtitle}</p>}
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[userRole].className}`}>
                  {ROLE_BADGE[userRole].label}
                </span>
                {collaborators.length > 0 && (
                  <CollaboratorBadges collaborators={collaborators} bookId={bookId!} />
                )}
                {userRole === 'owner' && (
                  <Link to={`/edit/book/${bookId}/collaborators`} className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded" title="Collaborators">
                    <Users className="h-5 w-5" />
                  </Link>
                )}
                <Link to={`/edit/book/${bookId}/versions`} className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded" title="Version history">
                  <History className="h-5 w-5" />
                </Link>
                {userRole === 'owner' && (
                  <button onClick={() => setEditingBook(true)} className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded">
                    <Edit className="h-5 w-5" />
                  </button>
                )}
                {userRole === 'owner' && (
                  <Link to={`/edit/book/${bookId}/settings`} className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded">
                    <Settings className="h-5 w-5" />
                  </Link>
                )}
                <Link to={`/book/${bookId}`} className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded">
                  <Eye className="h-5 w-5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface rounded-lg border-theme border p-4 mb-6">
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
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(v => !v)}
              disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-2 rounded font-medium text-sm bg-gray-100 text-gray-700 hover:bg-gray-200"
            >
              {exporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              {exporting ? `Exporting ${exporting.toUpperCase()}…` : 'Export'}
              <ChevronDown size={13} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                {(['json', 'pdf', 'epub', 'docx'] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => handleExport(fmt)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50"
                  >
                    {fmt === 'json' ? 'Book JSON (backup)' : fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Publish button → opens modal */}
          {userRole === 'owner' && (
            <button
              onClick={() => setShowPublishModal(true)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded font-medium text-sm transition-colors ${
                book.status === 'published'
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {book.status === 'published' ? <><Globe size={14} /> Published</> : <><Globe size={14} /> Publish</>}
            </button>
          )}
        </div>
      </div>

      {/* Publish modal */}
      {showPublishModal && book && (
        <PublishModal
          book={book}
          bookId={bookId!}
          onClose={() => setShowPublishModal(false)}
          onPublished={(b) => { setBook(prev => prev ? { ...prev, ...b } : prev); }}
          onUnpublished={(b) => { setBook(prev => prev ? { ...prev, ...b } : prev); }}
        />
      )}

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
            {chapters.map((chapter, index) => {
              const isExpanded = expandedChapterComments.has(chapter.id);
              const comments = chapterComments[chapter.id] || [];
              const isLoadingComments = chapterCommentsLoading[chapter.id];
              const page = chapterCommentsPage[chapter.id] || 1;
              const visibleComments = comments.slice(0, page * PAGE_SIZE);
              const hasMore = visibleComments.length < comments.length;

              return (
                <div key={chapter.id}>
                  <div className="flex items-center gap-4 p-4 hover:bg-surface-hover">
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
                      <button
                        onClick={() => toggleChapterComments(chapter.id)}
                        className={`flex items-center gap-1 px-2 py-1.5 rounded text-sm transition-colors ${
                          isExpanded
                            ? 'bg-accent/10 text-accent'
                            : 'text-muted hover:text-theme hover:bg-surface-hover'
                        }`}
                        title="Show comments"
                      >
                        <MessageSquare className="h-4 w-4" />
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
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

                  {/* Comments accordion */}
                  {isExpanded && (
                    <div className="border-t border-theme bg-surface/50 px-4 py-3">
                      {isLoadingComments ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-muted" />
                        </div>
                      ) : comments.length === 0 ? (
                        <p className="text-sm text-muted text-center py-3">No comments on this chapter</p>
                      ) : (
                        <div className="space-y-2">
                          {visibleComments.map(comment => (
                            <Link
                              key={comment.id}
                              to={`/edit/book/${bookId}/chapter/${chapter.id}?comments=1`}
                              className="block rounded-lg border border-theme p-3 hover:bg-surface-hover transition-colors"
                            >
                              {comment.anchor_text && (
                                <p className="text-xs text-yellow-800 bg-yellow-50 border border-yellow-200 rounded px-2 py-0.5 mb-1.5 truncate italic">
                                  "{comment.anchor_text}"
                                </p>
                              )}
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-accent shrink-0">
                                  {comment.author?.display_name || 'User'}
                                </span>
                                <p className="text-xs text-muted line-clamp-2 flex-1">
                                  {comment.body}
                                </p>
                              </div>
                              {comment.status === 'resolved' && (
                                <span className="text-xs text-green-600 mt-1 inline-block">✓ Resolved</span>
                              )}
                            </Link>
                          ))}
                          {hasMore && (
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                setChapterCommentsPage(prev => ({
                                  ...prev,
                                  [chapter.id]: (prev[chapter.id] || 1) + 1,
                                }));
                              }}
                              className="w-full text-xs text-accent hover:underline py-2"
                            >
                              Load more ({comments.length - visibleComments.length} remaining)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
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
