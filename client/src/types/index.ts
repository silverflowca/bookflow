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
  slug?: string;
  share_token?: string;
  review_status?: 'none' | 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  author?: Profile;
  chapters?: Chapter[];
  settings?: BookSettings;
  collaborators?: BookCollaborator[];
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
  last_edited_by?: string;
  created_at: string;
  updated_at: string;
}

// Collaboration types
export type CollaboratorRole = 'owner' | 'author' | 'editor' | 'reviewer';

export interface BookCollaborator {
  id: string;
  book_id: string;
  user_id: string | null;
  role: Exclude<CollaboratorRole, 'owner'>;
  invited_email?: string;
  invite_accepted_at: string | null;
  invite_token?: string;
  created_at: string;
  user?: Pick<Profile, 'id' | 'display_name' | 'email' | 'avatar_url'>;
  invited_by_user?: Pick<Profile, 'id' | 'display_name'>;
}

export interface BookVersion {
  id: string;
  book_id: string;
  version_number: number;
  label?: string;
  snapshot?: { chapters: Chapter[]; snapped_at: string };
  created_by: string;
  trigger: 'manual' | 'submit_review' | 'publish' | 'auto';
  created_at: string;
  created_by_user?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>;
}

export interface BookComment {
  id: string;
  book_id: string;
  chapter_id?: string;
  parent_id?: string;
  author_id: string;
  body: string;
  selection_start?: number;
  selection_end?: number;
  anchor_text?: string;
  status: 'open' | 'resolved' | 'rejected';
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
  author?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>;
  resolver?: Pick<Profile, 'id' | 'display_name'>;
  replies?: BookComment[];
}

export interface ReviewRequest {
  id: string;
  book_id: string;
  version_id?: string;
  submitted_by: string;
  submitted_at: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  reviewed_by?: string;
  reviewed_at?: string;
  reviewer_note?: string;
  message?: string;
  submitter?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>;
  reviewer?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>;
  version?: Pick<BookVersion, 'id' | 'version_number' | 'label'>;
}

export type NotificationType =
  | 'invite' | 'comment' | 'comment_reply'
  | 'review_submitted' | 'review_approved' | 'review_rejected' | 'mention';

export interface UserNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string;
  book_id?: string;
  chapter_id?: string;
  comment_id?: string;
  review_request_id?: string;
  invite_token?: string;
  read_at?: string;
  created_at: string;
  book?: Pick<Book, 'id' | 'title'>;
  chapter?: Pick<Chapter, 'id' | 'title'>;
}

export type ActivityEventType = 'version' | 'comment' | 'inline_content' | 'change_log';

export interface ActivityEvent {
  id: string;
  event_type: ActivityEventType;
  created_at: string;
  actor?: { id: string; display_name: string; avatar_url?: string } | null;
  description: string;
  meta: Record<string, unknown>;
}

// Inline content types
export type InlineContentType =
  | 'question' | 'poll' | 'highlight' | 'note' | 'link' | 'audio' | 'video'
  | 'select' | 'multiselect' | 'textbox' | 'textarea' | 'radio' | 'checkbox'
  | 'code_block' | 'scripture_block';

// Display mode for interactive content
export type InlineDisplayMode = 'inline' | 'sidebar' | 'start_of_chapter' | 'end_of_chapter';

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
  response_visibility?: 'private' | 'members_only' | 'all_readers';
  position_in_chapter: 'inline' | 'end_of_chapter' | 'start_of_chapter';
  display_mode?: InlineDisplayMode; // How the content is displayed to readers
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

export interface FormResponseWithUser extends FormResponse {
  user: { id: string; display_name: string; avatar_url?: string };
}

export interface FormResponseAggregate {
  counts: Record<string, number>;
  total: number;
  options: { id: string; text: string; count: number; percent: number }[];
}

export interface AllFormResponsesResult {
  responses: FormResponseWithUser[];
  aggregates: FormResponseAggregate | null;
  total: number;
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

// ── LiveFlow types ────────────────────────────────────────────────────────────

export type LiveRecurrence = 'weekly' | 'biweekly' | 'monthly' | 'none';
export type LiveEpisodeStatus = 'scheduled' | 'live' | 'ended' | 'cancelled';
export type LiveRequestType = 'prayer' | 'question' | 'comment';
export type LivePlatform = 'youtube' | 'facebook' | 'twitch' | 'restream';

export interface LiveShow {
  id: string;
  title: string;
  description?: string;
  book_id?: string;
  host_user_id: string;
  restream_channel_id?: string;
  guest_invite_url?: string;
  recurrence: LiveRecurrence;
  recurrence_day?: number;   // 0=Sun..6=Sat
  recurrence_time?: string;  // HH:MM
  timezone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // joined
  books?: { id: string; title: string; cover_image_url?: string };
}

export interface LiveSlide {
  id: string;
  type: 'title' | 'heading' | 'content' | 'scripture' | 'list' | 'discussion' | 'closing';
  text?: string;
  reference?: string;   // for scripture slides
  items?: string[];     // for list slides
}

export interface LiveSlideDeck {
  name: string;
  slides: LiveSlide[];
}

export interface LiveEpisode {
  id: string;
  show_id?: string;
  title: string;
  chapter_id?: string;
  scheduled_at: string;
  started_at?: string;
  ended_at?: string;
  status: LiveEpisodeStatus;
  restream_session_id?: string;
  youtube_broadcast_id?: string;
  recording_url?: string;
  guest_invite_url?: string;
  slide_deck?: LiveSlideDeck;
  notes?: string;
  created_at: string;
  updated_at: string;
  // joined
  live_shows?: { host_user_id: string; title: string; book_id?: string; guest_invite_url?: string };
  chapters?: { id: string; title: string; content?: any };
}

export interface LiveChatMessage {
  id: string;
  episode_id: string;
  platform: LivePlatform;
  platform_user?: string;
  body: string;
  received_at: string;
}

export interface LiveRequest {
  id: string;
  episode_id: string;
  source_message_id?: string;
  body: string;
  type: LiveRequestType;
  flagged_by?: string;
  resolved: boolean;
  created_at: string;
}

export type LiveSendTarget = 'chat' | 'lower_third' | 'caption';

export interface LiveQueueGroup {
  id: string;
  episode_id: string;
  label: string;
  sort_order: number;
  created_at: string;
}

export interface LiveQueueItem {
  id: string;
  episode_id: string;
  group_id?: string | null;
  type: 'verse' | 'passage' | 'custom';
  label: string;
  body: string;
  book_ref?: string | null;
  chapter_ref?: number | null;
  verse_start?: number | null;
  verse_end?: number | null;
  sort_order: number;
  sent_at?: string | null;
  sent_targets?: LiveSendTarget[] | null;
  created_at: string;
}

export interface BibleVerse {
  book_name: string;
  book_order: number;
  chapter: number;
  verse: number;
  text: string;
}
