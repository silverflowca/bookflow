import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { postBookChatComponentUpdate } from '../services/chat-status.js';

const router = express.Router();

// Trackable inline content types (all stored as inline_content rows, keyed as ic:{id})
const TRACKABLE_TYPES = ['textbox', 'textarea', 'select', 'multiselect', 'radio', 'checkbox', 'poll', 'question', 'audio', 'video'];

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
 * POST /api/progress/incomplete
 * Remove a completion record for the authenticated user (item was cleared/blanked).
 * Body: { chapter_id, item_key }
 */
router.post('/incomplete', authenticate, async (req, res) => {
  const { chapter_id, item_key } = req.body;
  if (!chapter_id || !item_key) {
    return res.status(400).json({ error: 'chapter_id and item_key are required' });
  }
  try {
    const { error } = await supabase
      .schema('bookflow')
      .from('chapter_item_completions')
      .delete()
      .eq('user_id', req.user.id)
      .eq('chapter_id', chapter_id)
      .eq('item_key', item_key);
    if (error) throw error;
    console.log('[Progress] markIncomplete:', { user_id: req.user.id, chapter_id, item_key });
    res.json({ ok: true });
  } catch (err) {
    console.error('Mark incomplete error:', err);
    res.status(500).json({ error: err.message });
  }
});

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
      .select('id, book_id, book:books(visibility, author_id, settings:book_settings(enable_progress_tracking), collaborators:book_collaborators(user_id, invite_accepted_at))')
      .eq('id', chapter_id)
      .single();

    if (chErr || !chapter) return res.status(404).json({ error: 'Chapter not found' });

    const book = chapter.book;
    const settings = Array.isArray(book.settings) ? book.settings[0] : book.settings;

    // Check progress tracking is enabled at book or club level
    const isAuthor = book.author_id === req.user.id
      || (book.collaborators || []).some(
          c => c.user_id === req.user.id && c.invite_accepted_at !== null
        );
    if (!settings?.enable_progress_tracking && !isAuthor) {
      // Check club-level enable: find clubs that have this book AND have progress tracking on
      // AND the user is a member of
      const { data: clubsWithBook } = await supabase
        .schema('bookflow')
        .from('club_books')
        .select('club_id')
        .eq('book_id', chapter.book_id);

      const clubIds = (clubsWithBook || []).map(cb => cb.club_id);
      let clubEnabled = false;

      if (clubIds.length > 0) {
        const { data: userMembership } = await supabase
          .schema('bookflow')
          .from('club_members')
          .select('club_id')
          .eq('user_id', req.user.id)
          .in('club_id', clubIds)
          .not('invite_accepted_at', 'is', null)
          .maybeSingle();

        if (userMembership) {
          const { data: clubSettingsRows } = await supabase
            .schema('bookflow')
            .from('club_settings')
            .select('enable_progress_tracking')
            .in('club_id', clubIds);

          clubEnabled = (clubSettingsRows || []).some(cs => cs.enable_progress_tracking);
        }
      }

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

    // Fire book-chat component update (non-blocking, after response sent)
    postBookChatComponentUpdate(req.user.id, chapter.book_id, chapter_id, item_type)
      .catch(err => console.error('[book-chat] component update error:', err.message));
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

    const formItems = (inlineRows || []);
    const total = formItems.length;
    const icIds = formItems.map(r => r.id);

    // Fetch existing completion records
    const { data: completions, error: compErr } = await supabase
      .schema('bookflow')
      .from('chapter_item_completions')
      .select('item_key')
      .eq('user_id', req.user.id)
      .eq('chapter_id', chapterId);

    if (compErr) throw compErr;

    const completedKeys = new Set((completions || []).map(c => c.item_key));

    // Find items that have actual responses but are missing a completion record
    // (can happen when completion write failed or predates this system)
    const missingIds = icIds.filter(id => !completedKeys.has(`ic:${id}`));

    if (missingIds.length > 0) {
      const [{ data: qAnswers }, { data: pollVotes }, { data: formResps }] = await Promise.all([
        supabase.schema('bookflow').from('question_answers')
          .select('inline_content_id, answer_text, selected_options')
          .in('inline_content_id', missingIds)
          .eq('user_id', req.user.id),
        supabase.schema('bookflow').from('poll_responses')
          .select('inline_content_id, selected_option')
          .in('inline_content_id', missingIds)
          .eq('user_id', req.user.id),
        supabase.schema('bookflow').from('form_responses')
          .select('inline_content_id, response_data')
          .in('inline_content_id', missingIds)
          .eq('user_id', req.user.id),
      ]);

      // Only count non-empty responses
      const answeredIds = new Set([
        ...(qAnswers || []).filter(r => r.answer_text?.trim() || r.selected_options?.length).map(r => r.inline_content_id),
        ...(pollVotes || []).filter(r => r.selected_option).map(r => r.inline_content_id),
        ...(formResps || []).filter(r => {
          const v = r.response_data?.value;
          return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
        }).map(r => r.inline_content_id),
      ]);

      if (answeredIds.size > 0) {
        const toInsert = [...answeredIds].map(id => {
          const ic = formItems.find(r => r.id === id);
          return {
            user_id: req.user.id,
            chapter_id: chapterId,
            item_key: `ic:${id}`,
            item_type: ic?.content_type || 'form',
            completed_at: new Date().toISOString(),
          };
        });
        await supabase.schema('bookflow').from('chapter_item_completions')
          .upsert(toInsert, { onConflict: 'user_id,chapter_id,item_key' });

        for (const id of answeredIds) completedKeys.add(`ic:${id}`);
      }
    }

    // Also remove completion records for items whose response has been cleared
    // Check icIds that DO have a completion record but may now have an empty response
    const toValidate = icIds.filter(id => completedKeys.has(`ic:${id}`));
    if (toValidate.length > 0) {
      const [{ data: qAnswers2 }, { data: pollVotes2 }, { data: formResps2 }] = await Promise.all([
        supabase.schema('bookflow').from('question_answers')
          .select('inline_content_id, answer_text, selected_options')
          .in('inline_content_id', toValidate)
          .eq('user_id', req.user.id),
        supabase.schema('bookflow').from('poll_responses')
          .select('inline_content_id, selected_option')
          .in('inline_content_id', toValidate)
          .eq('user_id', req.user.id),
        supabase.schema('bookflow').from('form_responses')
          .select('inline_content_id, response_data')
          .in('inline_content_id', toValidate)
          .eq('user_id', req.user.id),
      ]);

      // Build a set of IDs that still have valid non-empty responses
      const stillAnswered = new Set([
        ...(qAnswers2 || []).filter(r => r.answer_text?.trim() || r.selected_options?.length).map(r => r.inline_content_id),
        ...(pollVotes2 || []).filter(r => r.selected_option).map(r => r.inline_content_id),
        ...(formResps2 || []).filter(r => {
          const v = r.response_data?.value;
          return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
        }).map(r => r.inline_content_id),
      ]);

      // media items (audio/video) have no response table — always keep their completions
      const mediaTypes = new Set(['audio', 'video']);
      const keysToRemove = toValidate.filter(id => {
        const ic = formItems.find(r => r.id === id);
        return !mediaTypes.has(ic?.content_type) && !stillAnswered.has(id);
      });

      if (keysToRemove.length > 0) {
        await supabase.schema('bookflow').from('chapter_item_completions')
          .delete()
          .eq('user_id', req.user.id)
          .eq('chapter_id', chapterId)
          .in('item_key', keysToRemove.map(id => `ic:${id}`));

        for (const id of keysToRemove) completedKeys.delete(`ic:${id}`);
      }
    }

    res.json({
      completions: [...completedKeys],
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
    // Load all chapters for the book (include draft so authors see progress too)
    const { data: chapters, error: chErr } = await supabase
      .schema('bookflow')
      .from('chapters')
      .select('id')
      .eq('book_id', bookId)
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

    // Find inline items missing a completion record — check actual response tables
    const allIcIds = (allInline || []).map(ic => ic.id);
    const completedIcIds = new Set(
      (allCompletions || []).map(c => c.item_key.startsWith('ic:') ? c.item_key.slice(3) : null).filter(Boolean)
    );
    const missingIds = allIcIds.filter(id => !completedIcIds.has(id));

    // All IDs to validate against response tables (missing + already-completed non-media)
    const mediaTypes = new Set(['audio', 'video']);
    const nonMediaIcIds = (allInline || []).filter(ic => !mediaTypes.has(ic.content_type)).map(ic => ic.id);
    const allValidateIds = [...new Set([...missingIds, ...nonMediaIcIds.filter(id => completedIcIds.has(id))])];

    if (allValidateIds.length > 0) {
      const [{ data: qAnswers }, { data: pollVotes }, { data: formResps }] = await Promise.all([
        supabase.schema('bookflow').from('question_answers')
          .select('inline_content_id, answer_text, selected_options')
          .in('inline_content_id', allValidateIds)
          .eq('user_id', req.user.id),
        supabase.schema('bookflow').from('poll_responses')
          .select('inline_content_id, selected_option')
          .in('inline_content_id', allValidateIds)
          .eq('user_id', req.user.id),
        supabase.schema('bookflow').from('form_responses')
          .select('inline_content_id, response_data')
          .in('inline_content_id', allValidateIds)
          .eq('user_id', req.user.id),
      ]);

      const hasValidResponse = (id) => {
        const q = (qAnswers || []).find(r => r.inline_content_id === id);
        if (q) return !!(q.answer_text?.trim() || q.selected_options?.length);
        const p = (pollVotes || []).find(r => r.inline_content_id === id);
        if (p) return !!p.selected_option;
        const f = (formResps || []).find(r => r.inline_content_id === id);
        if (f) {
          const v = f.response_data?.value;
          return v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
        }
        return false;
      };

      // Back-fill missing completions that have valid responses
      const toInsert = missingIds.filter(hasValidResponse).map(id => {
        const ic = (allInline || []).find(r => r.id === id);
        return { user_id: req.user.id, chapter_id: ic?.chapter_id, item_key: `ic:${id}`, item_type: ic?.content_type || 'form', completed_at: new Date().toISOString() };
      }).filter(r => r.chapter_id);

      // Remove stale completions whose response is now empty
      const toRemove = nonMediaIcIds.filter(id => completedIcIds.has(id) && !hasValidResponse(id));

      await Promise.all([
        toInsert.length > 0 ? supabase.schema('bookflow').from('chapter_item_completions')
          .upsert(toInsert, { onConflict: 'user_id,chapter_id,item_key' }) : Promise.resolve(),
        toRemove.length > 0 ? supabase.schema('bookflow').from('chapter_item_completions')
          .delete().eq('user_id', req.user.id).in('item_key', toRemove.map(id => `ic:${id}`))
          .in('chapter_id', chapterIds) : Promise.resolve(),
      ]);

      // Apply changes to completedByChapter for immediate correct response
      for (const id of missingIds.filter(hasValidResponse)) {
        const ic = (allInline || []).find(r => r.id === id);
        if (!ic) continue;
        if (!completedByChapter[ic.chapter_id]) completedByChapter[ic.chapter_id] = new Set();
        completedByChapter[ic.chapter_id].add(`ic:${id}`);
      }
      for (const id of toRemove) {
        const ic = (allInline || []).find(r => r.id === id);
        if (!ic) continue;
        completedByChapter[ic.chapter_id]?.delete(`ic:${id}`);
      }
    }

    // Build stats per chapter
    const stats = (chapters || []).map(ch => {
      const formKeys = (inlineByChapter[ch.id] || []).map(r => `ic:${r.id}`);
      const total = formKeys.length;
      const completedSet = completedByChapter[ch.id] || new Set();
      const completed = formKeys.filter(k => completedSet.has(k)).length;
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
      .select('user_id, role, profile:profiles!club_members_user_id_fkey(display_name, avatar_url)')
      .eq('club_id', clubId)
      .not('invite_accepted_at', 'is', null);

    const { data: members, error: mErr } = canSeeAll
      ? await membersQuery
      : await membersQuery.eq('user_id', req.user.id);

    if (mErr) throw mErr;

    // Load current club book (fall back to most recently added if none marked current)
    let { data: clubBook } = await supabase
      .schema('bookflow')
      .from('club_books')
      .select('book_id')
      .eq('club_id', clubId)
      .eq('is_current', true)
      .maybeSingle();

    if (!clubBook) {
      const { data: fallback } = await supabase
        .schema('bookflow')
        .from('club_books')
        .select('book_id')
        .eq('club_id', clubId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      clubBook = fallback;
    }

    if (!clubBook) return res.json({ members: [], chapters: [] });

    // Load all chapters for the current book (ordered for consistent breakdown array)
    const { data: chapters } = await supabase
      .schema('bookflow')
      .from('chapters')
      .select('id, title, order_index, content')
      .eq('book_id', clubBook.book_id)
      .eq('status', 'published')
      .order('order_index', { ascending: true });

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

      // Per-chapter breakdown: completed items and total items per chapter (in order)
      const chapters_breakdown = (chapters || []).map(ch => ({
        chapter_id: ch.id,
        completed: userCompletions.filter(c => c.chapter_id === ch.id).length,
        total: totalByChapter[ch.id] || 0,
      }));

      const completedChapters = chapters_breakdown.filter(b => b.total > 0 && b.completed >= b.total).length;

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
        chapters_breakdown,
        last_active: lastActive,
      };
    });

    res.json({
      members: result,
      chapters: (chapters || []).map(c => ({ id: c.id, title: c.title })),
    });
  } catch (err) {
    console.error('Club progress error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/progress/my-submissions/:bookId
 * Returns the authenticated user's completions + submitted responses for a book,
 * grouped by chapter. Used for per-user reading stats on the Dashboard.
 */
router.get('/my-submissions/:bookId', authenticate, async (req, res) => {
  const { bookId } = req.params;

  try {
    // Load published chapters ordered
    const { data: chapters, error: chErr } = await supabase
      .schema('bookflow')
      .from('chapters')
      .select('id, title, order_index, content')
      .eq('book_id', bookId)
      .eq('status', 'published')
      .order('order_index', { ascending: true });

    if (chErr) throw chErr;
    const chapterIds = (chapters || []).map(c => c.id);

    // Load inline content and completions in parallel
    const [{ data: allInline }, { data: completions }] = await Promise.all([
      supabase.schema('bookflow').from('inline_content')
        .select('id, chapter_id, content_type, content_data')
        .in('chapter_id', chapterIds)
        .in('content_type', TRACKABLE_TYPES),
      supabase.schema('bookflow').from('chapter_item_completions')
        .select('chapter_id, item_key, item_type, completed_at')
        .eq('user_id', req.user.id)
        .in('chapter_id', chapterIds),
    ]);

    // Batch load all responses for completed ic: items
    const icIds = (completions || [])
      .filter(c => c.item_key.startsWith('ic:'))
      .map(c => c.item_key.slice(3));

    const [{ data: qAnswers }, { data: pollVotes }, { data: formResps }] = await Promise.all([
      icIds.length ? supabase.schema('bookflow').from('question_answers')
        .select('inline_content_id, answer_text, selected_options, is_correct')
        .in('inline_content_id', icIds).eq('user_id', req.user.id) : Promise.resolve({ data: [] }),
      icIds.length ? supabase.schema('bookflow').from('poll_responses')
        .select('inline_content_id, selected_option')
        .in('inline_content_id', icIds).eq('user_id', req.user.id) : Promise.resolve({ data: [] }),
      icIds.length ? supabase.schema('bookflow').from('form_responses')
        .select('inline_content_id, response_data')
        .in('inline_content_id', icIds).eq('user_id', req.user.id) : Promise.resolve({ data: [] }),
    ]);

    // Build lookup maps
    const inlineMap = Object.fromEntries((allInline || []).map(ic => [ic.id, ic]));
    const qMap = Object.fromEntries((qAnswers || []).map(r => [r.inline_content_id, r]));
    const pollMap = Object.fromEntries((pollVotes || []).map(r => [r.inline_content_id, r]));
    const formMap = Object.fromEntries((formResps || []).map(r => [r.inline_content_id, r]));

    // Group completions by chapter
    const byChapter = {};
    for (const ch of (chapters || [])) byChapter[ch.id] = [];
    for (const comp of (completions || [])) {
      if (!byChapter[comp.chapter_id]) byChapter[comp.chapter_id] = [];
      byChapter[comp.chapter_id].push(comp);
    }

    // Build totalByChapter
    const totalByChapter = {};
    for (const ch of (chapters || [])) {
      const formCount = (allInline || []).filter(ic => ic.chapter_id === ch.id).length;
      const mediaCount = extractMediaKeys(ch.content?.content || [], ch.id).length;
      totalByChapter[ch.id] = formCount + mediaCount;
    }

    const chapterData = (chapters || []).map(ch => {
      const chCompletions = byChapter[ch.id] || [];
      const items = chCompletions.map(comp => {
        if (comp.item_key.startsWith('ic:')) {
          const icId = comp.item_key.slice(3);
          const ic = inlineMap[icId];
          const ct = ic?.content_type;
          let prompt = ic?.content_data?.label || ic?.content_data?.question || ic?.content_data?.prompt || '';
          let response = null;
          if (ct === 'question') response = qMap[icId] ? { answer_text: qMap[icId].answer_text, selected_options: qMap[icId].selected_options, is_correct: qMap[icId].is_correct } : null;
          else if (ct === 'poll') response = pollMap[icId] ? { selected_option: pollMap[icId].selected_option } : null;
          else response = formMap[icId] ? formMap[icId].response_data : null;
          return { item_key: comp.item_key, item_type: comp.item_type, content_type: ct, prompt, response, completed_at: comp.completed_at };
        }
        // media item
        return { item_key: comp.item_key, item_type: comp.item_type, content_type: comp.item_type, prompt: null, response: null, completed_at: comp.completed_at };
      });

      return {
        chapter_id: ch.id,
        chapter_title: ch.title,
        order_index: ch.order_index,
        completed: chCompletions.length,
        total: totalByChapter[ch.id] || 0,
        items,
      };
    });

    res.json({ chapters: chapterData });
  } catch (err) {
    console.error('My submissions error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
