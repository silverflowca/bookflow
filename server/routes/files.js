import express from 'express';
import supabase from '../config/supabase.js';
import { authenticate } from '../middleware/auth.js';
import { FileFlowClient, getFileFlowToken, ensureBookFolders } from '../services/fileflow.js';

const router = express.Router();
const SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:55321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const STORAGE_BUCKET = 'bookflow-covers';

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

// POST /files/upload — get a signed upload URL (FileFlow if configured, else Supabase Storage)
router.post('/upload', authenticate, async (req, res) => {
  const { file_name, file_type, book_id } = req.body;
  if (!file_name || !file_type) {
    return res.status(400).json({ error: 'file_name and file_type are required' });
  }

  try {
    const jwt = extractJwt(req);
    const token = await getFileFlowToken(req.user.id, jwt);
    console.log('[files/upload] token present:', !!token, '| jwt present:', !!jwt, '| file:', file_name, file_type);

    // ── FileFlow path ──────────────────────────────────────────────────────────
    if (token) {
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
      return res.json({ upload_url: uploadUrl, storage_path: storagePath, fileflow_folder_id: folderId });
    }

    // ── Supabase Storage fallback ──────────────────────────────────────────────
    const storagePath = `covers/${req.user.id}/${Date.now()}_${file_name}`;
    const signedRes = await fetch(
      `${SUPABASE_URL}/storage/v1/object/sign/${STORAGE_BUCKET}/${storagePath}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
        },
        body: JSON.stringify({ expiresIn: 300 }),
      }
    );

    if (!signedRes.ok) {
      const err = await signedRes.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to get Supabase upload URL');
    }

    const { signedURL } = await signedRes.json();
    const uploadUrl = signedURL.startsWith('http') ? signedURL : `${SUPABASE_URL}${signedURL}`;
    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/${storagePath}`;

    return res.json({ upload_url: uploadUrl, storage_path: publicUrl, fileflow_folder_id: null, use_supabase: true });
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

    // When uploaded via Supabase Storage, storage_path is already the public URL
    const use_supabase = req.body.use_supabase || false;
    if (use_supabase && storage_path && !finalUrl) {
      finalUrl = storage_path;
    }

    const token = await getFileFlowToken(req.user.id, extractJwt(req));

    // If uploaded via FileFlow signed URL but no fileflow_file_id yet,
    // register the file in FileFlow now to get its ID and a usable URL.
    const fileflow_folder_id = req.body.fileflow_folder_id || null;
    if (!use_supabase && !fileflowFileId && storage_path && token) {
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
        // Fetch a signed download URL from FileFlow
        try {
          const { url } = await client.getDownloadUrl(fileflowFileId);
          finalUrl = url;
        } catch {
          // Fall back to constructing the Supabase public URL from storage_path
          // FileFlow stores files in the 'files' bucket in Supabase Storage
          if (storage_path && !storage_path.startsWith('http')) {
            finalUrl = `${SUPABASE_URL}/storage/v1/object/public/files/${storage_path}`;
          }
        }
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

    // Last resort: construct a public Supabase URL from the storage_path
    if (!finalUrl && storage_path) {
      finalUrl = storage_path.startsWith('http')
        ? storage_path
        : `${SUPABASE_URL}/storage/v1/object/public/files/${storage_path}`;
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

// GET /files/:fileId/img — image proxy: redirects to a fresh signed URL (no auth required)
// Used so cover_image_url can be a stable /api/files/:id/img URL that never expires
router.get('/:fileId/img', async (req, res) => {
  try {
    const { data: fileRef, error: refError } = await supabase
      .from('file_references')
      .select('fileflow_file_id, file_url, book_id')
      .eq('id', req.params.fileId)
      .single();

    if (refError || !fileRef) return res.status(404).json({ error: 'Not found' });

    // If it's a FileFlow file, use a service token to get a fresh signed URL
    if (fileRef.fileflow_file_id) {
      const serviceToken = process.env.FILEFLOW_SERVICE_TOKEN || '';
      if (serviceToken) {
        try {
          const client = new FileFlowClient(serviceToken);
          const { url } = await client.getDownloadUrl(fileRef.fileflow_file_id);
          return res.redirect(302, url);
        } catch { /* fall through to file_url */ }
      }
    }

    // For Supabase Storage or fallback — redirect directly to stored URL
    if (fileRef.file_url && fileRef.file_url.startsWith('http')) {
      return res.redirect(302, fileRef.file_url);
    }

    return res.status(404).json({ error: 'Image URL not available' });
  } catch (err) {
    console.error('Image proxy error:', err);
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
