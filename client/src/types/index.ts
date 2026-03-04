// User and Profile types
export interface User {
  id: string;
  email: string;
  user_metadata?: {
    display_name?: string;
  };
}

export interface Profile {
  id: string;
  email: string;
  display_name: string;
  avatar_url?: string;
  bio?: string;
  is_author: boolean;
  created_at: string;
  updated_at: string;
}

// Book types
export interface Book {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  cover_image_url?: string;
  author_id: string;
  status: 'draft' | 'published' | 'archived';
  visibility: 'private' | 'public';
  published_at?: string;
  created_at: string;
  updated_at: string;
  author?: Profile;
  chapters?: Chapter[];
  settings?: BookSettings;
}

export interface BookSettings {
  id: string;
  book_id: string;
  allow_reader_highlights: boolean;
  allow_reader_notes: boolean;
  allow_reader_questions: boolean;
  allow_reader_polls: boolean;
  allow_reader_audio?: boolean;
  allow_reader_video?: boolean;
  allow_reader_links?: boolean;
  allow_author_audio?: boolean;
  allow_author_video?: boolean;
  allow_author_links?: boolean;
  max_media_duration?: number;
  show_author_highlights: boolean;
  show_author_notes: boolean;
}

// Chapter types
export interface Chapter {
  id: string;
  book_id: string;
  title: string;
  content?: any; // TipTap JSON
  content_text?: string;
  order_index: number;
  status: 'draft' | 'published';
  word_count: number;
  estimated_read_time_minutes: number;
  created_at: string;
  updated_at: string;
}

// Inline content types
export type InlineContentType =
  | 'question' | 'poll' | 'highlight' | 'note' | 'link' | 'audio' | 'video'
  | 'select' | 'multiselect' | 'textbox' | 'textarea' | 'radio' | 'checkbox'
  | 'code_block' | 'scripture_block';

export interface InlineContent {
  id: string;
  book_id: string;
  chapter_id: string;
  content_type: InlineContentType;
  start_offset: number;
  end_offset: number;
  anchor_text?: string;
  content_data: QuestionData | PollData | HighlightData | NoteData | LinkData | MediaData
    | SelectData | MultiselectData | TextboxData | TextareaData | RadioData | CheckboxData
    | CodeBlockData | ScriptureBlockData;
  created_by: string;
  is_author_content: boolean;
  visibility: 'author_only' | 'all_readers' | 'private';
  position_in_chapter: 'inline' | 'end_of_chapter' | 'start_of_chapter';
  created_at: string;
  updated_at: string;
  creator?: Profile;
}

export interface QuestionData {
  question: string;
  type: 'open' | 'multiple_choice' | 'quiz';
  options?: { id: string; text: string }[];
  correct_answer?: string | string[];
  explanation?: string;
}

export interface PollData {
  question: string;
  options: { id: string; text: string }[];
  allow_multiple: boolean;
  show_results_before_vote: boolean;
}

export interface HighlightData {
  color: string;
  note?: string;
}

export interface NoteData {
  text: string;
  type: 'annotation' | 'definition' | 'reference';
}

export interface LinkData {
  url: string;
  title?: string;
  description?: string;
}

export interface MediaData {
  type: 'audio' | 'video';
  url: string;
  title?: string;
  duration?: number;
  start_time?: number;
}

// Interactive form element types
export interface SelectData {
  label: string;
  placeholder?: string;
  options: { id: string; text: string }[];
  required?: boolean;
  default_value?: string;
}

export interface MultiselectData {
  label: string;
  placeholder?: string;
  options: { id: string; text: string }[];
  required?: boolean;
  min_selections?: number;
  max_selections?: number;
  default_values?: string[];
}

export interface TextboxData {
  label: string;
  placeholder?: string;
  required?: boolean;
  max_length?: number;
  validation_pattern?: string;
  default_value?: string;
}

export interface TextareaData {
  label: string;
  placeholder?: string;
  required?: boolean;
  max_length?: number;
  rows?: number;
  default_value?: string;
}

export interface RadioData {
  label: string;
  options: { id: string; text: string; description?: string }[];
  required?: boolean;
  default_value?: string;
  layout?: 'vertical' | 'horizontal';
}

export interface CheckboxData {
  label: string;
  options: { id: string; text: string; description?: string }[];
  required?: boolean;
  min_selections?: number;
  max_selections?: number;
  default_values?: string[];
  layout?: 'vertical' | 'horizontal';
}

export interface CodeBlockData {
  title?: string;
  language: string;
  code: string;
  line_numbers?: boolean;
  highlight_lines?: number[];
  caption?: string;
  editable?: boolean;
}

export interface ScriptureBlockData {
  reference: string;
  version?: string;
  text: string;
  title?: string;
  notes?: string;
  show_reference?: boolean;
}

// Form response for interactive elements
export interface FormResponse {
  id: string;
  inline_content_id: string;
  user_id: string;
  response_data: any;
  created_at: string;
  updated_at: string;
}

// Poll and Question responses
export interface PollResponse {
  id: string;
  inline_content_id: string;
  user_id: string;
  selected_option: string;
  created_at: string;
}

export interface QuestionAnswer {
  id: string;
  inline_content_id: string;
  user_id: string;
  answer_text?: string;
  selected_options?: string[];
  is_correct?: boolean;
  created_at: string;
}

// Reading progress
export interface ReadingProgress {
  id: string;
  user_id: string;
  book_id: string;
  current_chapter_id?: string;
  scroll_position: number;
  percent_complete: number;
  last_read_at: string;
  started_at: string;
  completed_at?: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  count?: number;
}

export interface AuthResponse {
  user: User;
  session: {
    access_token: string;
    refresh_token: string;
  };
  profile?: Profile;
}
