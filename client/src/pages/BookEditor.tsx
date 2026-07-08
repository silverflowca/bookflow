import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Plus, GripVertical, Edit, Trash2, Eye, Settings, ChevronLeft, Save, Users, History, MessageSquare, ChevronDown, ChevronUp, Loader2, Download, Send, Globe, Lock, Copy, Check, X, Mail, BarChart2, Star, Share2, QrCode, ExternalLink, BookOpen } from 'lucide-react';
import QRCode from 'qrcode';
import api from '../lib/api';
import type { Book, Chapter, BookCollaborator, CollaboratorRole, ReviewRequest, BookComment } from '../types';
import CollaboratorBadges from '../components/collaboration/CollaboratorBadges';

function fmtRelative(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Book Share Dropdown ───────────────────────────────────────────────────────
function BookShareDropdown({ book, bookId, onClose }: {
  book: Book;
  bookId: string;
  onClose: () => void;
}) {
  const origin = window.location.origin;
  const bookSlug = book.slug || bookId;
  const bookUrl = `${origin}/bl/${bookSlug}`;

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [qrCopied, setQrCopied] = useState(false);
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState(book.slug || '');
  const [savingSlug, setSavingSlug] = useState(false);
  const [currentSlug, setCurrentSlug] = useState(book.slug || '');
  const [currentBookUrl, setCurrentBookUrl] = useState(bookUrl);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    QRCode.toDataURL(bookUrl, { width: 512, margin: 2 }).then(setQrDataUrl);
    navigator.clipboard.writeText(bookUrl).catch(() => {});
    setCopied('url');
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `qr-book-${currentSlug || bookId}.png`;
    a.click();
  };

  const copyQr = async (url: string) => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob, 'text/plain': new Blob([url], { type: 'text/plain' }) }),
      ]);
    } catch {
      await navigator.clipboard.writeText(url).catch(() => {});
    }
    setQrCopied(true);
    setTimeout(() => setQrCopied(false), 2000);
  };

  const nativeShare = async () => {
    const shareData: ShareData = {
      title: book.title,
      text: book.subtitle ? `${book.title} — ${book.subtitle}` : book.title,
      url: currentBookUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* cancelled */ }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${shareData.text}\n${currentBookUrl}`)}`, '_blank');
    }
  };

  const saveSlug = async () => {
    if (!slugInput.trim()) return;
    setSavingSlug(true);
    try {
      const updated = await api.patchBookSlug(bookId, slugInput.trim());
      setCurrentSlug(updated.slug);
      const newUrl = `${origin}/bl/${updated.slug}`;
      setCurrentBookUrl(newUrl);
      const qr = await QRCode.toDataURL(newUrl, { width: 512, margin: 2 });
      setQrDataUrl(qr);
      setEditingSlug(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to save slug');
    } finally {
      setSavingSlug(false);
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-1 z-50 w-80 max-w-[min(320px,calc(100vw-2rem))] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--color-surface)', backgroundImage: 'none' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-surface-hover">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-accent" />
            <span className="text-sm font-bold text-theme">Book Share: Links &amp; QR Code</span>
          </div>
          <span className="text-xs text-muted pl-6 truncate max-w-[220px]">{book.title}</span>
        </div>
        <button onClick={onClose} className="text-muted hover:text-theme p-1 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* QR + cover */}
        <div className="flex items-start gap-4">
          {qrDataUrl ? (
            <button onClick={() => copyQr(currentBookUrl)} title="Click to copy QR + URL" className="relative group shrink-0 rounded-lg overflow-hidden border border-[var(--color-border)] focus:outline-none">
              <img src={qrDataUrl} alt="Book QR" className="w-24 h-24 block" />
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">
                {qrCopied ? <><Check className="h-4 w-4 mr-1" />Copied!</> : 'Copy'}
              </div>
            </button>
          ) : (
            <div className="w-24 h-24 rounded-lg border border-[var(--color-border)] flex items-center justify-center bg-surface-hover shrink-0">
              <Loader2 className="h-5 w-5 animate-spin text-muted" />
            </div>
          )}
          <div className="flex-1 flex flex-col items-start gap-2">
            {book.cover_image_url && (
              <img src={book.cover_image_url} alt="Book cover" className="h-20 rounded border border-[var(--color-border)] object-cover" />
            )}
            <p className="text-xs text-muted leading-tight">{book.title}</p>
          </div>
        </div>

        {/* Book URL */}
        <div>
          <p className="text-xs text-muted mb-1">Landing page URL {copied === 'url' && <span className="text-green-600 ml-1">— copied!</span>}</p>
          <div className="flex items-center gap-1">
            <code className="flex-1 text-xs text-theme bg-surface-hover px-2 py-1.5 rounded border border-[var(--color-border)] truncate">
              {currentBookUrl}
            </code>
            <button onClick={() => copy(currentBookUrl, 'url')} className="shrink-0 p-1.5 text-muted hover:text-theme rounded border border-[var(--color-border)] hover:bg-surface-hover">
              {copied === 'url' ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <a href={currentBookUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 text-muted hover:text-theme rounded border border-[var(--color-border)] hover:bg-surface-hover">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Book slug editor */}
        <div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted w-20 shrink-0">Book slug</span>
            {editingSlug ? (
              <div className="flex-1 flex items-center gap-1 min-w-0">
                <input
                  type="text"
                  value={slugInput}
                  onChange={e => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  className="flex-1 min-w-0 px-2 py-1 text-xs bg-surface border border-[var(--color-border)] rounded focus:outline-none focus:border-accent text-theme"
                  autoFocus
                />
                <button onClick={saveSlug} disabled={savingSlug} className="px-2 py-1 text-xs theme-button-primary rounded shrink-0">
                  {savingSlug ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                </button>
                <button onClick={() => setEditingSlug(false)} className="text-xs text-muted hover:text-theme px-1 shrink-0">✕</button>
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-1 min-w-0">
                <code
                  className="flex-1 min-w-0 text-xs text-theme bg-surface-hover px-2 py-1 rounded border border-[var(--color-border)] truncate cursor-pointer hover:border-accent"
                  onClick={() => copy(currentSlug || bookId, 'slug')}
                  title="Click to copy"
                >
                  {currentSlug || bookId}
                </code>
                {copied === 'slug' && <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                <button onClick={() => { setSlugInput(currentSlug); setEditingSlug(true); }} className="text-xs text-muted hover:text-theme px-1" title="Edit slug">
                  <Edit className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={nativeShare}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium theme-button-primary rounded-lg"
          >
            <Share2 className="h-3.5 w-3.5" />
            {typeof navigator.share === 'function' ? 'Share' : 'WhatsApp'}
          </button>
          <button
            onClick={downloadQr}
            disabled={!qrDataUrl}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium theme-button-secondary rounded-lg disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> QR PNG
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Chapter Share Dropdown ────────────────────────────────────────────────────
function ChapterShareDropdown({ chapter, chapterIndex, book, bookId, onClose }: {
  chapter: Chapter;
  chapterIndex: number;
  book: Book;
  bookId: string;
  onClose: () => void;
}) {
  const origin = window.location.origin;
  const bookSlug = book.slug || bookId;
  const chapterUrl = `${origin}/bl/${bookSlug}?chapter=${chapter.slug || chapter.id}`;

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [qrCopied, setQrCopied] = useState(false);
  const [editingSlug, setEditingSlug] = useState(false);
  const [slugInput, setSlugInput] = useState(chapter.slug || '');
  const [savingSlug, setSavingSlug] = useState(false);
  const [currentSlug, setCurrentSlug] = useState(chapter.slug || '');
  const [currentChapterUrl, setCurrentChapterUrl] = useState(chapterUrl);
  const panelRef = useRef<HTMLDivElement>(null);

  // Generate QR on mount + auto-copy URL
  useEffect(() => {
    QRCode.toDataURL(chapterUrl, { width: 512, margin: 2 }).then(setQrDataUrl);
    navigator.clipboard.writeText(chapterUrl).catch(() => {});
    setCopied('url');
    const t = setTimeout(() => setCopied(null), 2000);
    return () => clearTimeout(t);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `qr-ch${chapterIndex + 1}-${currentSlug || chapter.id}.png`;
    a.click();
  };

  const copyQr = async (url: string) => {
    if (!qrDataUrl) return;
    try {
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob, 'text/plain': new Blob([url], { type: 'text/plain' }) }),
      ]);
    } catch {
      await navigator.clipboard.writeText(url).catch(() => {});
    }
    setQrCopied(true);
    setTimeout(() => setQrCopied(false), 2000);
  };

  const nativeShare = async () => {
    const shareData: ShareData = {
      title: `${book.title} — ${chapter.title}`,
      text: `Read "${chapter.title}" from ${book.title}`,
      url: currentChapterUrl,
    };
    if (navigator.share) {
      try { await navigator.share(shareData); } catch { /* cancelled */ }
    } else {
      // Fallback: open share via WhatsApp web
      window.open(`https://wa.me/?text=${encodeURIComponent(`${shareData.text}\n${currentChapterUrl}`)}`, '_blank');
    }
  };

  const saveSlug = async () => {
    if (!slugInput.trim()) return;
    setSavingSlug(true);
    try {
      const updated = await api.patchChapterSlug(chapter.id, slugInput.trim());
      setCurrentSlug(updated.slug);
      const newUrl = `${origin}/bl/${bookSlug}?chapter=${updated.slug}`;
      setCurrentChapterUrl(newUrl);
      const qr = await QRCode.toDataURL(newUrl, { width: 512, margin: 2 });
      setQrDataUrl(qr);
      setEditingSlug(false);
    } catch (err: any) {
      alert(err?.message || 'Failed to save slug');
    } finally {
      setSavingSlug(false);
    }
  };

  const generateSlug = async () => {
    try {
      const updated = await api.generateChapterSlug(bookId, chapter.id);
      setCurrentSlug(updated.slug);
      setSlugInput(updated.slug);
      const newUrl = `${origin}/bl/${bookSlug}?chapter=${updated.slug}`;
      setCurrentChapterUrl(newUrl);
      const qr = await QRCode.toDataURL(newUrl, { width: 512, margin: 2 });
      setQrDataUrl(qr);
    } catch (err: any) {
      alert(err?.message || 'Failed to generate slug');
    }
  };

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-1 z-50 w-80 max-w-[min(320px,calc(100vw-2rem))] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden"
      style={{ backgroundColor: 'var(--color-surface)', backgroundImage: 'none' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-surface-hover">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <Share2 className="h-4 w-4 text-accent" />
            <span className="text-sm font-bold text-theme">Chapter Share: Links &amp; QR Code</span>
          </div>
          <span className="text-xs text-muted pl-6 truncate max-w-[220px]">
            Ch {chapterIndex + 1}: {chapter.title}
          </span>
        </div>
        <button onClick={onClose} className="text-muted hover:text-theme p-1 shrink-0">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* QR code */}
        <div className="flex items-start gap-4">
          {qrDataUrl ? (
            <button onClick={() => copyQr(currentChapterUrl)} title="Click to copy QR + URL" className="relative group shrink-0 rounded-lg overflow-hidden border border-[var(--color-border)] focus:outline-none">
              <img src={qrDataUrl} alt="Chapter QR" className="w-24 h-24 block" />
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-medium">
                {qrCopied ? <><Check className="h-4 w-4 mr-1" />Copied!</> : 'Copy'}
              </div>
            </button>
          ) : (
            <div className="w-24 h-24 rounded-lg border border-[var(--color-border)] flex items-center justify-center bg-surface-hover shrink-0">
              <Loader2 className="h-5 w-5 animate-spin text-muted" />
            </div>
          )}
          {/* Book thumbnail */}
          <div className="flex-1 flex flex-col items-start gap-2">
            {book.cover_image_url && (
              <img src={book.cover_image_url} alt="Book cover" className="h-20 rounded border border-[var(--color-border)] object-cover" />
            )}
            <p className="text-xs text-muted leading-tight">{book.title}</p>
          </div>
        </div>

        {/* Chapter URL */}
        <div>
          <p className="text-xs text-muted mb-1">Chapter URL {copied === 'url' && <span className="text-green-600 ml-1">— copied!</span>}</p>
          <div className="flex items-center gap-1">
            <code className="flex-1 text-xs text-theme bg-surface-hover px-2 py-1.5 rounded border border-[var(--color-border)] truncate">
              {currentChapterUrl}
            </code>
            <button onClick={() => copy(currentChapterUrl, 'url')} className="shrink-0 p-1.5 text-muted hover:text-theme rounded border border-[var(--color-border)] hover:bg-surface-hover">
              {copied === 'url' ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
            <a href={currentChapterUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 p-1.5 text-muted hover:text-theme rounded border border-[var(--color-border)] hover:bg-surface-hover">
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Slugs */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted w-20 shrink-0">Book slug</span>
            <code
              className="flex-1 min-w-0 text-xs text-theme bg-surface-hover px-2 py-1 rounded border border-[var(--color-border)] truncate cursor-pointer hover:border-accent"
              onClick={() => copy(book.slug || bookId, 'bookslug')}
              title="Click to copy"
            >
              {book.slug || bookId}
            </code>
            {copied === 'bookslug' && <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />}
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted w-20 shrink-0">Ch. slug</span>
            {editingSlug ? (
              <div className="flex-1 flex items-center gap-1 min-w-0">
                <input
                  type="text"
                  value={slugInput}
                  onChange={e => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
                  className="flex-1 min-w-0 px-2 py-1 text-xs bg-surface border border-[var(--color-border)] rounded focus:outline-none focus:border-accent text-theme"
                  autoFocus
                />
                <button onClick={saveSlug} disabled={savingSlug} className="px-2 py-1 text-xs theme-button-primary rounded shrink-0">
                  {savingSlug ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                </button>
                <button onClick={() => setEditingSlug(false)} className="text-xs text-muted hover:text-theme px-1 shrink-0">✕</button>
              </div>
            ) : (
              <div className="flex-1 flex items-center gap-1 min-w-0">
                <code
                  className="flex-1 min-w-0 text-xs text-theme bg-surface-hover px-2 py-1 rounded border border-[var(--color-border)] truncate cursor-pointer hover:border-accent"
                  onClick={() => copy(currentSlug || chapter.id, 'chslug')}
                  title="Click to copy"
                >
                  {currentSlug || <span className="italic text-muted">no slug</span>}
                </code>
                {copied === 'chslug' && <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                <button onClick={() => { setSlugInput(currentSlug); setEditingSlug(true); }} className="text-xs text-muted hover:text-theme px-1 shrink-0" title="Edit slug">
                  <Edit className="h-3 w-3" />
                </button>
                {!currentSlug && (
                  <button onClick={generateSlug} className="text-xs text-accent hover:underline whitespace-nowrap shrink-0">Auto</button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1">
          {/* Native share / WhatsApp */}
          <button
            onClick={nativeShare}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium theme-button-primary rounded-lg"
          >
            <Share2 className="h-3.5 w-3.5" />
            {typeof navigator.share === 'function' ? 'Share' : 'WhatsApp'}
          </button>
          {/* Download QR */}
          <button
            onClick={downloadQr}
            disabled={!qrDataUrl}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium theme-button-secondary rounded-lg disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" /> QR PNG
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PDF Export Modal ───────────────────────────────────────────────────────────
const PDF_EXPORT_OPTIONS: { key: string; label: string }[] = [
  { key: 'includePolls',     label: 'Polls' },
  { key: 'includeQuestions', label: 'Questions & Quizzes' },
  { key: 'includeImages',    label: 'Images' },
  { key: 'includeCodeBlocks', label: 'Code Blocks' },
  { key: 'includeScripture', label: 'Scripture Blocks' },
  { key: 'includeForms',     label: 'Form Fields (select, textbox, radio…)' },
  { key: 'includeSignatures', label: 'Signature Blocks' },
  { key: 'includeAudio',     label: 'Audio & Video Blocks' },
  { key: 'includeNotes',     label: 'Notes & Annotations' },
  { key: 'includeLinks',     label: 'Link Cards' },
];

function PdfExportModal({ onClose, onExport }: { onClose: () => void; onExport: (opts: Record<string, boolean>) => void }) {
  const [options, setOptions] = useState<Record<string, boolean>>(
    Object.fromEntries(PDF_EXPORT_OPTIONS.map(o => [o.key, true]))
  );

  function toggle(key: string) {
    setOptions(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function selectAll(val: boolean) {
    setOptions(Object.fromEntries(PDF_EXPORT_OPTIONS.map(o => [o.key, val])));
  }

  const allChecked = PDF_EXPORT_OPTIONS.every(o => options[o.key]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-sm flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-theme shrink-0">
          <h2 className="font-semibold text-theme">PDF Export Options</h2>
          <button onClick={onClose} className="text-muted hover:text-theme">✕</button>
        </div>
        <div className="p-4 overflow-y-auto flex-1">
          <p className="text-sm text-muted mb-3">Choose what to include in the exported PDF:</p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-muted uppercase tracking-wide">Inline Content</span>
            <button
              onClick={() => selectAll(!allChecked)}
              className="text-xs text-accent hover:underline"
            >
              {allChecked ? 'Deselect all' : 'Select all'}
            </button>
          </div>
          <div className="space-y-2">
            {PDF_EXPORT_OPTIONS.map(opt => (
              <label key={opt.key} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={!!options[opt.key]}
                  onChange={() => toggle(opt.key)}
                  className="h-4 w-4 rounded border-theme accent-accent"
                />
                <span className="text-sm text-theme group-hover:text-accent transition-colors">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="flex gap-2 p-4 border-t border-theme shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm border border-theme text-theme hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={() => onExport(options)}
            className="flex-1 px-4 py-2 rounded-lg text-sm bg-accent text-white hover:opacity-90 font-medium"
          >
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

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
  const [publishError, setPublishError] = useState<string | null>(null);
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
    setPublishError(null);
    try {
      const r = await api.publishBook(bookId);
      onPublished(r);
    } catch (err: any) {
      setPublishError(err.message || 'Publish failed. Please try again.');
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
            <div className="space-y-4">
              {/* What publishing does */}
              <div className="rounded-xl border border-theme bg-surface-hover p-4 space-y-3">
                <p className="text-sm font-semibold text-theme">What happens when you publish?</p>
                <ul className="space-y-2 text-sm text-muted">
                  <li className="flex items-start gap-2"><Globe className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /><span>Your book becomes <strong className="text-theme">publicly accessible</strong> via a unique URL that you can share with anyone.</span></li>
                  <li className="flex items-start gap-2"><Lock className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" /><span>A <strong className="text-theme">private share link</strong> is also generated — share it with specific people without making the book fully public.</span></li>
                  <li className="flex items-start gap-2"><BookOpen className="h-4 w-4 text-violet-500 shrink-0 mt-0.5" /><span>Only chapters marked as <strong className="text-theme">Published</strong> are visible to readers. Draft chapters stay hidden.</span></li>
                  <li className="flex items-start gap-2"><Check className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /><span>A <strong className="text-theme">snapshot version</strong> of your book is saved automatically at the time of publishing.</span></li>
                </ul>
              </div>

              {/* Checklist before publishing */}
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 space-y-2">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide">Before you publish — checklist</p>
                <ul className="space-y-1.5 text-sm text-amber-800 dark:text-amber-300">
                  <li className="flex items-center gap-2"><span className="w-4 h-4 rounded border border-amber-400 shrink-0 inline-block" />Your book title and description are complete</li>
                  <li className="flex items-center gap-2"><span className="w-4 h-4 rounded border border-amber-400 shrink-0 inline-block" />At least one chapter is published (not draft)</li>
                  <li className="flex items-center gap-2"><span className="w-4 h-4 rounded border border-amber-400 shrink-0 inline-block" />You've proofread all published chapters</li>
                  <li className="flex items-center gap-2"><span className="w-4 h-4 rounded border border-amber-400 shrink-0 inline-block" />Cover image is set (optional but recommended)</li>
                </ul>
              </div>

              <p className="text-xs text-muted text-center">You can unpublish at any time — this will immediately remove public access.</p>

              {publishError && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {publishError}
                </div>
              )}

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

          {/* Unpublish + close */}
          <div className="flex gap-2 pt-1">
            {isPublished && (
              <button onClick={handleUnpublish} disabled={publishing} className="flex-1 px-4 py-2 rounded-lg border border-red-300 text-red-600 text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
                Unpublish
              </button>
            )}
            <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-theme text-muted text-sm font-medium hover:bg-surface-hover transition-colors">
              Cancel
            </button>
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
  const [showPdfExportModal, setShowPdfExportModal] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  // Inline review state
  const [reviewPanelOpen, setReviewPanelOpen] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewerNote, setReviewerNote] = useState('');
  const reviewPanelRef = useRef<HTMLDivElement>(null);
  const [chapterCommentsPage, setChapterCommentsPage] = useState<Record<string, number>>({});
  const [openShareChapterId, setOpenShareChapterId] = useState<string | null>(null);
  const [showBookShare, setShowBookShare] = useState(false);
  const [coverExpanded, setCoverExpanded] = useState(false);
  const bookShareRef = useRef<HTMLDivElement>(null);
  const PAGE_SIZE = 5;
  const dragOverIdRef = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function handleChapterDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('chapterId', id);
  }

  function handleChapterDragOver(e: React.DragEvent, id: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverIdRef.current !== id) {
      dragOverIdRef.current = id;
      setDragOverId(id);
    }
  }

  async function handleChapterDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    setDragOverId(null);
    dragOverIdRef.current = null;
    const sourceId = e.dataTransfer.getData('chapterId');
    if (!sourceId || sourceId === targetId || !bookId) return;
    const sorted = [...chapters].sort((a, b) => a.order_index - b.order_index);
    const srcIdx = sorted.findIndex(c => c.id === sourceId);
    const tgtIdx = sorted.findIndex(c => c.id === targetId);
    if (srcIdx === -1 || tgtIdx === -1) return;
    const reordered = [...sorted];
    const [moved] = reordered.splice(srcIdx, 1);
    reordered.splice(tgtIdx, 0, moved);
    const withOrder = reordered.map((c, i) => ({ ...c, order_index: i }));
    setChapters(withOrder);
    try {
      await api.reorderChapters(bookId, withOrder.map(c => c.id));
    } catch (err) {
      console.error('Failed to reorder chapters:', err);
    }
  }

  function handleChapterDragEnd() {
    setDragOverId(null);
    dragOverIdRef.current = null;
  }

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
      const [bookData, roleResult] = await Promise.all([
        api.getBook(bookId!),
        api.getMyRole(bookId!).catch(() => ({ role: 'owner' as CollaboratorRole })),
      ]);
      setBook(bookData);
      setChapters(bookData.chapters || []);
      setUserRole(roleResult.role);
      // Load collaborators list (owner only — silently fail for non-owners)
      api.getCollaborators(bookId!).then(setCollaborators).catch(() => {});
      // Load latest review request
      api.getReviews(bookId!).then(reviews => {
        if (reviews.length > 0) setLatestReview(reviews[0]);
      }).catch(console.error);
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

  async function handleReviewSubmit() {
    if (!bookId) return;
    setReviewLoading(true);
    try {
      await api.submitForReview(bookId, reviewMessage);
      setBook(prev => prev ? { ...prev, review_status: 'pending' } : prev);
      setReviewPanelOpen(false);
      setReviewMessage('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit for review');
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleReviewDecision(status: 'approved' | 'rejected') {
    if (!bookId || !latestReview) return;
    setReviewLoading(true);
    try {
      await api.reviewDecision(bookId, latestReview.id, { status, reviewer_note: reviewerNote });
      setBook(prev => prev ? { ...prev, review_status: status } : prev);
      api.getReviews(bookId).then(reviews => { if (reviews.length > 0) setLatestReview(reviews[0]); }).catch(() => {});
      setReviewPanelOpen(false);
      setReviewerNote('');
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update review');
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleReviewCancel() {
    if (!bookId || !latestReview) return;
    if (!confirm('Cancel this review request?')) return;
    setReviewLoading(true);
    try {
      await api.cancelReview(bookId, latestReview.id);
      setBook(prev => prev ? { ...prev, review_status: 'none' } : prev);
      setReviewPanelOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel review');
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleReviewReset() {
    if (!bookId || !latestReview) return;
    if (!confirm('Cancel this approval and reset to "not submitted"?')) return;
    setReviewLoading(true);
    try {
      await api.resetReview(bookId, latestReview.id);
      setBook(prev => prev ? { ...prev, review_status: 'none' } : prev);
      setReviewPanelOpen(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to reset review');
    } finally {
      setReviewLoading(false);
    }
  }

  async function handleExport(format: 'json' | 'pdf' | 'epub' | 'docx') {
    if (!bookId) return;
    setShowExportMenu(false);
    if (format === 'pdf') {
      setShowPdfExportModal(true);
      return;
    }
    setExporting(format);
    try {
      if (format === 'json') {
        await api.exportJson(bookId);
      } else {
        const methodMap = { epub: 'exportEpub', docx: 'exportDocx' } as const;
        const result = await api[methodMap[format as 'epub' | 'docx']](bookId);
        if (result?.download_url) window.open(result.download_url, '_blank');
      }
    } catch (err) {
      alert(`Export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setExporting(null);
    }
  }

  async function handlePdfExport(options: Record<string, boolean>) {
    if (!bookId) return;
    setShowPdfExportModal(false);
    setExporting('pdf');
    try {
      const result = await api.exportPdf(bookId, options);
      if (result?.download_url) window.open(result.download_url, '_blank');
    } catch (err) {
      alert(`PDF export failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
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
              <div className="flex items-center gap-3 min-w-0">
                {book.cover_image_url && (
                  <>
                    <img
                      src={book.cover_image_url}
                      alt="Book cover"
                      className="h-16 w-auto rounded-lg border border-[var(--color-border)] object-cover shrink-0 shadow-sm cursor-zoom-in"
                      onClick={() => setCoverExpanded(true)}
                    />
                    {coverExpanded && (
                      <div
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                        onClick={() => setCoverExpanded(false)}
                      >
                        <img
                          src={book.cover_image_url}
                          alt="Book cover"
                          className="h-48 w-auto rounded-2xl shadow-2xl border-2 border-white/20"
                          style={{ height: 'min(576px, 80vh)' }}
                          onClick={e => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </>
                )}
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-bold truncate">{book.title}</h1>
                  {book.subtitle && <p className="text-muted text-sm truncate">{book.subtitle}</p>}
                  <p className="text-xs text-muted mt-0.5">
                    Created {new Date(book.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    {' · '}Updated {fmtRelative(new Date(book.updated_at))}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 flex-wrap">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_BADGE[userRole].className}`}>
                  {ROLE_BADGE[userRole].label}
                </span>
                {collaborators.length > 0 && (
                  <CollaboratorBadges collaborators={collaborators} bookId={bookId!} />
                )}
                {['owner', 'author'].includes(userRole) && (
                  <Link to={`/edit/book/${bookId}/collaborators`} className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded" title="Collaborators">
                    <Users className="h-5 w-5" />
                  </Link>
                )}
                <Link to={`/edit/book/${bookId}/versions`} className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded" title="Version history">
                  <History className="h-5 w-5" />
                </Link>
                {['owner', 'author'].includes(userRole) && (
                  <button onClick={() => setEditingBook(true)} className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded">
                    <Edit className="h-5 w-5" />
                  </button>
                )}
                {['owner', 'author'].includes(userRole) && (
                  <Link to={`/edit/book/${bookId}/settings`} className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded">
                    <Settings className="h-5 w-5" />
                  </Link>
                )}
                {['owner', 'author'].includes(userRole) && (
                  <Link to={`/edit/book/${bookId}/dashboard`} className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded" title="Dashboard">
                    <BarChart2 className="h-5 w-5" />
                  </Link>
                )}
                {/* Book Share / QR */}
                <div ref={bookShareRef} className="relative">
                  <button
                    onClick={() => setShowBookShare(prev => !prev)}
                    className={`p-2 rounded transition-colors ${showBookShare ? 'bg-accent/10 text-accent' : 'text-muted hover:text-theme hover:bg-surface-hover'}`}
                    title="Book Share: Links & QR Code"
                  >
                    <QrCode className="h-5 w-5" />
                  </button>
                  {showBookShare && book && (
                    <BookShareDropdown
                      book={book}
                      bookId={bookId!}
                      onClose={() => setShowBookShare(false)}
                    />
                  )}
                </div>
                <Link to={`/book/${bookId}`} className="p-2 text-muted hover:text-theme hover:bg-surface-hover rounded">
                  <Eye className="h-5 w-5" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status + Actions Bar */}
      <div className="relative bg-surface rounded-lg border-theme border px-4 py-3 mb-6">
        <div className="flex flex-wrap items-center gap-2">
          {/* Left: chapter count */}
          <span className="text-sm text-muted">{chapters.length} chapters</span>

          <div className="flex-1" />

          {/* Review status + actions */}
          {['owner', 'author', 'reviewer'].includes(userRole) && (() => {
            const rs = book.review_status || 'none';
            const REVIEW_STYLE: Record<string, { pill: string; label: string }> = {
              none:     { pill: 'bg-surface-hover text-muted border border-theme',         label: 'Not submitted' },
              pending:  { pill: 'bg-yellow-100 text-yellow-800 border border-yellow-300',  label: 'Review pending' },
              approved: { pill: 'bg-green-100 text-green-800 border border-green-300',     label: 'Approved' },
              rejected: { pill: 'bg-red-100 text-red-800 border border-red-300',           label: 'Changes requested' },
            };
            const { pill, label } = REVIEW_STYLE[rs] ?? REVIEW_STYLE.none;
            return (
              <div className="relative" ref={reviewPanelRef}>
                <button
                  onClick={() => setReviewPanelOpen(v => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${pill}`}
                >
                  <Star className="h-3.5 w-3.5" />
                  {label}
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                </button>

                {reviewPanelOpen && (
                  <div className="absolute right-0 top-full mt-1 w-72 bg-surface border border-theme rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-theme flex items-center justify-between">
                      <span className="text-sm font-medium">Review</span>
                      <button onClick={() => setReviewPanelOpen(false)} className="text-muted hover:text-theme"><X className="h-4 w-4" /></button>
                    </div>

                    {/* Reviewer note (if any) */}
                    {latestReview?.reviewer_note && (
                      <div className="px-3 py-2 border-b border-theme">
                        <p className="text-xs text-muted italic">"{latestReview.reviewer_note}"</p>
                      </div>
                    )}

                    <div className="p-3 space-y-2">
                      {/* none → submit form */}
                      {rs === 'none' && ['owner', 'author'].includes(userRole) && (
                        <>
                          <textarea
                            placeholder="Message to reviewers (optional)..."
                            value={reviewMessage}
                            onChange={e => setReviewMessage(e.target.value)}
                            className="w-full text-sm border border-theme rounded-lg px-3 py-2 bg-surface text-theme placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                            rows={2}
                          />
                          <button
                            onClick={handleReviewSubmit}
                            disabled={reviewLoading}
                            className="flex items-center gap-1.5 theme-button-primary px-3 py-1.5 rounded-lg text-sm font-medium w-full justify-center"
                          >
                            {reviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Submit for review
                          </button>
                        </>
                      )}

                      {/* pending → reviewer can approve/reject; submitter can cancel */}
                      {rs === 'pending' && (
                        <>
                          {['owner', 'reviewer'].includes(userRole) && (
                            <>
                              <textarea
                                placeholder="Optional note for the author..."
                                value={reviewerNote}
                                onChange={e => setReviewerNote(e.target.value)}
                                className="w-full text-sm border border-theme rounded-lg px-3 py-2 bg-surface text-theme placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                                rows={2}
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleReviewDecision('approved')}
                                  disabled={reviewLoading}
                                  className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                                >
                                  {reviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReviewDecision('rejected')}
                                  disabled={reviewLoading}
                                  className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium"
                                >
                                  {reviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                                  Request changes
                                </button>
                              </div>
                            </>
                          )}
                          {['owner', 'author'].includes(userRole) && latestReview?.submitted_by && (
                            <button
                              onClick={handleReviewCancel}
                              disabled={reviewLoading}
                              className="w-full text-xs text-muted hover:text-red-500 border border-theme px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Cancel request
                            </button>
                          )}
                        </>
                      )}

                      {/* approved/rejected → re-submit or cancel approval */}
                      {['approved', 'rejected'].includes(rs) && (
                        <>
                          {['owner', 'author'].includes(userRole) && (
                            <>
                              <textarea
                                placeholder="Message to reviewers (optional)..."
                                value={reviewMessage}
                                onChange={e => setReviewMessage(e.target.value)}
                                className="w-full text-sm border border-theme rounded-lg px-3 py-2 bg-surface text-theme placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent resize-none"
                                rows={2}
                              />
                              <button
                                onClick={handleReviewSubmit}
                                disabled={reviewLoading}
                                className="flex items-center gap-1.5 theme-button-primary px-3 py-1.5 rounded-lg text-sm font-medium w-full justify-center"
                              >
                                {reviewLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Re-submit for review
                              </button>
                            </>
                          )}
                          {['owner', 'reviewer'].includes(userRole) && (
                            <button
                              onClick={handleReviewReset}
                              disabled={reviewLoading}
                              className="w-full text-xs text-muted hover:text-red-500 border border-theme px-3 py-1.5 rounded-lg transition-colors"
                            >
                              Cancel approval
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Export dropdown */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(v => !v)}
              disabled={!!exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-sm bg-surface-hover text-theme hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {exporting ? `Exporting…` : 'Export'}
              <ChevronDown size={12} />
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-surface border border-theme rounded-lg shadow-lg z-50 overflow-hidden">
                {(['json', 'pdf', 'epub', 'docx'] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => handleExport(fmt)}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-surface-hover text-theme"
                  >
                    {fmt === 'json' ? 'Book JSON (backup)' : fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Publish button */}
          {['owner', 'author'].includes(userRole) && (
            <button
              onClick={() => setShowPublishModal(true)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-medium text-sm transition-colors ${
                book.status === 'published'
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <Globe size={14} />
              {book.status === 'published' ? 'Published' : 'Publish'}
            </button>
          )}
        </div>
      </div>

      {/* PDF Export modal */}
      {showPdfExportModal && (
        <PdfExportModal
          onClose={() => setShowPdfExportModal(false)}
          onExport={handlePdfExport}
        />
      )}

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
                <div key={chapter.id}
                  draggable
                  onDragStart={e => handleChapterDragStart(e, chapter.id)}
                  onDragOver={e => handleChapterDragOver(e, chapter.id)}
                  onDrop={e => handleChapterDrop(e, chapter.id)}
                  onDragEnd={handleChapterDragEnd}
                  className={dragOverId === chapter.id ? 'border-t-2 border-accent' : ''}
                >
                  <div className="flex items-start gap-3 p-4 hover:bg-surface-hover">
                    <GripVertical className="mt-1 h-5 w-5 shrink-0 text-muted cursor-grab active:cursor-grabbing" />
                    <div className="min-w-0 flex-1 md:flex md:items-start md:justify-between md:gap-4">
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/edit/book/${bookId}/chapter/${chapter.id}`}
                          className="block font-medium hover:text-accent break-words"
                        >
                          {index + 1}. {chapter.title}
                        </Link>
                        <div className="mt-1 flex gap-3 text-xs text-muted flex-wrap">
                          <span>{chapter.word_count || 0} words</span>
                          <span>{chapter.estimated_read_time_minutes || 1} min read</span>
                          <span className={chapter.status === 'published' ? 'text-green-600' : 'text-yellow-600'}>
                            {chapter.status}
                          </span>
                          {chapter.updated_at && (
                            <span title={new Date(chapter.updated_at).toLocaleString()}>
                              edited {fmtRelative(new Date(chapter.updated_at))}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-1.5 md:mt-0 md:ml-4 md:flex-shrink-0">
                      {/* Chapter responses button */}
                      <Link
                        to={`/edit/book/${bookId}/dashboard?chapter=${chapter.id}`}
                        className="flex items-center gap-1 px-2 py-1.5 rounded text-sm text-muted hover:text-theme hover:bg-surface-hover transition-colors"
                        title="View chapter responses"
                      >
                        <BarChart2 className="h-4 w-4" />
                      </Link>
                      {/* Share button */}
                      <div className="relative">
                        <button
                          onClick={() => setOpenShareChapterId(prev => prev === chapter.id ? null : chapter.id)}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded text-sm transition-colors ${
                            openShareChapterId === chapter.id
                              ? 'bg-accent/10 text-accent'
                              : 'text-muted hover:text-theme hover:bg-surface-hover'
                          }`}
                          title="Share / QR code"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                        {openShareChapterId === chapter.id && book && (
                          <ChapterShareDropdown
                            chapter={chapter}
                            chapterIndex={index}
                            book={book}
                            bookId={bookId!}
                            onClose={() => setOpenShareChapterId(null)}
                          />
                        )}
                      </div>
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
