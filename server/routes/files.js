import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { FileFlowClient, getFileFlowToken, ensureBookFolders } from '../services/fileflow.js';

const router = express.Router();

// Determine which FileFlow folder to use based on file MIME type
function pickFolder(folders, mimeType) {
  if (!mimeType) return folders.root_folder_id;
  if (mimeType.startsWith('image/')) return folders.images_folder_id;
  if (mimeType.startsWith('video/')) return folders.videos_folder_id;
  return folders.root_folder_id;
}

// Extract the Bearer JWT from the request (passed through to FileFlow)
function extractJwt(req) {
  const auth = req.headers.authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

// POST /files/upload — get a signed upload URL via FileFlow
router.post('/upload', authenticate, async (req, res) => {
  const { file_name, file_type, book_id } = req.body;
  if (!file_name || !file_type) {
    return res.status(400).json({ error: 'file_name and file_type are required' });
  }

  try {
    const token = await getFileFlowToken(req.user.id, extractJwt(req));
    if (!token) {
      return res.status(503).json({ error: 'FileFlow is not configured. Add your FileFlow API key in Settings.' });
    }

    let folderId = null;
    if (book_id) {
      const { data: book } = await supabase
        .from('books')
        .select('title')
        .eq('id', book_id)
        .single();

      if (book) {
        const folders = await ensureBookFolders(book_id, book.title, token);
        folderId = pickFolder(folders, file_type);
      }
    }

    const client = new FileFlowClient(token);
    const { uploadUrl, storagePath } = await client.getUploadUrl(file_name, file_type, folderId);

    return res.json({
      upload_url: uploadUrl,
      storage_path: storagePath,
      fileflow_folder_id: folderId,
    });
  } catch (err) {
    console.error('File upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /files/register — record uploaded file after client PUT to signed URL
router.post('/register', authenticate, async (req, res) => {
  const {
    fileflow_file_id: providedFileflowId,
    file_type,
    display_name,
    file_url,
    storage_path,
    file_name,
    file_size,
    book_id,
    chapter_id,
    inline_content_id,
  } = req.body;

  try {
    let fileflowFileId = providedFileflowId || null;
    let finalUrl = file_url;

    const token = await getFileFlowToken(req.user.id, extractJwt(req));

    // If uploaded via FileFlow signed URL but no fileflow_file_id yet,
    // register the file in FileFlow now to get its ID and a usable URL.
    const fileflow_folder_id = req.body.fileflow_folder_id || null;
    if (!fileflowFileId && storage_path && token) {
      try {
        const client = new FileFlowClient(token);
        const fileRecord = await client.createFile({
          name: file_name || display_name || 'file',
          mime_type: file_type,
          size_bytes: file_size || 0,
          storage_path,
          bucket_name: 'files',
          folder_id: fileflow_folder_id,
        });
        fileflowFileId = fileRecord.id;
        // Fetch a signed download URL
        try {
          const { url } = await client.getDownloadUrl(fileflowFileId);
          finalUrl = url;
        } catch { /* use storage_path fallback */ }
      } catch (ffErr) {
        console.warn('[files/register] Could not register in FileFlow:', ffErr.message);
      }
    }

    // If we have a fileflow_file_id but still no URL, fetch it
    if (!finalUrl && fileflowFileId && token) {
      try {
        const client = new FileFlowClient(token);
        const { url } = await client.getDownloadUrl(fileflowFileId);
        finalUrl = url;
      } catch { /* fallback below */ }
    }

    // Last resort: store the storage_path so the file_reference isn't lost
    if (!finalUrl && storage_path) {
      finalUrl = storage_path;
    }

    const { data, error } = await supabase
      .from('file_references')
      .insert({
        fileflow_file_id: fileflowFileId,
        file_type,
        display_name: display_name || file_name,
        file_url: finalUrl,
        book_id,
        chapter_id,
        inline_content_id,
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

// GET /files/:fileId/url — get a fresh download URL for a registered file
router.get('/:fileId/url', authenticate, async (req, res) => {
  try {
    const { data: fileRef, error: refError } = await supabase
      .from('file_references')
      .select('fileflow_file_id, file_url')
      .eq('id', req.params.fileId)
      .single();

    if (refError) throw refError;

    // Prefer a fresh signed URL from FileFlow
    if (fileRef.fileflow_file_id) {
      const token = await getFileFlowToken(req.user.id, extractJwt(req));
      if (token) {
        const client = new FileFlowClient(token);
        const { url } = await client.getDownloadUrl(fileRef.fileflow_file_id);
        return res.json({ url });
      }
    }

    if (fileRef.file_url) return res.json({ url: fileRef.file_url });

    return res.status(404).json({ error: 'File URL not available' });
  } catch (err) {
    console.error('Get file URL error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /files/book/:bookId — list file references for a book
router.get('/book/:bookId', authenticate, async (req, res) => {
  const { file_type } = req.query;

  try {
    let query = supabase
      .from('file_references')
      .select('*')
      .eq('book_id', req.params.bookId)
      .order('created_at', { ascending: false });

    if (file_type) query = query.eq('file_type', file_type);

    const { data, error } = await query;
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Get book files error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /files/:fileId — delete a file reference (and optionally from FileFlow)
router.delete('/:fileId', authenticate, async (req, res) => {
  try {
    const { data: fileRef, error: refError } = await supabase
      .from('file_references')
      .select('book_id, fileflow_file_id, book:books(author_id)')
      .eq('id', req.params.fileId)
      .single();

    if (refError) throw refError;

    if (fileRef.book.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete from FileFlow if we have the ID
    if (fileRef.fileflow_file_id) {
      const token = await getFileFlowToken(req.user.id, extractJwt(req));
      if (token) {
        const client = new FileFlowClient(token);
        await client.deleteFile(fileRef.fileflow_file_id).catch(() => {});
      }
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
