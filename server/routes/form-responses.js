import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// Upsert own response for a form element
router.post('/form-responses/:contentId', authenticate, async (req, res) => {
  const { response_data } = req.body;
  const { contentId } = req.params;

  if (!response_data) {
    return res.status(400).json({ error: 'response_data is required' });
  }

  try {
    // Verify content exists and user has access
    const { data: content, error: contentError } = await supabase
      .from('inline_content')
      .select('id, book_id, book:books(author_id, visibility)')
      .eq('id', contentId)
      .single();

    if (contentError) throw contentError;

    const isAuthor = req.user.id === content.book.author_id;
    if (content.book.visibility !== 'public' && !isAuthor) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { data, error } = await supabase
      .from('form_responses')
      .upsert({
        inline_content_id: contentId,
        user_id: req.user.id,
        response_data,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'inline_content_id,user_id' })
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Submit form response error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get own response for a form element
router.get('/form-responses/:contentId/mine', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('form_responses')
      .select('*')
      .eq('inline_content_id', req.params.contentId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) throw error;

    res.json(data || null);
  } catch (err) {
    console.error('Get form response error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all responses for a form element (author only)
// Returns responses + aggregate counts for choice-type elements
router.get('/form-responses/:contentId/all', authenticate, async (req, res) => {
  try {
    // Verify user is the book author
    const { data: content, error: contentError } = await supabase
      .from('inline_content')
      .select('id, content_type, content_data, book:books(author_id)')
      .eq('id', req.params.contentId)
      .single();

    if (contentError) throw contentError;

    if (content.book.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Only the book author can view all responses' });
    }

    const { data: responses, error } = await supabase
      .from('form_responses')
      .select(`
        *,
        user:profiles!form_responses_user_id_fkey(id, display_name, avatar_url)
      `)
      .eq('inline_content_id', req.params.contentId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Build aggregates for choice-type elements
    const choiceTypes = ['select', 'multiselect', 'radio', 'checkbox'];
    let aggregates = null;

    if (choiceTypes.includes(content.content_type)) {
      const counts = {};
      const options = content.content_data?.options || [];

      // Initialize counts for all options
      options.forEach(opt => { counts[opt.id] = 0; });

      responses.forEach(r => {
        const val = r.response_data?.value;
        if (!val) return;
        if (Array.isArray(val)) {
          val.forEach(v => { if (counts[v] !== undefined) counts[v]++; });
        } else {
          if (counts[val] !== undefined) counts[val]++;
        }
      });

      aggregates = {
        counts,
        total: responses.length,
        options: options.map(opt => ({
          id: opt.id,
          text: opt.text,
          count: counts[opt.id] || 0,
          percent: responses.length > 0
            ? Math.round(((counts[opt.id] || 0) / responses.length) * 100)
            : 0,
        })),
      };
    }

    res.json({ responses, aggregates, total: responses.length });
  } catch (err) {
    console.error('Get all form responses error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
