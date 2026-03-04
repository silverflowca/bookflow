/**
 * ChangeFlow API Client
 * Handles change tracking via ChangeFlow service
 */

const CHANGEFLOW_URL = process.env.CHANGEFLOW_URL || 'http://localhost:3006';

export class ChangeFlowClient {
  constructor(projectId) {
    this.projectId = projectId;
  }

  async request(endpoint, options = {}) {
    const response = await fetch(`${CHANGEFLOW_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `ChangeFlow request failed: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Record a change
   */
  async recordChange(changeData) {
    return this.request('/api/changes', {
      method: 'POST',
      body: JSON.stringify({
        project: this.projectId,
        ...changeData
      })
    });
  }

  /**
   * Get changes for project
   */
  async getChanges(filters = {}) {
    const params = new URLSearchParams({
      project: this.projectId,
      ...filters
    });
    return this.request(`/api/changes?${params}`);
  }

  /**
   * Get a specific change
   */
  async getChange(changeId) {
    return this.request(`/api/changes/${changeId}`);
  }

  /**
   * Check service health
   */
  async checkHealth() {
    try {
      const response = await fetch(`${CHANGEFLOW_URL}/api/health`, {
        timeout: 5000
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Create a ChangeFlow client for a book
 */
export function createBookChangeClient(bookId) {
  return new ChangeFlowClient(`bookflow-${bookId}`);
}

export default ChangeFlowClient;
