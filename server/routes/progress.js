import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Trackable inline content types
const TRACKABLE_TYPES = ['textbox', 'textarea', 'select', 'multiselect', 'radio', 'checkbox', 'poll', 'question'];

/**
 * Recursively count audio/video nodes in TipTap JSON content.
 * Returns an array of stable keys: "media:{chapterId}-{index}"
 */
function extractMediaKeys(content, chapterId, counter = { n: 0 }) {
  const keys = [];
  if (!content || !Array.isArray(content)) return keys;
  for (const node of content) {
    if (node.type === 'audio' || node.type === 'video') {
      keys.push({ key: `media:${chapterId}-${counter.n}`, type: node.type });
      counter.n++;
    }
    if (node.content) {
      keys.push(...extractMediaKeys(node.content, chapterId, counter));
    }
  }
  return keys;
}

/**
 * POST /api/progress/complete
 * Mark a single item as complete for the authenticated user.
 * Body: { chapter_id, item_key, item_type }
 */
router.post('/complete', authenticate, async (req, res) => {
  const { chapter_id, item_key, item_type } = req.body;
  if (!chapter_id || !item_key || !item_type) {
    return res.status(400).json({ error: 'chapter_id, item_key, item_type are required' });
  }

  try {
    // Verify chapter exists and user has access to the book
    const { data: chapter, error: chErr } = await supabase
      .schema('bookflow')
      .from('chapters')
      .select('id, book_id, book:books(visibility, author_id, settings:book_settings(enable_progress_tracking))')
      .eq('id', chapter_id)
      .single();

    if (chErr || !chapter) return res.status(404).json({ error: 'Chapter not found' });

    const book = chapter.book;
    const settings = Array.isArray(book.settings) ? book.settings[0] : book.settings;

    // Check progress tracking is enabled at book or club level
    const isAuthor = book.author_id === req.user.id;
    if (!settings?.enable_progress_tracking && !isAuthor) {
      // Also check club-level enable
      const { data: clubMembership } = await supabase
        .schema('bookflow')
        .from('club_members')
        .select('club_id, club:book_clubs(club_books(book_id), settings:club_settings(enable_progress_tracking))')
        .eq('user_id', req.user.id)
        .not('invite_accepted_at', 'is', null);

      const clubEnabled = (clubMembership || []).some(m => {
        const cs = Array.isArray(m.club?.settings) ? m.club.settings[0] : m.club?.settings;
        const hasBook = (m.club?.club_books || []).some(cb => cb.book_id === chapter.book_id);
        return hasBook && cs?.enable_progress_tracking;
      });

      if (!clubEnabled) {
        return res.status(403).json({ error: 'Progress tracking not enabled for this book' });
      }
    }

    // Upsert completion
    const { error } = await supabase
      .schema('bookflow')
      .from('chapter_item_completions')
      .upsert({
        user_id: req.user.id,
        chapter_id,
        item_key,
        item_type,
        completed_at: new Date().toISOString(),
      }, { onConflict: 'user_id,chapter_id,item_key' });

    if (error) throw error;

    res.json({ ok: true });
  } catch (err) {
    console.error('Mark complete error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/progress/chapter/:chapterId
 * Returns completed item keys + total completable count for the chapter.
 */
router.get('/chapter/:chapterId', authenticate, async (req, res) => {
  const { chapterId } = req.params;

  try {
    // Load chapter content + inline content in parallel
    const [{ data: chapter, error: chErr }, { data: inlineRows, error: icErr }] = await Promise.all([
      supabase.schema('bookflow').from('chapters').select('id, content').eq('id', chapterId).single(),
      supabase.schema('bookflow').from('inline_content')
        .select('id, content_type')
        .eq('chapter_id', chapterId)
        .in('content_type', TRACKABLE_TYPES),
    ]);

    if (chErr || !chapter) return res.status(404).json({ error: 'Chapter not found' });
    if (icErr) throw icErr;

    // Completable items from inline_content
    const formItems = (inlineRows || []).map(r => ({ key: `ic:${r.id}`, type: 'form' }));

    // Completable media nodes from TipTap JSON
    const contentNodes = chapter.content?.content || [];
    const mediaItems = extractMediaKeys(contentNodes, chapterId);

    const total = formItems.length + mediaItems.length;

    // Fetch user's completions for this chapter
    const { data: completions, error: compErr } = await supabase
      .schema('bookflow')
      .from('chapter_item_completions')
      .select('item_key')
      .eq('user_id', req.user.id)
      .eq('chapter_id', chapterId);

    if (compErr) throw compErr;

    res.json({
      completions: (completions || []).map(c => c.item_key),
      total,
    });
  } catch (err) {
    console.error('Get chapter progress error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/progress/book/:bookId
 * Returns per-chapter progress summary for the authenticated user.
 */
router.get('/book/:bookId', authenticate, async (req, res) => {
  const { bookId } = req.params;

  try {
    // Load all published chapters for the book
    const { data: chapters, error: chErr } = await supabase
      .schema('bookflow')
      .from('chapters')
      .select('id, content')
      .eq('book_id', bookId)
      .eq('status', 'published')
      .order('order_index');

    if (chErr) throw chErr;

    // Load all inline_content for these chapters at once
    const chapterIds = (chapters || []).map(c => c.id);
    const { data: allInline, error: icErr } = await supabase
      .schema('bookflow')
      .from('inline_content')
      .select('id, chapter_id, content_type')
      .in('chapter_id', chapterIds)
      .in('content_type', TRACKABLE_TYPES);

    if (icErr) throw icErr;

    // Load all user completions for these chapters at once
    const { data: allCompletions, error: compErr } = await supabase
      .schema('bookflow')
      .from('chapter_item_completions')
      .select('chapter_id, item_key')
      .eq('user_id', req.user.id)
      .in('chapter_id', chapterIds);

    if (compErr) throw compErr;

    // Group inline by chapter
    const inlineByChapter = {};
    for (const ic of (allInline || [])) {
      if (!inlineByChapter[ic.chapter_id]) inlineByChapter[ic.chapter_id] = [];
      inlineByChapter[ic.chapter_id].push(ic);
    }

    // Group completions by chapter
    const completedByChapter = {};
    for (const comp of (allCompletions || [])) {
      if (!completedByChapter[comp.chapter_id]) completedByChapter[comp.chapter_id] = new Set();
      completedByChapter[comp.chapter_id].add(comp.item_key);
    }

    // Build stats per chapter
    const stats = (chapters || []).map(ch => {
      const formKeys = (inlineByChapter[ch.id] || []).map(r => `ic:${r.id}`);
      const mediaKeys = extractMediaKeys(ch.content?.content || [], ch.id).map(m => m.key);
      const total = formKeys.length + mediaKeys.length;
      const completedSet = completedByChapter[ch.id] || new Set();
      const completed = [...formKeys, ...mediaKeys].filter(k => completedSet.has(k)).length;
      return { chapter_id: ch.id, completed, total };
    });

    res.json(stats);
  } catch (err) {
    console.error('Get book progress error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/progress/club/:clubId
 * Returns per-member progress for all books in the club.
 * Full view: club owners/admins (or when show_member_reading_progress = true).
 * Restricted view: regular members see only themselves.
 */
router.get('/club/:clubId', authenticate, async (req, res) => {
  const { clubId } = req.params;

  try {
    // Verify caller is a club member
    const { data: membership, error: memErr } = await supabase
      .schema('bookflow')
      .from('club_members')
      .select('role')
      .eq('club_id', clubId)
      .eq('user_id', req.user.id)
      .not('invite_accepted_at', 'is', null)
      .maybeSingle();

    if (memErr) throw memErr;
    if (!membership) return res.status(403).json({ error: 'Not a member of this club' });

    // Load club settings
    const { data: clubSettings } = await supabase
      .schema('bookflow')
      .from('club_settings')
      .select('enable_progress_tracking, show_member_reading_progress')
      .eq('club_id', clubId)
      .maybeSingle();

    if (!clubSettings?.enable_progress_tracking) {
      return res.status(403).json({ error: 'Progress tracking not enabled for this club' });
    }

    const isPrivileged = membership.role === 'owner' || membership.role === 'admin';
    const canSeeAll = isPrivileged || clubSettings.show_member_reading_progress;

    // Load club members
    const membersQuery = supabase
      .schema('bookflow')
      .from('club_members')
      .select('user_id, role, profile:profiles(display_name, avatar_url)')
      .eq('club_id', clubId)
      .not('invite_accepted_at', 'is', null);

    const { data: members, error: mErr } = canSeeAll
      ? await membersQuery
      : await membersQuery.eq('user_id', req.user.id);

    if (mErr) throw mErr;

    // Load current club book
    const { data: clubBook } = await supabase
      .schema('bookflow')
      .from('club_books')
      .select('book_id')
      .eq('club_id', clubId)
      .eq('is_current', true)
      .maybeSingle();

    if (!clubBook) return res.json([]);

    // Load all chapters for the current book
    const { data: chapters } = await supabase
      .schema('bookflow')
      .from('chapters')
      .select('id, content')
      .eq('book_id', clubBook.book_id)
      .eq('status', 'published');

    const chapterIds = (chapters || []).map(c => c.id);

    // Load inline content
    const { data: allInline } = await supabase
      .schema('bookflow')
      .from('inline_content')
      .select('id, chapter_id, content_type')
      .in('chapter_id', chapterIds)
      .in('content_type', TRACKABLE_TYPES);

    // Compute total completable items per chapter
    const totalByChapter = {};
    for (const ch of (chapters || [])) {
      const formCount = (allInline || []).filter(ic => ic.chapter_id === ch.id).length;
      const mediaCount = extractMediaKeys(ch.content?.content || [], ch.id).length;
      totalByChapter[ch.id] = formCount + mediaCount;
    }
    const grandTotal = Object.values(totalByChapter).reduce((a, b) => a + b, 0);

    // Load completions for relevant users
    const memberIds = (members || []).map(m => m.user_id);
    const { data: allCompletions } = await supabase
      .schema('bookflow')
      .from('chapter_item_completions')
      .select('user_id, chapter_id, item_key, completed_at')
      .in('chapter_id', chapterIds)
      .in('user_id', memberIds);

    // Aggregate per user
    const result = (members || []).map(member => {
      const userCompletions = (allCompletions || []).filter(c => c.user_id === member.user_id);
      const completedChapters = new Set(
        userCompletions
          .filter(c => {
            const t = totalByChapter[c.chapter_id] || 0;
            const done = userCompletions.filter(x => x.chapter_id === c.chapter_id).length;
            return t > 0 && done >= t;
          })
          .map(c => c.chapter_id)
      ).size;

      const lastActive = userCompletions.length
        ? userCompletions.reduce((latest, c) =>
            c.completed_at > latest ? c.completed_at : latest,
            userCompletions[0].completed_at)
        : null;

      const profile = Array.isArray(member.profile) ? member.profile[0] : member.profile;

      return {
        user_id: member.user_id,
        display_name: profile?.display_name || 'Member',
        avatar_url: profile?.avatar_url || null,
        role: member.role,
        items_completed: userCompletions.length,
        items_total: grandTotal,
        chapters_completed: completedChapters,
        chapters_total: chapterIds.length,
        last_active: lastActive,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('Club progress error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
