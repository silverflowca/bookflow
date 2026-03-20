import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const DEFAULT_FILEFLOW_URL = process.env.FILEFLOW_URL || 'http://localhost:8680';

async function getUserFileflowSettings(userId) {
  const { data } = await supabase
    .from('app_settings')
    .select('fileflow_url, fileflow_access_key')
    .eq('user_id', userId)
    .maybeSingle();
  return {
    url: data?.fileflow_url || DEFAULT_FILEFLOW_URL,
    accessKey: data?.fileflow_access_key || null,
  };
}

// Proxy file upload to FileFlow
router.post('/upload', authenticate, async (req, res) => {
  const { file_name, file_type, file_size, book_id, chapter_id, inline_content_id, display_name } = req.body;

  try {
    const { url: fileflowUrl, accessKey } = await getUserFileflowSettings(req.user.id);

    // Get upload URL from FileFlow
    const authHeader = accessKey ? `Bearer ${accessKey}` : `Bearer ${req.token}`;
    const response = await fetch(`${fileflowUrl}/api/files/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        fileName: file_name,
        fileType: file_type
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'FileFlow upload failed');
    }

    const uploadData = await response.json();

    res.json({
      upload_url: uploadData.uploadUrl,
      storage_path: uploadData.storagePath,
      token: uploadData.token
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Register uploaded file in BookFlow
router.post('/register', authenticate, async (req, res) => {
  const {
    fileflow_file_id,
    file_type,
    display_name,
    file_url,
    storage_path,
    file_name,
    book_id,
    chapter_id,
    inline_content_id
  } = req.body;

  try {
    // Build the public URL if we have a storage path
    let finalUrl = file_url;
    if (!finalUrl && storage_path) {
      const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:55321';
      finalUrl = `${supabaseUrl}/storage/v1/object/public/files/${storage_path}`;
    }

    const { data, error } = await supabase
      .from('file_references')
      .insert({
        fileflow_file_id: fileflow_file_id || null,
        file_type,
        display_name: display_name || file_name,
        file_url: finalUrl,
        book_id,
        chapter_id,
        inline_content_id
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (err) {
    console.error('Register file error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get download URL from FileFlow
router.get('/:fileId/url', authenticate, async (req, res) => {
  try {
    // Get file reference
    const { data: fileRef, error: refError } = await supabase
      .from('file_references')
      .select('fileflow_file_id, file_url')
      .eq('id', req.params.fileId)
      .single();

    if (refError) throw refError;

    // If we have a direct URL, return it
    if (fileRef.file_url) {
      return res.json({ url: fileRef.file_url });
    }

    // Otherwise get from FileFlow
    const { url: fileflowUrl, accessKey } = await getUserFileflowSettings(req.user.id);
    const authHeader = accessKey ? `Bearer ${accessKey}` : `Bearer ${req.token}`;
    const response = await fetch(`${fileflowUrl}/api/storage/download/${fileRef.fileflow_file_id}`, {
      headers: {
        'Authorization': authHeader
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'FileFlow download failed');
    }

    const downloadData = await response.json();
    res.json({ url: downloadData.url, fileName: downloadData.fileName });
  } catch (err) {
    console.error('Get file URL error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get files for a book
router.get('/book/:bookId', authenticate, async (req, res) => {
  const { file_type } = req.query;

  try {
    let query = supabase
      .from('file_references')
      .select('*')
      .eq('book_id', req.params.bookId)
      .order('created_at', { ascending: false });

    if (file_type) {
      query = query.eq('file_type', file_type);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Get book files error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete file reference
router.delete('/:fileId', authenticate, async (req, res) => {
  try {
    // Get file reference to check ownership
    const { data: fileRef, error: refError } = await supabase
      .from('file_references')
      .select('book_id, book:books(author_id)')
      .eq('id', req.params.fileId)
      .single();

    if (refError) throw refError;

    if (fileRef.book.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { error } = await supabase
      .from('file_references')
      .delete()
      .eq('id', req.params.fileId);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error('Delete file error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
