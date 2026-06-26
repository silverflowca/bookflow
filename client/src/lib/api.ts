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
  ActivityEvent,
  FormResponse,
  AllFormResponsesResult,
  BookLanding,
  Feedback,
  FeedbackStatus,
  FeedbackConfig,
  FeedbackComment,
  AnnotationCommand,
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

  async getPublicBooks(q?: string): Promise<Book[]> {
    const params = q ? `?q=${encodeURIComponent(q)}` : '';
    return this.request(`/books/public${params}`);
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
    // Soft-delete: server sets status = 'archived', book is never permanently removed
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

  async reorderInlineContent(id: string, order_index: number): Promise<void> {
    return this.request(`/inline-content/${id}/order`, {
      method: 'PATCH',
      body: JSON.stringify({ order_index }),
    });
  }

  // Polls
  async votePoll(pollId: string, selectedOption: string, visibility?: 'private' | 'shared' | 'public'): Promise<{ vote: any; results: Record<string, number>; total_votes: number }> {
    return this.request(`/polls/${pollId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ selected_option: selectedOption, ...(visibility ? { visibility } : {}) }),
    });
  }

  async getPollResults(pollId: string): Promise<{ results: Record<string, number>; total_votes: number; user_vote?: string }> {
    return this.request(`/polls/${pollId}/results`);
  }

  // Questions
  async answerQuestion(questionId: string, data: { answer_text?: string; selected_options?: string[]; visibility?: 'private' | 'shared' | 'public' }): Promise<any> {
    return this.request(`/questions/${questionId}/answer`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMyQuestionAnswer(questionId: string): Promise<{ answer_text?: string; selected_options?: string[]; is_correct?: boolean | null } | null> {
    return this.request(`/questions/${questionId}/my-answer`);
  }

  // Ratings
  async getRatings(bookId: string): Promise<{ average: number; count: number; distribution: Record<number, number>; user_rating: number | null }> {
    return this.request(`/books/${bookId}/ratings`);
  }

  async submitRating(bookId: string, rating: number): Promise<{ rating: any; aggregate: { average: number; count: number } }> {
    return this.request(`/books/${bookId}/rating`, {
      method: 'POST',
      body: JSON.stringify({ rating }),
    });
  }

  async deleteRating(bookId: string): Promise<{ aggregate: { average: number; count: number } }> {
    return this.request(`/books/${bookId}/rating`, { method: 'DELETE' });
  }

  // Form Responses
  async submitFormResponse(contentId: string, responseData: any, visibility?: 'private' | 'shared' | 'public'): Promise<FormResponse> {
    return this.request(`/form-responses/${contentId}`, {
      method: 'POST',
      body: JSON.stringify({ response_data: responseData, ...(visibility ? { visibility } : {}) }),
    });
  }

  async getMyFormResponse(contentId: string): Promise<FormResponse | null> {
    return this.request(`/form-responses/${contentId}/mine`);
  }

  async getAllFormResponses(contentId: string): Promise<AllFormResponsesResult> {
    return this.request(`/form-responses/${contentId}/all`);
  }

  async getBookResponses(bookId: string, chapterId?: string): Promise<import('../types').BookResponseItem[]> {
    const qs = chapterId ? `?chapter_id=${chapterId}` : '';
    return this.request(`/books/${bookId}/responses${qs}`);
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

  // Item-level progress tracking
  async markItemComplete(chapterId: string, itemKey: string, itemType: string): Promise<void> {
    return this.request('/progress/complete', {
      method: 'POST',
      body: JSON.stringify({ chapter_id: chapterId, item_key: itemKey, item_type: itemType }),
    });
  }

  async markItemIncomplete(chapterId: string, itemKey: string): Promise<void> {
    return this.request('/progress/incomplete', {
      method: 'POST',
      body: JSON.stringify({ chapter_id: chapterId, item_key: itemKey }),
    });
  }

  async getChapterProgress(chapterId: string): Promise<{ completions: string[]; total: number }> {
    return this.request(`/progress/chapter/${chapterId}`);
  }

  async getBookProgress(bookId: string): Promise<{ chapter_id: string; completed: number; total: number }[]> {
    return this.request(`/progress/book/${bookId}`);
  }

  async getClubProgress(clubId: string): Promise<{
    members: {
      user_id: string; display_name: string; avatar_url: string | null; role: string;
      items_completed: number; items_total: number;
      chapters_completed: number; chapters_total: number;
      chapters_breakdown: { chapter_id: string; completed: number; total: number }[];
      last_active: string | null;
    }[];
    chapters: { id: string; title: string }[];
  }> {
    return this.request(`/progress/club/${clubId}`);
  }

  async getMySubmissions(bookId: string): Promise<{
    chapters: {
      chapter_id: string; chapter_title: string; order_index: number;
      completed: number; total: number;
      items: { item_key: string; item_type: string; content_type: string; prompt: string | null; response: any; completed_at: string }[];
    }[];
  }> {
    return this.request(`/progress/my-submissions/${bookId}`);
  }

  async getClubMemberSubmissions(clubId: string, memberId: string): Promise<{
    member: { user_id: string; display_name: string; avatar_url: string | null; role: string };
    chapters: {
      chapter_id: string; chapter_title: string; order_index: number;
      completed: number; total: number;
      items: { item_key: string; item_type: string; content_type: string; prompt: string | null; response: any; completed_at: string }[];
    }[];
    can_see_responses: boolean;
  }> {
    return this.request(`/clubs/${clubId}/members/${memberId}/submissions`);
  }

  async getBookStats(bookId: string): Promise<{
    overview: {
      total_chapters: number; published_chapters: number; total_words: number;
      total_readers: number; active_readers: number; completed_readers: number;
      avg_progress: number; total_components: number; total_form_responses: number;
      total_comments: number; open_comments: number; resolved_comments: number;
    };
    content_by_type: Record<string, number>;
    chapter_stats: {
      id: string; title: string; order_index: number; status: string;
      word_count: number; read_time: number; components: number;
      form_responses: number; completions: number; unique_readers: number;
    }[];
    recent_completions: any[];
  }> {
    return this.request(`/books/${bookId}/stats`);
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
  async getAppSettings(): Promise<{ fileflow_url: string; fileflow_access_key: string; deepgram_api_key: string; restream_client_id: string; restream_client_secret: string; home_tagline: string; feature_demo_book_id: string | null }> {
    return this.request('/settings');
  }

  async updateAppSettings(settings: { fileflow_url: string; fileflow_access_key: string; deepgram_api_key: string; restream_client_id: string; restream_client_secret: string; home_tagline: string; feature_demo_book_id: string | null }): Promise<void> {
    return this.request('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getPublicSettings(): Promise<{ home_tagline: string; feature_demo_book_id: string | null }> {
    return this.request('/settings/public');
  }

  // API Key management
  async listApiKeys(): Promise<{ id: string; name: string; last_used_at: string | null; created_at: string }[]> {
    return this.request('/settings/api-keys');
  }
  async createApiKey(name: string): Promise<{ id: string; name: string; created_at: string; key: string }> {
    return this.request('/settings/api-keys', { method: 'POST', body: JSON.stringify({ name }) });
  }
  async revokeApiKey(id: string): Promise<{ success: boolean }> {
    return this.request(`/settings/api-keys/${id}`, { method: 'DELETE' });
  }

  // Book import
  async importBook(payload: {
    external_id?: string;
    book: { title: string; subtitle?: string; description?: string; visibility?: string; status?: string; cover_image?: string; cover_image_url?: string };
    settings?: Record<string, unknown>;
    chapters?: { title: string; order_index?: number; status?: string; content?: unknown; content_text?: string; inline_content?: unknown[] }[];
    collaborators?: { email: string; role: string }[];
  }): Promise<{ book_id: string; external_id: string | null; created: boolean; chapters: { id: string; title: string; order_index: number }[]; inline_content_count: number; collaborators_invited: number; warnings: string[] }> {
    return this.request('/import/books', { method: 'POST', body: JSON.stringify(payload) });
  }
  async listImportedBooks(): Promise<{ external_id: string; book_id: string; created_at: string }[]> {
    return this.request('/import/books');
  }
  async getImportedBook(externalId: string): Promise<{ external_id: string; book_id: string; created_at: string }> {
    return this.request(`/import/books/${encodeURIComponent(externalId)}`);
  }

  // Saved Books
  async getSavedBooks(): Promise<any[]> {
    return this.request('/saved-books');
  }
  async getSavedBooksCount(): Promise<{ count: number }> {
    return this.request('/saved-books/count');
  }
  async saveBook(bookId: string): Promise<{ id: string; saved_at: string }> {
    return this.request(`/saved-books/${bookId}`, { method: 'POST' });
  }
  async unsaveBook(bookId: string): Promise<{ ok: boolean }> {
    return this.request(`/saved-books/${bookId}`, { method: 'DELETE' });
  }

  async getRestreamStatus(): Promise<{ connected: boolean; has_credentials: boolean; has_token: boolean; expires_at: string | null }> {
    return this.request('/live/restream/status');
  }

  async disconnectRestream(): Promise<{ ok: boolean }> {
    return this.request('/live/restream/disconnect', { method: 'POST' });
  }

  async getRestreamStreamStatus(): Promise<{ channels: any[]; profile: any }> {
    return this.request('/live/restream/stream-status');
  }

  async restreamGoLive(): Promise<{ ok: boolean; channels_enabled: number }> {
    return this.request('/live/restream/go-live', { method: 'POST' });
  }

  async scheduleRestreamBroadcast(episodeId: string): Promise<{ ok: boolean; broadcast: any; message?: string }> {
    return this.request(`/live/episodes/${episodeId}/schedule-restream`, { method: 'POST' });
  }

  async postRecap(episodeId: string, data: { recording_url?: string; message?: string }): Promise<{ ok: boolean; recap: string; message?: string }> {
    return this.request(`/live/episodes/${episodeId}/post-recap`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Bible
  async getBibleBooks(): Promise<{ book_name: string; book_order: number }[]> {
    return this.request('/live/bible/books');
  }
  async getBibleChapters(book: string): Promise<number[]> {
    return this.request(`/live/bible/${encodeURIComponent(book)}/chapters`);
  }
  async getBibleChapter(book: string, chapter: number): Promise<{ verse: number; text: string }[]> {
    return this.request(`/live/bible/${encodeURIComponent(book)}/${chapter}`);
  }
  async searchBible(q: string): Promise<{ book_name: string; chapter: number; verse: number; text: string }[]> {
    return this.request(`/live/bible/search?q=${encodeURIComponent(q)}`);
  }

  // Queue
  async getQueue(episodeId: string): Promise<{ groups: any[]; items: any[] }> {
    return this.request(`/live/episodes/${episodeId}/queue`);
  }
  async addQueueItem(episodeId: string, data: {
    type?: string; label: string; body: string;
    book_ref?: string; chapter_ref?: number; verse_start?: number; verse_end?: number;
    group_id?: string; sort_order?: number;
  }): Promise<any> {
    return this.request(`/live/episodes/${episodeId}/queue`, { method: 'POST', body: JSON.stringify(data) });
  }
  async updateQueueItem(itemId: string, data: { label?: string; body?: string; sort_order?: number; group_id?: string | null }): Promise<any> {
    return this.request(`/live/queue/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteQueueItem(itemId: string): Promise<void> {
    return this.request(`/live/queue/${itemId}`, { method: 'DELETE' });
  }
  async sendQueueItem(itemId: string, targets: string[]): Promise<{ ok: boolean; results: Record<string, string> }> {
    return this.request(`/live/queue/${itemId}/send`, { method: 'POST', body: JSON.stringify({ targets }) });
  }
  async sendNow(episodeId: string, data: { text: string; label?: string; targets: string[] }): Promise<{ ok: boolean; results: Record<string, string> }> {
    return this.request(`/live/episodes/${episodeId}/send-now`, { method: 'POST', body: JSON.stringify(data) });
  }
  async createQueueGroup(episodeId: string, label: string, sort_order?: number): Promise<any> {
    return this.request(`/live/episodes/${episodeId}/queue/groups`, { method: 'POST', body: JSON.stringify({ label, sort_order }) });
  }
  async updateQueueGroup(groupId: string, data: { label?: string; sort_order?: number }): Promise<any> {
    return this.request(`/live/queue/groups/${groupId}`, { method: 'PATCH', body: JSON.stringify(data) });
  }
  async deleteQueueGroup(groupId: string): Promise<void> {
    return this.request(`/live/queue/groups/${groupId}`, { method: 'DELETE' });
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

  async resetReview(bookId: string, reviewId: string): Promise<void> {
    return this.request(`/books/${bookId}/reviews/${reviewId}/reset`, { method: 'PATCH' });
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

  async inviteReaders(bookId: string, emails: string[], message?: string): Promise<{ ok: boolean; sent?: number; manual?: boolean; url?: string }> {
    return this.request(`/books/${bookId}/invite`, {
      method: 'POST',
      body: JSON.stringify({ emails, message }),
    });
  }

  // Collaborator books (books user is a collaborator on)
  async getCollaboratingBooks(): Promise<Book[]> {
    return this.request('/books/collaborating');
  }

  // Book Cover Upload — sends file directly to server which uploads to Supabase Storage
  async uploadBookCover(bookId: string, file: File): Promise<{ cover_image_url: string }> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append('cover', file);
    formData.append('book_id', bookId);

    const response = await fetch(`${API_URL}/files/cover`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error((data as any).error || `Upload failed (${response.status})`);
    }

    return response.json();
  }

  // Media (audio/video) Upload — sends file directly to server which uploads to Supabase Storage
  async uploadMedia(file: File, bookId?: string, displayName?: string): Promise<{ file_url: string }> {
    const token = this.getToken();
    const formData = new FormData();
    formData.append('file', file);
    if (bookId) formData.append('book_id', bookId);
    if (displayName) formData.append('display_name', displayName);

    const response = await fetch(`${API_URL}/files/media`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error((data as any).error || `Upload failed (${response.status})`);
    }

    return response.json();
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

  async getMyClubs(type?: 'club' | 'study_group'): Promise<any[]> {
    const qs = type ? `?type=${type}` : '';
    return this.request(`/clubs${qs}`);
  }

  async getPublicClubs(search?: string, type?: 'club' | 'study_group'): Promise<any[]> {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (type) params.set('type', type);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/clubs/public${qs}`);
  }

  async createClub(data: { name: string; description?: string; cover_image_url?: string; visibility?: string; max_members?: number; club_type?: 'club' | 'study_group' }): Promise<any> {
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

  async getClubInvitePreview(token: string): Promise<{ club_id: string; club_name: string; book_title: string | null; invited_email: string; has_account: boolean }> {
    return this.request(`/clubs/invite/${token}`);
  }

  async acceptClubInvite(token: string): Promise<any> {
    return this.request(`/clubs/accept/${token}`, { method: 'POST' });
  }

  async resendClubInvite(clubId: string, memberId: string): Promise<{ invite_token: string; invited_email: string }> {
    return this.request(`/clubs/${clubId}/members/${memberId}/resend-invite`, { method: 'POST' });
  }

  async approveClubInvite(clubId: string, memberId: string): Promise<{ success: boolean }> {
    return this.request(`/clubs/${clubId}/members/${memberId}/approve`, { method: 'POST' });
  }

  async requestToJoinClub(clubId: string, message?: string): Promise<any> {
    return this.request(`/clubs/${clubId}/request-join`, { method: 'POST', body: JSON.stringify({ message }) });
  }

  async declineClubRequest(clubId: string, memberId: string): Promise<{ success: boolean }> {
    return this.request(`/clubs/${clubId}/members/${memberId}/decline-request`, { method: 'POST' });
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


  async getClubMemberProgress(clubId: string, memberUserId: string): Promise<any[]> {
    return this.request(`/clubs/${clubId}/members/${memberUserId}/progress`);
  }

  async getClubMemberAnswers(clubId: string, memberUserId: string): Promise<any[]> {
    return this.request(`/clubs/${clubId}/members/${memberUserId}/answers`);
  }

  // ── Club Chat ─────────────────────────────────────────────────────────────

  async getClubChatMessages(clubId: string, params?: { before?: string; limit?: number }): Promise<{ messages: any[]; hasMore: boolean }> {
    const qs = new URLSearchParams();
    if (params?.before) qs.set('before', params.before);
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs}` : '';
    return this.request(`/clubs/${clubId}/chat/messages${query}`);
  }

  async sendClubChatMessage(clubId: string, data: Record<string, any>): Promise<any> {
    return this.request(`/clubs/${clubId}/chat/messages`, { method: 'POST', body: JSON.stringify(data) });
  }

  async editClubChatMessage(clubId: string, msgId: string, body: string): Promise<any> {
    return this.request(`/clubs/${clubId}/chat/messages/${msgId}`, { method: 'PUT', body: JSON.stringify({ body }) });
  }

  async deleteClubChatMessage(clubId: string, msgId: string): Promise<void> {
    return this.request(`/clubs/${clubId}/chat/messages/${msgId}`, { method: 'DELETE' });
  }

  async getClubChatSettings(clubId: string): Promise<any> {
    return this.request(`/clubs/${clubId}/chat/settings`);
  }

  async updateClubChatSettings(clubId: string, settings: Record<string, any>): Promise<any> {
    return this.request(`/clubs/${clubId}/chat/settings`, { method: 'PUT', body: JSON.stringify(settings) });
  }

  async getClubChatPrefs(clubId: string): Promise<{ notification_mode: string }> {
    return this.request(`/clubs/${clubId}/chat/prefs`);
  }

  async updateClubChatPrefs(clubId: string, notification_mode: string): Promise<any> {
    return this.request(`/clubs/${clubId}/chat/prefs`, { method: 'PUT', body: JSON.stringify({ notification_mode }) });
  }

  async markClubChatRead(clubId: string, last_message_id: string): Promise<void> {
    return this.request(`/clubs/${clubId}/chat/read`, { method: 'POST', body: JSON.stringify({ last_message_id }) });
  }

  async getClubChatUnreadCount(clubId: string): Promise<{ count: number }> {
    return this.request(`/clubs/${clubId}/chat/unread-count`);
  }

  async getClubChatUnreadAll(): Promise<Record<string, number>> {
    return this.request(`/clubs/chat/unread-all`);
  }

  async ensureClubChatFolder(clubId: string): Promise<{ folder_id: string | null }> {
    return this.request(`/clubs/${clubId}/chat/ensure-folder`, { method: 'POST', body: '{}' });
  }

  // ── LiveFlow ────────────────────────────────────────────────────────────────

  async getLiveShows(): Promise<{ shows: any[] }> {
    return this.request('/live/shows');
  }

  async createLiveShow(data: any): Promise<{ show: any }> {
    return this.request('/live/shows', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateLiveShow(id: string, data: any): Promise<{ show: any }> {
    return this.request(`/live/shows/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async deleteLiveShow(id: string): Promise<{ ok: boolean }> {
    return this.request(`/live/shows/${id}`, { method: 'DELETE' });
  }

  async getLiveEpisodes(params?: { status?: string; show_id?: string }): Promise<{ episodes: any[] }> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.show_id) qs.set('show_id', params.show_id);
    const query = qs.toString() ? `?${qs}` : '';
    return this.request(`/live/episodes${query}`);
  }

  async createLiveEpisode(data: any): Promise<{ episode: any }> {
    return this.request('/live/episodes', { method: 'POST', body: JSON.stringify(data) });
  }

  async generateNextEpisode(show_id: string): Promise<{ episode: any }> {
    return this.request('/live/episodes/generate', { method: 'POST', body: JSON.stringify({ show_id }) });
  }

  async getLiveEpisode(id: string): Promise<{ episode: any }> {
    return this.request(`/live/episodes/${id}`);
  }

  async updateLiveEpisode(id: string, data: any): Promise<{ episode: any }> {
    return this.request(`/live/episodes/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
  }

  async buildSlideDeck(episodeId: string): Promise<{ deck: any; slideCount: number }> {
    return this.request(`/live/episodes/${episodeId}/build-deck`, { method: 'POST', body: '{}' });
  }

  async pushToFreeshow(episodeId: string): Promise<{ ok: boolean; error?: string }> {
    return this.request(`/live/episodes/${episodeId}/push-freeshow`, { method: 'POST', body: '{}' });
  }

  async startLiveEpisode(episodeId: string): Promise<{ episode: any }> {
    return this.request(`/live/episodes/${episodeId}/start`, { method: 'POST', body: '{}' });
  }

  async endLiveEpisode(episodeId: string): Promise<{ episode: any }> {
    return this.request(`/live/episodes/${episodeId}/end`, { method: 'POST', body: '{}' });
  }

  async getLiveChat(episodeId: string): Promise<{ messages: any[] }> {
    return this.request(`/live/episodes/${episodeId}/chat`);
  }

  async flagLiveRequest(episodeId: string, data: { message_id?: string; type: string; body: string }): Promise<{ request: any }> {
    return this.request(`/live/episodes/${episodeId}/flag`, { method: 'POST', body: JSON.stringify(data) });
  }

  async getLiveRequests(episodeId: string): Promise<{ requests: any[] }> {
    return this.request(`/live/episodes/${episodeId}/requests`);
  }

  async resolveLiveRequest(requestId: string): Promise<{ request: any }> {
    return this.request(`/live/requests/${requestId}/resolve`, { method: 'PATCH', body: '{}' });
  }

  async getFreeshowStatus(): Promise<{ ok: boolean; connected: boolean; message?: string }> {
    return this.request('/live/freeshow/status');
  }

  async freeshowAction(action: string, data?: any): Promise<{ ok: boolean; result?: string }> {
    return this.request('/live/freeshow/action', { method: 'POST', body: JSON.stringify({ action, data }) });
  }

  // ── Profile ─────────────────────────────────────────────────────────────────

  async getMyProfile(): Promise<any> {
    return this.request('/profile/me');
  }

  async updateMyProfile(data: {
    display_name?: string; bio?: string; avatar_url?: string; is_author?: boolean;
    website_url?: string; location?: string;
    profile_public?: boolean; show_reading_progress?: boolean;
    show_clubs?: boolean; show_books_authored?: boolean;
  }): Promise<any> {
    return this.request('/profile/me', { method: 'PUT', body: JSON.stringify(data) });
  }

  async getPublicProfile(userId: string): Promise<any> {
    return this.request(`/profile/${userId}`);
  }

  async uploadAvatar(file: File): Promise<{ avatar_url: string }> {
    const formData = new FormData();
    formData.append('avatar', file);
    const token = localStorage.getItem('bookflow_token');
    const res = await fetch(`${API_URL}/files/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as any).error || 'Avatar upload failed');
    }
    return res.json();
  }

  // Activity / Audit Trail
  async getBookActivity(
    bookId: string,
    params?: { type?: string; limit?: number; offset?: number }
  ): Promise<{ events: ActivityEvent[]; total: number; hasMore: boolean }> {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const query = qs.toString() ? `?${qs}` : '';
    return this.request(`/books/${bookId}/activity${query}`);
  }

  // ── Admin (super_admin only) ──────────────────────────────────────────────

  async adminGetStats(): Promise<{ users: number; books: number; clubs: number; super_admins: number }> {
    return this.request('/admin/stats');
  }

  async adminGetUsers(): Promise<Profile[]> {
    return this.request('/admin/users');
  }

  async adminSetUserRole(userId: string, system_role: 'super_admin' | null): Promise<Profile> {
    return this.request(`/admin/users/${userId}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ system_role }),
    });
  }

  async adminGetBooks(): Promise<any[]> {
    return this.request('/admin/books');
  }

  async adminReinstateBook(bookId: string): Promise<void> {
    return this.request(`/admin/books/${bookId}/reinstate`, { method: 'PATCH' });
  }

  async adminArchiveBook(bookId: string): Promise<void> {
    return this.request(`/books/${bookId}`, { method: 'DELETE' });
  }

  async adminGetClubs(): Promise<any[]> {
    return this.request('/admin/clubs');
  }

  // ── Book Landing & QR ────────────────────────────────────────────────────────
  async getBookLanding(slugOrId: string): Promise<BookLanding> {
    return this.request(`/book-landing/${slugOrId}`);
  }

  async patchBookSlug(bookId: string, slug: string): Promise<{ id: string; slug: string }> {
    return this.request(`/book-landing/${bookId}/slug`, {
      method: 'PATCH',
      body: JSON.stringify({ slug }),
    });
  }

  async patchChapterSlug(chapterId: string, slug: string): Promise<{ id: string; slug: string }> {
    return this.request(`/chapters/${chapterId}/slug`, {
      method: 'PATCH',
      body: JSON.stringify({ slug }),
    });
  }

  async generateChapterSlug(bookId: string, chapterId: string): Promise<{ id: string; slug: string }> {
    return this.request(`/books/${bookId}/chapters/${chapterId}/generate-slug`, { method: 'POST' });
  }

  // ── Feedback ────────────────────────────────────────────────────────────────

  async uploadFeedbackScreenshot(blob: Blob): Promise<{ storage_path: string }> {
    const token = this.getToken();
    const form = new FormData();
    form.append('screenshot', blob, 'screenshot.png');
    const res = await fetch(`${API_URL}/feedback/screenshots`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as any).error || `Screenshot upload failed (${res.status})`);
    }
    return res.json();
  }

  async uploadFeedbackAudio(blob: Blob, durationSeconds: number): Promise<{ storage_path: string; duration_seconds: number }> {
    const token = this.getToken();
    const form = new FormData();
    form.append('audio', blob, 'recording.webm');
    form.append('duration_seconds', String(durationSeconds));
    const res = await fetch(`${API_URL}/feedback/audio`, {
      method: 'POST',
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: form,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error((d as any).error || `Audio upload failed (${res.status})`);
    }
    return res.json();
  }

  async submitFeedback(data: {
    type: string;
    title: string;
    description?: string;
    page_url: string;
    user_agent: string;
    screenshots: Array<{ storage_path: string; annotation_data: AnnotationCommand[]; order_index: number }>;
    audio?: { storage_path: string; duration_seconds: number } | null;
  }): Promise<Feedback> {
    return this.request('/feedback', { method: 'POST', body: JSON.stringify(data) });
  }

  async adminGetFeedback(params?: {
    status?: FeedbackStatus;
    type?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: Feedback[]; count: number; page: number; limit: number }> {
    const qs = params
      ? '?' + new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)]))).toString()
      : '';
    return this.request(`/feedback${qs}`);
  }

  async getFeedbackDetail(id: string): Promise<Feedback> {
    return this.request(`/feedback/${id}`);
  }

  async updateFeedbackStatus(id: string, status: FeedbackStatus): Promise<Feedback> {
    return this.request(`/feedback/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  }

  async addFeedbackComment(feedbackId: string, body: string): Promise<FeedbackComment> {
    return this.request(`/feedback/${feedbackId}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
  }

  async getFeedbackConfig(): Promise<FeedbackConfig> {
    return this.request('/feedback/config');
  }

  async updateFeedbackConfig(data: Partial<Pick<FeedbackConfig, 'enabled' | 'config'>>): Promise<FeedbackConfig> {
    return this.request('/feedback/config', { method: 'PATCH', body: JSON.stringify(data) });
  }
}

export const api = new ApiClient();
export default api;
