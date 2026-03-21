import type {
  Book,
  Chapter,
  InlineContent,
  Profile,
  AuthResponse,
  ReadingProgress,
  ApiResponse,
  BookCollaborator,
  BookVersion,
  BookComment,
  ReviewRequest,
  UserNotification,
  CollaboratorRole,
} from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('bookflow_token', token);
    } else {
      localStorage.removeItem('bookflow_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('bookflow_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const text = await response.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Server returned invalid response (${response.status}): ${text.slice(0, 100)}`);
      }
    }

    if (!response.ok) {
      throw new Error(data.error || `Request failed (${response.status})`);
    }

    return data;
  }

  // Auth
  async register(email: string, password: string, displayName: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
    if (data.session?.access_token) {
      this.setToken(data.session.access_token);
    }
    return data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.session?.access_token) {
      this.setToken(data.session.access_token);
    }
    return data;
  }

  async logout(): Promise<void> {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async getMe(): Promise<{ user: any; profile: Profile }> {
    return this.request('/auth/me');
  }

  async updateProfile(data: Partial<Profile>): Promise<Profile> {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Books
  async getBooks(params?: { status?: string; visibility?: string; author_id?: string }): Promise<ApiResponse<Book[]>> {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request(`/books${query}`);
  }

  async getMyBooks(): Promise<Book[]> {
    return this.request('/books/my');
  }

  async searchBooks(search: string): Promise<Book[]> {
    const qs = search.trim() ? `?search=${encodeURIComponent(search)}&limit=30` : '?limit=30';
    const result = await this.request<{ data: Book[]; count: number }>(`/books${qs}`);
    return result.data ?? [];
  }

  async getBook(id: string): Promise<Book> {
    return this.request(`/books/${id}`);
  }

  async createBook(data: Partial<Book>): Promise<Book> {
    return this.request('/books', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBook(id: string, data: Partial<Book>): Promise<Book> {
    return this.request(`/books/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateBookSettings(id: string, data: Partial<Book['settings']>): Promise<Book['settings']> {
    return this.request(`/books/${id}/settings`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBook(id: string): Promise<void> {
    return this.request(`/books/${id}`, { method: 'DELETE' });
  }

  // Chapters
  async getChapters(bookId: string): Promise<Chapter[]> {
    return this.request(`/books/${bookId}/chapters`);
  }

  async getChapter(id: string): Promise<Chapter> {
    return this.request(`/chapters/${id}`);
  }

  async createChapter(bookId: string, data: Partial<Chapter>): Promise<Chapter> {
    return this.request(`/books/${bookId}/chapters`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChapter(id: string, data: Partial<Chapter>): Promise<Chapter> {
    return this.request(`/chapters/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async reorderChapters(bookId: string, chapterIds: string[]): Promise<Chapter[]> {
    return this.request(`/books/${bookId}/chapters/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ chapter_ids: chapterIds }),
    });
  }

  async deleteChapter(id: string): Promise<void> {
    return this.request(`/chapters/${id}`, { method: 'DELETE' });
  }

  // Inline Content
  async getInlineContent(chapterId: string, params?: { content_type?: string; author_only?: boolean }): Promise<InlineContent[]> {
    const query = params ? '?' + new URLSearchParams(params as any).toString() : '';
    return this.request(`/chapters/${chapterId}/inline-content${query}`);
  }

  async createInlineContent(chapterId: string, data: Partial<InlineContent>): Promise<InlineContent> {
    return this.request(`/chapters/${chapterId}/inline-content`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInlineContent(id: string, data: Partial<InlineContent>): Promise<InlineContent> {
    return this.request(`/inline-content/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteInlineContent(id: string): Promise<void> {
    return this.request(`/inline-content/${id}`, { method: 'DELETE' });
  }

  // Polls
  async votePoll(pollId: string, selectedOption: string): Promise<{ vote: any; results: Record<string, number>; total_votes: number }> {
    return this.request(`/polls/${pollId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ selected_option: selectedOption }),
    });
  }

  async getPollResults(pollId: string): Promise<{ results: Record<string, number>; total_votes: number; user_vote?: string }> {
    return this.request(`/polls/${pollId}/results`);
  }

  // Questions
  async answerQuestion(questionId: string, data: { answer_text?: string; selected_options?: string[] }): Promise<any> {
    return this.request(`/questions/${questionId}/answer`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Reading Progress
  async getReadingProgress(bookId: string): Promise<ReadingProgress | null> {
    return this.request(`/books/${bookId}/progress`);
  }

  async updateReadingProgress(bookId: string, data: Partial<ReadingProgress>): Promise<ReadingProgress> {
    return this.request(`/books/${bookId}/progress`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Files
  async getUploadUrl(fileName: string, fileType: string, bookId?: string): Promise<{ upload_url: string; storage_path: string; token: string; fileflow_folder_id?: string | null; use_supabase?: boolean }> {
    return this.request('/files/upload', {
      method: 'POST',
      body: JSON.stringify({ file_name: fileName, file_type: fileType, book_id: bookId }),
    });
  }

  async registerFile(data: any): Promise<any> {
    return this.request('/files/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Changes
  async getBookChanges(bookId: string): Promise<ApiResponse<any[]>> {
    return this.request(`/changes/book/${bookId}`);
  }

  async syncChanges(bookId: string): Promise<{ message: string; synced: number; total: number }> {
    return this.request('/changes/sync', {
      method: 'POST',
      body: JSON.stringify({ book_id: bookId }),
    });
  }

  // App Settings
  async getAppSettings(): Promise<{ fileflow_url: string; fileflow_access_key: string; deepgram_api_key: string }> {
    return this.request('/settings');
  }

  async updateAppSettings(settings: { fileflow_url: string; fileflow_access_key: string; deepgram_api_key: string }): Promise<void> {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async testFileFlowConnection(url: string): Promise<{ success: boolean; error?: string }> {
    return this.request('/settings/test-fileflow', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });
  }

  // TTS - Text to Speech
  async generateTTS(text: string, voice?: string): Promise<Blob> {
    const token = this.getToken();
    const response = await fetch(`${API_URL}/tts/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ text, voice }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate audio');
    }

    return response.blob();
  }

  async getTTSVoices(): Promise<{ id: string; name: string; language: string; gender: string }[]> {
    return this.request('/tts/voices');
  }

  // Collaborators
  async getMyRole(bookId: string): Promise<{ role: CollaboratorRole }> {
    return this.request(`/books/${bookId}/my-role`);
  }

  async getCollaborators(bookId: string): Promise<BookCollaborator[]> {
    return this.request(`/books/${bookId}/collaborators`);
  }

  async inviteCollaborator(bookId: string, data: { email?: string; userId?: string; role: Exclude<CollaboratorRole, 'owner'> }): Promise<BookCollaborator & { invite_token?: string }> {
    return this.request(`/books/${bookId}/collaborators`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCollaboratorRole(bookId: string, collabId: string, role: Exclude<CollaboratorRole, 'owner'>): Promise<BookCollaborator> {
    return this.request(`/books/${bookId}/collaborators/${collabId}`, {
      method: 'PUT',
      body: JSON.stringify({ role }),
    });
  }

  async removeCollaborator(bookId: string, collabId: string): Promise<void> {
    return this.request(`/books/${bookId}/collaborators/${collabId}`, { method: 'DELETE' });
  }

  async acceptInvite(token: string): Promise<{ success?: boolean; requiresAuth?: boolean; book?: Pick<Book, 'id' | 'title'>; role?: string }> {
    return this.request(`/invites/accept/${token}`, { method: 'POST' });
  }

  // Versions
  async getVersions(bookId: string): Promise<BookVersion[]> {
    return this.request(`/books/${bookId}/versions`);
  }

  async createVersion(bookId: string, label?: string): Promise<BookVersion> {
    return this.request(`/books/${bookId}/versions`, {
      method: 'POST',
      body: JSON.stringify({ label }),
    });
  }

  async getVersion(bookId: string, versionId: string): Promise<BookVersion> {
    return this.request(`/books/${bookId}/versions/${versionId}`);
  }

  async restoreVersion(bookId: string, versionId: string): Promise<{ success: boolean; restoredChapters: number }> {
    return this.request(`/books/${bookId}/versions/${versionId}/restore`, { method: 'POST' });
  }

  // Comments
  async getChapterComments(chapterId: string): Promise<BookComment[]> {
    return this.request(`/chapters/${chapterId}/comments`);
  }

  async createComment(chapterId: string, body: string, opts?: { selection_start?: number; selection_end?: number; anchor_text?: string; parent_id?: string }): Promise<BookComment> {
    return this.request(`/chapters/${chapterId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body, ...opts }),
    });
  }

  async editComment(commentId: string, body: string): Promise<BookComment> {
    return this.request(`/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify({ body }),
    });
  }

  async deleteComment(commentId: string): Promise<void> {
    return this.request(`/comments/${commentId}`, { method: 'DELETE' });
  }

  async resolveComment(commentId: string, status: 'resolved' | 'rejected' = 'resolved'): Promise<BookComment> {
    return this.request(`/comments/${commentId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async replyToComment(chapterId: string, parentId: string, body: string): Promise<BookComment> {
    return this.createComment(chapterId, body, { parent_id: parentId });
  }

  // Reviews
  async getReviews(bookId: string): Promise<ReviewRequest[]> {
    return this.request(`/books/${bookId}/reviews`);
  }

  async submitForReview(bookId: string, message?: string): Promise<ReviewRequest> {
    return this.request(`/books/${bookId}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async reviewDecision(bookId: string, reviewId: string, decision: { status: 'approved' | 'rejected'; reviewer_note?: string }): Promise<ReviewRequest> {
    return this.request(`/books/${bookId}/reviews/${reviewId}`, {
      method: 'PUT',
      body: JSON.stringify(decision),
    });
  }

  async cancelReview(bookId: string, reviewId: string): Promise<void> {
    return this.request(`/books/${bookId}/reviews/${reviewId}`, { method: 'DELETE' });
  }

  // Notifications
  async getNotifications(limit?: number): Promise<UserNotification[]> {
    return this.request(`/notifications${limit ? `?limit=${limit}` : ''}`);
  }

  async getUnreadCount(): Promise<{ count: number }> {
    return this.request('/notifications/unread-count');
  }

  async markNotificationRead(id: string): Promise<void> {
    return this.request(`/notifications/${id}/read`, { method: 'PUT' });
  }

  async markAllNotificationsRead(): Promise<void> {
    return this.request('/notifications/read-all', { method: 'PUT' });
  }

  // Publishing
  async publishBook(bookId: string): Promise<Pick<Book, 'id' | 'title' | 'slug' | 'share_token' | 'status' | 'visibility' | 'published_at'>> {
    return this.request(`/books/${bookId}/publish`, { method: 'POST' });
  }

  async unpublishBook(bookId: string): Promise<Pick<Book, 'id' | 'status' | 'visibility'>> {
    return this.request(`/books/${bookId}/unpublish`, { method: 'POST' });
  }

  async getPublicBook(slug: string): Promise<Book & { chapters: Chapter[] }> {
    return this.request(`/public/books/${slug}`);
  }

  async getSharedBook(token: string): Promise<Book & { chapters: Chapter[] }> {
    return this.request(`/public/books/share/${token}`);
  }

  // Collaborator books (books user is a collaborator on)
  async getCollaboratingBooks(): Promise<Book[]> {
    return this.request('/books/collaborating');
  }

  // Book Cover Upload
  async uploadBookCover(bookId: string, file: File): Promise<{ cover_image_url: string }> {
    const { upload_url, storage_path, fileflow_folder_id, use_supabase } = await this.getUploadUrl(file.name, file.type, bookId);

    const uploadResponse = await fetch(upload_url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload cover image');
    }

    const registered = await this.registerFile({
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path,
      fileflow_folder_id,
      use_supabase,
      display_name: 'Cover Image',
      book_id: bookId,
    });

    const cover_image_url = registered.file_url || storage_path;

    await this.updateBook(bookId, { cover_image_url });

    return { cover_image_url };
  }

  // Exports
  async exportJson(bookId: string): Promise<void> {
    const token = this.getToken();
    const response = await fetch(`${API_URL}/books/${bookId}/export/json`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) throw new Error('Export failed');
    const blob = await response.blob();
    const disposition = response.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] || `book_${bookId}.bookflow.json`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async exportPdf(bookId: string): Promise<{ download_url?: string }> {
    return this.request(`/books/${bookId}/export/pdf`, { method: 'POST' });
  }

  async exportEpub(bookId: string): Promise<{ download_url?: string }> {
    return this.request(`/books/${bookId}/export/epub`, { method: 'POST' });
  }

  async exportDocx(bookId: string): Promise<{ download_url?: string }> {
    return this.request(`/books/${bookId}/export/docx`, { method: 'POST' });
  }

  async exportSubmissionPackage(bookId: string, meta?: { genres?: string[]; isbn?: string }): Promise<{ download_url?: string }> {
    return this.request(`/books/${bookId}/export/submission-package`, {
      method: 'POST',
      body: JSON.stringify(meta || {}),
    });
  }

  async getPublisherMetadata(bookId: string): Promise<Record<string, unknown>> {
    return this.request(`/books/${bookId}/publisher-metadata`);
  }

  // Publisher Submissions
  async getSubmissions(bookId: string): Promise<any[]> {
    return this.request(`/books/${bookId}/submissions`);
  }

  async submitToDraft2Digital(bookId: string, data: { api_token: string; genres?: string[]; isbn?: string; price?: number }): Promise<any> {
    return this.request(`/books/${bookId}/submit/draft2digital`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async submitToSmashwords(bookId: string, data: { api_token: string; genres?: string[]; isbn?: string; price?: number }): Promise<any> {
    return this.request(`/books/${bookId}/submit/smashwords`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async recordManualSubmission(bookId: string, data: { platform_name: string; submission_id?: string; publisher_url?: string; note?: string }): Promise<any> {
    return this.request(`/books/${bookId}/submit/manual`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteSubmission(bookId: string, submissionId: string): Promise<void> {
    return this.request(`/books/${bookId}/submissions/${submissionId}`, { method: 'DELETE' });
  }

  // ── Book Clubs ─────────────────────────────────────────────────────────────

  async getMyClubs(): Promise<any[]> {
    return this.request('/clubs');
  }

  async getPublicClubs(search?: string): Promise<any[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    return this.request(`/clubs/public${qs}`);
  }

  async createClub(data: { name: string; description?: string; cover_image_url?: string; visibility?: string; max_members?: number }): Promise<any> {
    return this.request('/clubs', { method: 'POST', body: JSON.stringify(data) });
  }

  async getClub(clubId: string): Promise<any> {
    return this.request(`/clubs/${clubId}`);
  }

  async updateClub(clubId: string, data: Partial<{ name: string; description: string; cover_image_url: string; visibility: string; max_members: number }>): Promise<any> {
    return this.request(`/clubs/${clubId}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async updateClubSettings(clubId: string, settings: Partial<{ show_member_reading_progress: boolean; show_member_answers: boolean; show_member_highlights: boolean; show_member_media: boolean }>): Promise<any> {
    return this.request(`/clubs/${clubId}/settings`, { method: 'PUT', body: JSON.stringify(settings) });
  }

  async deleteClub(clubId: string): Promise<void> {
    return this.request(`/clubs/${clubId}`, { method: 'DELETE' });
  }

  async inviteToClub(clubId: string, email: string): Promise<any> {
    return this.request(`/clubs/${clubId}/invite`, { method: 'POST', body: JSON.stringify({ email }) });
  }

  async acceptClubInvite(token: string): Promise<any> {
    return this.request(`/clubs/accept/${token}`, { method: 'POST' });
  }

  async resendClubInvite(clubId: string, memberId: string): Promise<{ invite_token: string; invited_email: string }> {
    return this.request(`/clubs/${clubId}/members/${memberId}/resend-invite`, { method: 'POST' });
  }

  async removeClubMember(clubId: string, memberId: string): Promise<void> {
    return this.request(`/clubs/${clubId}/members/${memberId}`, { method: 'DELETE' });
  }

  async updateClubMemberRole(clubId: string, memberId: string, role: 'admin' | 'member'): Promise<any> {
    return this.request(`/clubs/${clubId}/members/${memberId}`, { method: 'PUT', body: JSON.stringify({ role }) });
  }

  async addBookToClub(clubId: string, bookId: string, setCurrent?: boolean): Promise<any> {
    return this.request(`/clubs/${clubId}/books`, { method: 'POST', body: JSON.stringify({ book_id: bookId, set_current: setCurrent }) });
  }

  async setCurrentClubBook(clubId: string, clubBookId: string): Promise<any> {
    return this.request(`/clubs/${clubId}/books/${clubBookId}`, { method: 'PUT', body: JSON.stringify({ is_current: true }) });
  }

  async removeBookFromClub(clubId: string, clubBookId: string): Promise<void> {
    return this.request(`/clubs/${clubId}/books/${clubBookId}`, { method: 'DELETE' });
  }

  async getClubDiscussions(clubId: string, params?: { book_id?: string; chapter_id?: string; parent_id?: string | null }): Promise<any[]> {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, v === null ? 'null' : String(v)])).toString() : '';
    return this.request(`/clubs/${clubId}/discussions${qs}`);
  }

  async postClubDiscussion(clubId: string, data: { body: string; book_id?: string; chapter_id?: string; parent_id?: string }): Promise<any> {
    return this.request(`/clubs/${clubId}/discussions`, { method: 'POST', body: JSON.stringify(data) });
  }

  async updateClubDiscussion(clubId: string, discussionId: string, body: string): Promise<any> {
    return this.request(`/clubs/${clubId}/discussions/${discussionId}`, { method: 'PUT', body: JSON.stringify({ body }) });
  }

  async deleteClubDiscussion(clubId: string, discussionId: string): Promise<void> {
    return this.request(`/clubs/${clubId}/discussions/${discussionId}`, { method: 'DELETE' });
  }

  async getClubMemberProgress(clubId: string, memberUserId: string): Promise<any[]> {
    return this.request(`/clubs/${clubId}/members/${memberUserId}/progress`);
  }

  async getClubMemberAnswers(clubId: string, memberUserId: string): Promise<any[]> {
    return this.request(`/clubs/${clubId}/members/${memberUserId}/answers`);
  }
}

export const api = new ApiClient();
export default api;
