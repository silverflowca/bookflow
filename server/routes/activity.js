import express from 'express';
import { supabase } from '../config/supabase.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router({ mergeParams: true });

const ALLOWED_TYPES = ['version', 'comment', 'inline_content', 'change_log'];

// GET /api/books/:bookId/activity
router.get('/', authenticate, requireRole(['owner', 'author', 'editor', 'reviewer']), async (req, res) => {
  const bookId = req.params.bookId;
  const type = req.query.type || 'all';
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const activeTypes = type === 'all' ? ALLOWED_TYPES : [type].filter(t => ALLOWED_TYPES.includes(t));
    const results = [];

    await Promise.all(activeTypes.map(async (eventType) => {
      if (eventType === 'version') {
        const { data, error } = await supabase
          .from('book_versions')
          .select(`
            id, version_number, label, trigger, created_at,
            actor:profiles!book_versions_created_by_fkey(id, display_name, avatar_url)
          `)
          .eq('book_id', bookId)
          .order('created_at', { ascending: false })
          .limit(limit + offset);

        if (!error && data) {
          for (const row of data) {
            results.push({
              id: `version-${row.id}`,
              event_type: 'version',
              created_at: row.created_at,
              actor: row.actor || null,
              description: row.label
                ? `Saved snapshot v${row.version_number} — ${row.label}`
                : `Saved snapshot v${row.version_number}`,
              meta: {
                version_id: row.id,
                version_number: row.version_number,
                trigger: row.trigger,
                label: row.label,
              },
            });
          }
        }
      }

      if (eventType === 'comment') {
        const { data, error } = await supabase
          .from('book_comments')
          .select(`
            id, body, anchor_text, status, created_at,
            actor:profiles!book_comments_author_id_fkey(id, display_name, avatar_url),
            chapter:chapters!book_comments_chapter_id_fkey(id, title)
          `)
          .eq('book_id', bookId)
          .is('parent_id', null)
          .order('created_at', { ascending: false })
          .limit(limit + offset);

        if (!error && data) {
          for (const row of data) {
            const target = row.anchor_text
              ? `"${row.anchor_text.slice(0, 40)}${row.anchor_text.length > 40 ? '…' : ''}"`
              : row.chapter?.title
                ? `chapter "${row.chapter.title}"`
                : 'a chapter';
            results.push({
              id: `comment-${row.id}`,
              event_type: 'comment',
              created_at: row.created_at,
              actor: row.actor || null,
              description: `Commented on ${target}`,
              meta: {
                comment_id: row.id,
                status: row.status,
                chapter_id: row.chapter?.id,
                chapter_title: row.chapter?.title,
                anchor_text: row.anchor_text,
                body_preview: row.body?.slice(0, 100),
              },
            });
          }
        }
      }

      if (eventType === 'inline_content') {
        const { data, error } = await supabase
          .from('inline_content')
          .select(`
            id, content_type, anchor_text, created_at,
            actor:profiles!inline_content_created_by_fkey(id, display_name, avatar_url),
            chapter:chapters!inline_content_chapter_id_fkey(id, title)
          `)
          .eq('book_id', bookId)
          .order('created_at', { ascending: false })
          .limit(limit + offset);

        if (!error && data) {
          for (const row of data) {
            const target = row.anchor_text
              ? `"${row.anchor_text.slice(0, 40)}${row.anchor_text.length > 40 ? '…' : ''}"`
              : row.chapter?.title
                ? `in "${row.chapter.title}"`
                : 'a chapter';
            results.push({
              id: `content-${row.id}`,
              event_type: 'inline_content',
              created_at: row.created_at,
              actor: row.actor || null,
              description: `Added ${row.content_type.replace('_', ' ')} ${target}`,
              meta: {
                content_id: row.id,
                content_type: row.content_type,
                chapter_id: row.chapter?.id,
                chapter_title: row.chapter?.title,
                anchor_text: row.anchor_text,
              },
            });
          }
        }
      }

      if (eventType === 'change_log') {
        const { data, error } = await supabase
          .from('change_log')
          .select(`
            id, entity_type, entity_id, change_type, change_description, created_at,
            actor:profiles!change_log_changed_by_fkey(id, display_name, avatar_url)
          `)
          .in('entity_type', ['book', 'chapter', 'inline_content'])
          .eq('after_data->>book_id', bookId)
          .order('created_at', { ascending: false })
          .limit(limit + offset);

        if (!error && data) {
          for (const row of data) {
            const entityLabel = row.entity_type === 'chapter'
              ? `chapter "${row.change_description || row.entity_id.slice(0, 8)}"`
              : row.entity_type;
            results.push({
              id: `log-${row.id}`,
              event_type: 'change_log',
              created_at: row.created_at,
              actor: row.actor || null,
              description: row.change_description || `${row.change_type} ${entityLabel}`,
              meta: {
                log_id: row.id,
                entity_type: row.entity_type,
                entity_id: row.entity_id,
                change_type: row.change_type,
              },
            });
          }
        }
      }
    }));

    // Sort all events newest first, then paginate
    results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const page = results.slice(offset, offset + limit);

    res.json({
      events: page,
      total: results.length,
      hasMore: results.length > offset + limit,
    });
  } catch (err) {
    console.error('Activity fetch error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
