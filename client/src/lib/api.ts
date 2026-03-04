import type {
  Book,
  Chapter,
  InlineContent,
  Profile,
  AuthResponse,
  ReadingProgress,
  ApiResponse
} from '../types';

const API_URL = '/api';

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

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
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
  async getUploadUrl(fileName: string, fileType: string): Promise<{ upload_url: string; storage_path: string; token: string }> {
    return this.request('/files/upload', {
      method: 'POST',
      body: JSON.stringify({ file_name: fileName, file_type: fileType }),
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
  async getAppSettings(): Promise<{ fileflow_url: string; fileflow_access_key: string }> {
    return this.request('/settings');
  }

  async updateAppSettings(settings: { fileflow_url: string; fileflow_access_key: string }): Promise<void> {
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

  // Book Cover Upload
  async uploadBookCover(bookId: string, file: File): Promise<{ cover_image_url: string }> {
    // Get upload URL from FileFlow
    const { upload_url, storage_path } = await this.getUploadUrl(file.name, file.type);

    // Upload directly to storage
    const uploadResponse = await fetch(upload_url, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload cover image');
    }

    // Build the public URL using environment variable or default to localhost
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:55321';
    const cover_image_url = `${supabaseUrl}/storage/v1/object/public/files/${storage_path}`;

    // Update the book with the cover URL
    await this.updateBook(bookId, { cover_image_url });

    // Register the file reference
    await this.registerFile({
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      storage_path,
      display_name: `Cover: ${file.name}`,
      book_id: bookId,
    });

    return { cover_image_url };
  }
}

export const api = new ApiClient();
export default api;
