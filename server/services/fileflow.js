/**
 * FileFlow API Client
 * Handles file storage operations via FileFlow service
 */

import supabase from '../config/supabase.js';

const FILEFLOW_URL = process.env.FILEFLOW_URL || 'http://localhost:8680';

export class FileFlowClient {
  constructor(token) {
    this.token = token;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${FILEFLOW_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `FileFlow request failed: ${response.status}`);
    }

    return response.json();
  }

  /** Get upload URL for direct upload to storage */
  async getUploadUrl(fileName, fileType, folderId = null) {
    return this.request('/api/files/upload-url', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileType, folderId })
    });
  }

  /** Create file record after upload */
  async createFile(fileData) {
    return this.request('/api/files', {
      method: 'POST',
      body: JSON.stringify(fileData)
    });
  }

  /** Upload a Buffer directly to FileFlow storage and register it */
  async uploadBuffer(buffer, fileName, mimeType, folderId = null) {
    const { uploadUrl, storagePath } = await this.getUploadUrl(fileName, mimeType, folderId);

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: buffer,
    });
    if (!uploadRes.ok) throw new Error(`FileFlow storage upload failed: ${uploadRes.status}`);

    const fileRecord = await this.createFile({
      name: fileName,
      mime_type: mimeType,
      size_bytes: buffer.length,
      storage_path: storagePath,
      bucket_name: 'files',
      folder_id: folderId || null,
    });

    return fileRecord;
  }

  /** Get download URL for a file (1-hour signed URL) */
  async getDownloadUrl(fileId) {
    return this.request(`/api/storage/download/${fileId}`);
  }

  /** Delete a file */
  async deleteFile(fileId) {
    return this.request(`/api/files/${fileId}`, { method: 'DELETE' });
  }

  /** List files in a folder */
  async listFiles(folderId = null) {
    const query = folderId ? `?folder_id=${folderId}` : '';
    return this.request(`/api/files${query}`);
  }

  /** Create a folder */
  async createFolder(name, parentId = null) {
    return this.request('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parent_id: parentId })
    });
  }

  /** List root-level or child folders */
  async listFolders(parentId = null) {
    const query = parentId ? `?parent_id=${parentId}` : '';
    return this.request(`/api/folders${query}`);
  }

  /** Create a public share link for a file */
  async createShareLink(fileId, options = {}) {
    return this.request(`/api/files/${fileId}/links`, {
      method: 'POST',
      body: JSON.stringify({ allow_download: true, ...options })
    });
  }
}

/**
 * Retrieve the FileFlow token for a given request.
 * Priority:
 *  1. User's own Supabase JWT (passed directly — both apps share the same Supabase instance)
 *  2. Per-user fileflow_access_key from app_settings
 *  3. FILEFLOW_SERVICE_TOKEN env var
 */
export async function getFileFlowToken(userId, userJwt = null) {
  // Prefer the user's own JWT — FileFlow validates it against the same Supabase instance
  if (userJwt) return userJwt;

  try {
    const { data } = await supabase
      .from('app_settings')
      .select('fileflow_access_key')
      .eq('user_id', userId)
      .maybeSingle();

    if (data?.fileflow_access_key) return data.fileflow_access_key;
  } catch {
    // Table may not exist yet — fall through to env var
  }

  return process.env.FILEFLOW_SERVICE_TOKEN || '';
}

/**
 * Ensure the per-book folder structure exists in FileFlow:
 *   bookflow/ -> {bookTitle} ({bookId})/ -> images/, videos/, backups/
 *
 * Caches folder IDs in book_fileflow_folders to avoid redundant API calls.
 */
export async function ensureBookFolders(bookId, bookTitle, userToken) {
  const { data: cached } = await supabase
    .from('book_fileflow_folders')
    .select('*')
    .eq('book_id', bookId)
    .maybeSingle();

  if (cached) return cached;

  const client = new FileFlowClient(userToken);

  // Find or create the top-level "bookflow" folder
  let bookflowFolderId;
  try {
    const folders = await client.listFolders();
    const existing = Array.isArray(folders) && folders.find(f => f.name === 'bookflow' && !f.parent_id);
    bookflowFolderId = existing ? existing.id : (await client.createFolder('bookflow', null)).id;
  } catch {
    bookflowFolderId = (await client.createFolder('bookflow', null)).id;
  }

  const bookFolderName = `${bookTitle} (${bookId})`.slice(0, 128);
  const bookFolder = await client.createFolder(bookFolderName, bookflowFolderId);

  const [imagesFolder, videosFolder, backupsFolder] = await Promise.all([
    client.createFolder('images', bookFolder.id),
    client.createFolder('videos', bookFolder.id),
    client.createFolder('backups', bookFolder.id),
  ]);

  const record = {
    book_id: bookId,
    root_folder_id: bookFolder.id,
    images_folder_id: imagesFolder.id,
    videos_folder_id: videosFolder.id,
    backups_folder_id: backupsFolder.id,
  };

  await supabase.from('book_fileflow_folders').insert(record);
  return record;
}

export default FileFlowClient;
