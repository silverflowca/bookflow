import express from 'express';
import supabase from '../config/supabase.js';
import { authenticateAny } from '../middleware/auth.js';
import { FileFlowClient } from '../services/fileflow.js';

const router = express.Router();

const ALLOWED_CONTENT_TYPES = [
  'question', 'poll', 'highlight', 'note', 'link', 'audio', 'video',
  'select', 'multiselect', 'textbox', 'textarea', 'radio', 'checkbox',
  'code_block', 'scripture_block', 'image', 'drawing',
];

const ALLOWED_COLLAB_ROLES = ['author', 'editor', 'reviewer'];

/** Extract plain text from TipTap JSON */
function extractText(node) {
  if (!node) return '';
  if (node.type === 'text') return node.text || '';
  if (Array.isArray(node.content)) {
    return node.content.map(extractText).join('');
  }
  return '';
}

/** Decode base64 data URI and upload to FileFlow, falling back to Supabase storage */
async function uploadBase64Cover(dataUri, token) {
  const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid base64 data URI for cover_image');
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  const ext = mimeType.split('/')[1]?.split('+')[0] || 'jpg';
  const fileName = `cover-${Date.now()}.${ext}`;

  // Try FileFlow first
  try {
    const ff = new FileFlowClient(token);
    const record = await ff.uploadBuffer(buffer, fileName, mimeType);
    return record.url || record.public_url || record.storage_path;
  } catch {
    // Fall back to Supabase storage
    const { data, error } = await supabase.storage
      .from('bookflow-media')
      .upload(`covers/${fileName}`, buffer, { contentType: mimeType, upsert: false });
    if (error) throw new Error(`Cover upload failed: ${error.message}`);
    const { data: urlData } = supabase.storage.from('bookflow-media').getPublicUrl(data.path);
    return urlData.publicUrl;
  }
}

// ── POST /api/import/books ─────────────────────────────────────────────────
router.post('/books', authenticateAny, async (req, res) => {
  const userId = req.user.id;
  const {
    external_id,
    book: bookPayload = {},
    settings: settingsPayload = {},
    chapters: chaptersPayload = [],
    collaborators: collaboratorsPayload = [],
  } = req.body;

  // Validation
  if (!bookPayload.title?.trim()) {
    return res.status(400).json({ error: 'book.title is required' });
  }
  if (bookPayload.visibility && !['private', 'public'].includes(bookPayload.visibility)) {
    return res.status(400).json({ error: 'book.visibility must be "private" or "public"' });
  }
  if (bookPayload.status && !['draft', 'published'].includes(bookPayload.status)) {
    return res.status(400).json({ error: 'book.status must be "draft" or "published"' });
  }

  const warnings = [];
  let isUpdate = false;
  let existingBookId = null;

  // Check idempotency
  if (external_id) {
    const { data: existing } = await supabase
      .from('api_book_imports')
      .select('book_id')
      .eq('user_id', userId)
      .eq('external_id', external_id)
      .maybeSingle();
    if (existing) {
      isUpdate = true;
      existingBookId = existing.book_id;
    }
  }

  // Upload cover if base64 provided
  let coverUrl = bookPayload.cover_image_url || null;
  if (bookPayload.cover_image && bookPayload.cover_image.startsWith('data:')) {
    try {
      coverUrl = await uploadBase64Cover(bookPayload.cover_image, req.token);
    } catch (err) {
      warnings.push(`Cover image upload failed: ${err.message}`);
    }
  }

  let bookId;

  if (isUpdate) {
    // Update existing book
    bookId = existingBookId;
    const updates = {};
    if (bookPayload.title) updates.title = bookPayload.title.trim();
    if (bookPayload.subtitle !== undefined) updates.subtitle = bookPayload.subtitle;
    if (bookPayload.description !== undefined) updates.description = bookPayload.description;
    if (bookPayload.visibility) updates.visibility = bookPayload.visibility;
    if (bookPayload.status) updates.status = bookPayload.status;
    if (coverUrl) updates.cover_image_url = coverUrl;
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase.from('books').update(updates).eq('id', bookId);
    if (error) return res.status(500).json({ error: `Failed to update book: ${error.message}` });
  } else {
    // Insert new book
    const { data: newBook, error } = await supabase
      .from('books')
      .insert({
        author_id: userId,
        title: bookPayload.title.trim(),
        subtitle: bookPayload.subtitle || null,
        description: bookPayload.description || null,
        visibility: bookPayload.visibility || 'private',
        status: bookPayload.status || 'draft',
        cover_image_url: coverUrl || null,
      })
      .select('id')
      .single();
    if (error) return res.status(500).json({ error: `Failed to create book: ${error.message}` });
    bookId = newBook.id;
  }

  // Upsert book settings
  if (Object.keys(settingsPayload).length > 0) {
    const { error } = await supabase
      .from('book_settings')
      .upsert({ book_id: bookId, ...settingsPayload }, { onConflict: 'book_id' });
    if (error) warnings.push(`Settings upsert failed: ${error.message}`);
  }

  // Insert chapters
  const createdChapters = [];
  let inlineContentCount = 0;

  for (let i = 0; i < chaptersPayload.length; i++) {
    const ch = chaptersPayload[i];
    if (!ch.title?.trim()) {
      warnings.push(`Chapter at index ${i} skipped: missing title`);
      continue;
    }

    const orderIndex = ch.order_index ?? i;
    const contentText = ch.content_text || (ch.content ? extractText(ch.content) : '');

    const { data: newCh, error: chErr } = await supabase
      .from('chapters')
      .insert({
        book_id: bookId,
        title: ch.title.trim(),
        order_index: orderIndex,
        status: ch.status || 'draft',
        content: ch.content || { type: 'doc', content: [] },
        content_text: contentText,
      })
      .select('id, title, order_index')
      .single();

    if (chErr) {
      warnings.push(`Chapter "${ch.title}" failed: ${chErr.message}`);
      continue;
    }

    createdChapters.push(newCh);

    // Insert inline content for this chapter
    for (const ic of ch.inline_content || []) {
      if (!ALLOWED_CONTENT_TYPES.includes(ic.content_type)) {
        warnings.push(`Inline content type "${ic.content_type}" in chapter "${ch.title}" is invalid — skipped`);
        continue;
      }
      const { error: icErr } = await supabase.from('inline_content').insert({
        chapter_id: newCh.id,
        content_type: ic.content_type,
        position_in_chapter: ic.position_in_chapter || 'end_of_chapter',
        visibility: ic.visibility || 'all_readers',
        response_visibility: ic.response_visibility || 'private',
        anchor_text: ic.anchor_text || '',
        start_offset: ic.start_offset ?? 0,
        end_offset: ic.end_offset ?? 0,
        content_data: ic.content_data || {},
        is_author_content: ic.is_author_content ?? false,
      });
      if (icErr) {
        warnings.push(`Inline content in chapter "${ch.title}" failed: ${icErr.message}`);
      } else {
        inlineContentCount++;
      }
    }
  }

  // Resolve collaborators by email
  let collaboratorsInvited = 0;
  for (const collab of collaboratorsPayload) {
    if (!ALLOWED_COLLAB_ROLES.includes(collab.role)) {
      warnings.push(`Collaborator role "${collab.role}" is invalid — skipped`);
      continue;
    }
    // Look up user by email via auth admin (service role required)
    const { data: profileMatch } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', collab.email)
      .maybeSingle();

    if (!profileMatch) {
      warnings.push(`Collaborator email "${collab.email}" not found — skipped`);
      continue;
    }

    const { error: collabErr } = await supabase
      .from('book_collaborators')
      .upsert({
        book_id: bookId,
        user_id: profileMatch.id,
        role: collab.role,
        invite_accepted_at: new Date().toISOString(),
      }, { onConflict: 'book_id,user_id' });

    if (collabErr) {
      warnings.push(`Collaborator "${collab.email}" failed: ${collabErr.message}`);
    } else {
      collaboratorsInvited++;
    }
  }

  // Record external_id mapping
  if (external_id && !isUpdate) {
    await supabase.from('api_book_imports').insert({ user_id: userId, external_id, book_id: bookId });
  }

  const status = isUpdate ? 200 : 201;
  return res.status(status).json({
    book_id: bookId,
    external_id: external_id || null,
    created: !isUpdate,
    chapters: createdChapters,
    inline_content_count: inlineContentCount,
    collaborators_invited: collaboratorsInvited,
    warnings,
  });
});

// ── GET /api/import/books ──────────────────────────────────────────────────
router.get('/books', authenticateAny, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('api_book_imports')
      .select('external_id, book_id, created_at, books(id, title, status, visibility)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/import/books/:externalId ─────────────────────────────────────
router.get('/books/:externalId', authenticateAny, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('api_book_imports')
      .select('external_id, book_id, created_at, books(id, title, status, visibility)')
      .eq('user_id', req.user.id)
      .eq('external_id', req.params.externalId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Not found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
