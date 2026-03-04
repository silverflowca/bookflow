import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const CHANGEFLOW_URL = process.env.CHANGEFLOW_URL || 'http://localhost:3006';

// Get change history for a book
router.get('/book/:bookId', authenticate, async (req, res) => {
  const { entity_type, limit = 50, offset = 0 } = req.query;

  try {
    // Verify book ownership
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('author_id')
      .eq('id', req.params.bookId)
      .single();

    if (bookError) throw bookError;

    if (book.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get changes from local log
    let query = supabase
      .from('change_log')
      .select('*', { count: 'exact' })
      .or(`entity_id.eq.${req.params.bookId},after_data->>book_id.eq.${req.params.bookId},before_data->>book_id.eq.${req.params.bookId}`)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (entity_type) {
      query = query.eq('entity_type', entity_type);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    res.json({ data, count });
  } catch (err) {
    console.error('Get changes error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get change details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('change_log')
      .select(`
        *,
        changed_by_user:profiles!change_log_changed_by_fkey(id, display_name)
      `)
      .eq('id', req.params.id)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Get change error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Sync pending changes to ChangeFlow
router.post('/sync', authenticate, async (req, res) => {
  const { book_id } = req.body;

  try {
    // Verify book ownership
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('author_id, title')
      .eq('id', book_id)
      .single();

    if (bookError) throw bookError;

    if (book.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get unsynced changes
    const { data: changes, error: changesError } = await supabase
      .from('change_log')
      .select('*')
      .eq('synced_to_changeflow', false)
      .or(`entity_id.eq.${book_id},after_data->>book_id.eq.${book_id}`)
      .order('created_at', { ascending: true });

    if (changesError) throw changesError;

    if (!changes || changes.length === 0) {
      return res.json({ message: 'No changes to sync', synced: 0 });
    }

    // Sync each change to ChangeFlow
    const synced = [];
    for (const change of changes) {
      try {
        const response = await fetch(`${CHANGEFLOW_URL}/api/changes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            project: `bookflow-${book_id}`,
            type: change.entity_type,
            action: change.change_type,
            description: change.change_description || `${change.change_type} ${change.entity_type}`,
            before: change.before_data,
            after: change.after_data,
            timestamp: change.created_at,
            metadata: {
              bookflow_change_id: change.id,
              book_title: book.title
            }
          })
        });

        if (response.ok) {
          const result = await response.json();

          // Mark as synced
          await supabase
            .from('change_log')
            .update({
              synced_to_changeflow: true,
              changeflow_id: result.id
            })
            .eq('id', change.id);

          synced.push(change.id);
        }
      } catch (syncErr) {
        console.error(`Failed to sync change ${change.id}:`, syncErr);
      }
    }

    res.json({
      message: `Synced ${synced.length} of ${changes.length} changes`,
      synced: synced.length,
      total: changes.length
    });
  } catch (err) {
    console.error('Sync changes error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get ChangeFlow status
router.get('/status/:bookId', authenticate, async (req, res) => {
  try {
    // Count unsynced changes
    const { count: unsyncedCount, error } = await supabase
      .from('change_log')
      .select('*', { count: 'exact', head: true })
      .eq('synced_to_changeflow', false)
      .or(`entity_id.eq.${req.params.bookId},after_data->>book_id.eq.${req.params.bookId}`);

    if (error) throw error;

    // Check ChangeFlow connectivity
    let changeflowStatus = 'unknown';
    try {
      const response = await fetch(`${CHANGEFLOW_URL}/api/health`, { timeout: 5000 });
      changeflowStatus = response.ok ? 'connected' : 'unavailable';
    } catch {
      changeflowStatus = 'unavailable';
    }

    res.json({
      unsynced_count: unsyncedCount || 0,
      changeflow_status: changeflowStatus,
      changeflow_url: CHANGEFLOW_URL
    });
  } catch (err) {
    console.error('Get status error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
