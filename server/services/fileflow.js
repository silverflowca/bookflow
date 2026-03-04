/**
 * FileFlow API Client
 * Handles file storage operations via FileFlow service
 */

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

  /**
   * Get upload URL for direct upload to storage
   */
  async getUploadUrl(fileName, fileType) {
    return this.request('/api/files/upload-url', {
      method: 'POST',
      body: JSON.stringify({ fileName, fileType })
    });
  }

  /**
   * Create file record after upload
   */
  async createFile(fileData) {
    return this.request('/api/files', {
      method: 'POST',
      body: JSON.stringify(fileData)
    });
  }

  /**
   * Get download URL for a file
   */
  async getDownloadUrl(fileId) {
    return this.request(`/api/storage/download/${fileId}`);
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId) {
    return this.request(`/api/files/${fileId}`, {
      method: 'DELETE'
    });
  }

  /**
   * List files in a folder
   */
  async listFiles(folderId = null) {
    const query = folderId ? `?folder_id=${folderId}` : '';
    return this.request(`/api/files${query}`);
  }

  /**
   * Create a folder
   */
  async createFolder(name, parentId = null) {
    return this.request('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ name, parent_id: parentId })
    });
  }
}

export default FileFlowClient;
