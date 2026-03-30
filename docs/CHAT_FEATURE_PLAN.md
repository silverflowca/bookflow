# BookFlow Club Chat — Implementation Plan

_Feature: F20 — Club Chat_
_Last updated: 2026-03-30 (updated: admin settings + cron config added)_
_Status: **IMPLEMENTED**_

---

## Overview

A real-time group chat scoped to each book club. Every club member automatically gets access. Chat supports text, audio recordings (stored in FileFlow), and chapter comment snippets. System messages auto-post reading status updates. Settings control notifications and what gets posted.

---

## Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Real-time | **Supabase Realtime** (`postgres_changes`) | Already initialized, no new infra |
| Message storage | New `club_chat_messages` table | Clean separation from club discussions (long-form posts) |
| Audio storage | **FileFlow** — club audio folder | Consistent with all other bookflow media (F06) |
| Audio recording | Client-side blob → FileFlow API → message record | Same Railway-safe pattern used in fileflow AudioRecorder |
| Notifications | Extend `user_notifications` with new types | Reuse existing bell + inbox |
| Status updates | Server cron (weekly) + reading progress hook (completion) | Reliable, zero client dependency |

---

## Feature Index Entry

Add to `bookflow-features.md`:

| # | Feature | Status |
|---|---------|--------|
| F20 | Club Chat (real-time text, audio, snippets, status updates) | planned |

---

## 1. Database Schema — Migration `011_club_chat.sql`

### 1.1 `club_chat_messages`

```sql
CREATE TABLE bookflow.club_chat_messages (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id                UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  book_id                UUID REFERENCES bookflow.books(id) ON DELETE SET NULL,
  sender_id              UUID REFERENCES bookflow.profiles(id) ON DELETE SET NULL,
  -- NULL sender_id = system message (status updates, completion notices)

  message_type           TEXT NOT NULL DEFAULT 'text',
  -- 'text' | 'audio' | 'chapter_snippet' | 'system_status'

  body                   TEXT,                  -- text body or system message text

  -- Audio fields (message_type = 'audio')
  audio_fileflow_file_id TEXT,                  -- FileFlow file record ID
  audio_fileflow_url     TEXT,                  -- signed/direct URL (refreshed on fetch)
  audio_duration_seconds INTEGER,
  audio_mime_type        TEXT,

  -- Snippet fields (message_type = 'chapter_snippet')
  snippet_chapter_id     UUID REFERENCES bookflow.chapters(id) ON DELETE SET NULL,
  snippet_comment_id     UUID REFERENCES bookflow.book_comments(id) ON DELETE SET NULL,
  snippet_text           TEXT,                  -- quoted text
  snippet_offset_start   INTEGER,
  snippet_offset_end     INTEGER,

  -- System status fields (message_type = 'system_status')
  status_payload         JSONB,
  -- e.g. { "event": "progress", "member_id": "...", "chapter_title": "...", "percent": 42 }
  -- or   { "event": "completion", "chapter_title": "...", "answers": [...] }
  -- or   { "event": "weekly_summary", "members": [...] }

  reply_to_id            UUID REFERENCES bookflow.club_chat_messages(id) ON DELETE SET NULL,
  edited_at              TIMESTAMPTZ,
  deleted_at             TIMESTAMPTZ,           -- soft delete, NULL = visible
  created_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_club_chat_club_id     ON bookflow.club_chat_messages(club_id, created_at DESC);
CREATE INDEX idx_club_chat_sender      ON bookflow.club_chat_messages(sender_id);
CREATE INDEX idx_club_chat_snippet_ch  ON bookflow.club_chat_messages(snippet_chapter_id);
```

RLS:
- `SELECT`: club members only (`club_id IN (SELECT club_id FROM club_members WHERE user_id = auth.uid())`)
- `INSERT`: club members, `sender_id = auth.uid()` (system inserts via service role)
- `UPDATE`: own messages only (`sender_id = auth.uid()`)
- `DELETE`: disallowed (use soft delete via `deleted_at`)
- `service_role`: full access

Enable Supabase Realtime on this table.

---

### 1.2 `club_chat_settings`

```sql
CREATE TABLE bookflow.club_chat_settings (
  club_id                        UUID PRIMARY KEY
                                   REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  chat_enabled                   BOOLEAN DEFAULT true,
  allow_audio_messages           BOOLEAN DEFAULT true,
  allow_snippet_sharing          BOOLEAN DEFAULT true,

  -- Status update automation
  weekly_status_updates          BOOLEAN DEFAULT true,
  chapter_completion_updates     BOOLEAN DEFAULT true,
  show_answers_in_completion     BOOLEAN DEFAULT true,
  -- Respects club_settings.show_member_answers — both must be true to show answers

  -- Notification defaults (per-club default; members can override)
  default_notification_mode      TEXT DEFAULT 'all',
  -- 'all' | 'mentions' | 'none'

  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

Created automatically when a club is created (server-side after `INSERT INTO book_clubs`).

---

### 1.3 `club_chat_member_prefs`

Per-member notification preferences (overrides club default).

```sql
CREATE TABLE bookflow.club_chat_member_prefs (
  club_id           UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  notification_mode TEXT NOT NULL DEFAULT 'inherit',
  -- 'inherit' (use club default) | 'all' | 'mentions' | 'none'
  PRIMARY KEY (club_id, user_id)
);
```

---

### 1.4 `club_chat_read_receipts`

```sql
CREATE TABLE bookflow.club_chat_read_receipts (
  club_id              UUID NOT NULL REFERENCES bookflow.book_clubs(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES bookflow.profiles(id) ON DELETE CASCADE,
  last_read_message_id UUID REFERENCES bookflow.club_chat_messages(id) ON DELETE SET NULL,
  last_read_at         TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (club_id, user_id)
);
```

---

### 1.5 Extend `user_notifications.type`

Add new values to the CHECK constraint:

```sql
ALTER TABLE bookflow.user_notifications
  DROP CONSTRAINT IF EXISTS user_notifications_type_check;

ALTER TABLE bookflow.user_notifications
  ADD CONSTRAINT user_notifications_type_check CHECK (type IN (
    -- existing:
    'invite', 'comment', 'comment_reply',
    'review_submitted', 'review_approved', 'review_rejected', 'mention',
    -- new:
    'chat_message',    -- new message in a club (mode = 'all')
    'chat_mention',    -- @username in message body
    'status_update'    -- weekly / completion system post
  ));
```

---

### 1.6 FileFlow Folder for Chat Audio

When a club is created (or on first audio message), call `ensureClubChatFolder()` in the server:
- Creates a FileFlow folder at `bookflow / {Club Name} / chat-audio /`
- Stores the FileFlow folder ID in a new column: `book_clubs.chat_audio_fileflow_folder_id TEXT`

```sql
ALTER TABLE bookflow.book_clubs
  ADD COLUMN IF NOT EXISTS chat_audio_fileflow_folder_id TEXT;
```

---

## 2. Server — New Files & Changes

### 2.1 New route: `bookflow/server/routes/club-chat.js`

| Method | Path | Auth | Action |
|--------|------|------|--------|
| GET | `/api/clubs/:clubId/chat/messages` | member | Paginated messages, 50/page, cursor-based (`before` param = message ID) |
| POST | `/api/clubs/:clubId/chat/messages` | member | Send text or snippet message |
| PUT | `/api/clubs/:clubId/chat/messages/:msgId` | sender | Edit own text message |
| DELETE | `/api/clubs/:clubId/chat/messages/:msgId` | sender or admin | Soft delete (`deleted_at = NOW()`) |
| GET | `/api/clubs/:clubId/chat/settings` | member | Get chat settings |
| PUT | `/api/clubs/:clubId/chat/settings` | owner/admin | Update chat settings |
| GET | `/api/clubs/:clubId/chat/prefs` | self | Get own notification prefs for this club |
| PUT | `/api/clubs/:clubId/chat/prefs` | self | Update own notification prefs |
| POST | `/api/clubs/:clubId/chat/read` | member | Upsert read receipt (`last_read_message_id`) |
| GET | `/api/clubs/:clubId/chat/unread-count` | member | Count messages after `last_read_message_id` |

**Audio upload flow (POST `/messages` with `message_type: 'audio'`)**:
1. Client records audio → assembles Blob client-side
2. Client calls `POST /api/files/upload-url` (existing F06 route) to get a signed FileFlow upload URL, targeting the club's `chat_audio_fileflow_folder_id`
3. Client PUTs blob directly to FileFlow
4. Client calls `POST /api/clubs/:clubId/chat/messages` with `{ message_type: 'audio', audio_fileflow_file_id, audio_mime_type, audio_duration_seconds, body }`
5. Server fetches a fresh download URL from FileFlow and stores both `audio_fileflow_file_id` and `audio_fileflow_url`

**Snippet message (POST `/messages` with `message_type: 'chapter_snippet'`)**:
```json
{
  "message_type": "chapter_snippet",
  "body": "Optional note from sender",
  "snippet_chapter_id": "uuid",
  "snippet_comment_id": "uuid or null",
  "snippet_text": "Quoted text from chapter/comment",
  "snippet_offset_start": 1240,
  "snippet_offset_end": 1380
}
```

---

### 2.2 Changes to `bookflow/server/routes/clubs.js`

- On `POST /clubs` (create club): also INSERT into `club_chat_settings` with defaults
- On `GET /clubs/:clubId`: include `chat_settings` and `unread_count` in response

---

### 2.3 New service: `bookflow/server/services/chat-status.js`

**`postCompletionUpdate(clubId, userId, chapterId)`**
- Called from the reading progress route when `percent_complete` reaches 100% OR `current_chapter_id` changes
- Checks if club's `chapter_completion_updates = true`
- Checks if `club_settings.show_member_answers = true` AND `chat_settings.show_answers_in_completion = true` before including answers
- Inserts a `system_status` message with `status_payload = { event: 'completion', ... }`
- Creates `status_update` notification for each club member

**`postWeeklySummary()`** (cron — every Monday 9am)
- Queries all active clubs with `weekly_status_updates = true`
- For each club, queries `reading_progress` for all members where `last_read_at > NOW() - 7 days`
- Inserts a single `system_status` message per club with `status_payload = { event: 'weekly_summary', members: [...] }`
- Creates `status_update` notification for each club member

**`ensureClubChatFolder(clubId, clubName)`**
- Calls FileFlow API to create folder structure `bookflow/{clubName}/chat-audio/`
- Stores the returned folder ID in `book_clubs.chat_audio_fileflow_folder_id`
- Idempotent — checks if folder ID already set before calling FileFlow

---

### 2.4 Changes to `bookflow/server/routes/books.js`

In `PUT /books/:bookId/progress`:
- After saving progress, call `chat-status.postCompletionUpdate()` for all clubs where this book `is_current = true` and the user is a member
- Only fire if chapter actually changed or `percent_complete` went to 100

---

### 2.5 Changes to `bookflow/server/server.js`

```js
import clubChatRoutes from './routes/club-chat.js'
import { startStatusCron } from './services/chat-status.js'

app.use('/api/clubs', clubChatRoutes)
startStatusCron() // registers node-cron weekly job
```

Add `node-cron` to `package.json` dependencies.

---

## 3. Client — New Files

### 3.1 Hooks

**`bookflow/client/src/hooks/useClubChat.ts`**
- `messages` — paginated list (newest at bottom)
- `sendTextMessage(body, replyToId?)`
- `sendSnippetMessage(snippet, body?)`
- `editMessage(msgId, newBody)`
- `deleteMessage(msgId)`
- `loadMore()` — fetch older page
- `markRead(lastMessageId)`
- Real-time: subscribes to `postgres_changes` on `club_chat_messages` where `club_id = eq.{clubId}`
- Incoming messages appended in real-time; triggers toast via callback

**`bookflow/client/src/hooks/useChatUnread.ts`**
- Fetches unread counts for all of the user's clubs
- Returns `{ [clubId]: number }`
- Polled every 30s (no realtime needed — low priority data)

---

### 3.2 Components

**`bookflow/client/src/components/chat/ClubChatPanel.tsx`**
- Full chat UI as a resizable side panel or drawer
- Contains: `ChatMessageList`, `ChatInput`, header with club name + settings button
- Opened from club page (tab) or reader (floating button)
- Props: `clubId`, `bookId?` (for context-aware snippet sharing), `onClose`

**`bookflow/client/src/components/chat/ChatMessageList.tsx`**
- Virtualized scroll (use `react-virtual` or simple overflow-y scroll with scroll-to-bottom)
- Groups messages by date
- "Load older messages" button at top
- Auto-scrolls to bottom on new message if user is at/near bottom

**`bookflow/client/src/components/chat/ChatMessageItem.tsx`**
- Renders one message based on `message_type`:
  - `text` → sender avatar + name + body + timestamp + edit/delete actions
  - `audio` → sender + audio player (`<audio>` tag with `audio_fileflow_url`) + duration
  - `chapter_snippet` → quoted card (see §3.2.1) + optional body text
  - `system_status` → styled system bubble (no avatar) — see §3.2.2
- Soft-deleted messages shown as *"This message was deleted"* (dimmed)
- Reply-to preview bar above message if `reply_to_id` set

**`bookflow/client/src/components/chat/ChatSnippetCard.tsx`**
- Renders the snippet quote card:
  ```
  ┌──────────────────────────────────────┐
  │ 📄 Chapter 3 · "The Soul of the World"
  │ ─────────────────────────────────────
  │ "This part really made me think about
  │  how we chase our Personal Legend..."
  │                   [Jump to Chapter →]
  └──────────────────────────────────────┘
  ```
- "Jump to Chapter" link → `/clubs/:clubId/read/:bookId?chapter=:chapterId&offset=:start&highlight=:end`
- The reader page will need to read those URL params and scroll + highlight the text range on load

**`bookflow/client/src/components/chat/ChatSystemMessage.tsx`**
- Renders `system_status` messages based on `status_payload.event`:
  - `completion` → *"✅ Damion just finished Chapter 3 — here are his answers: ..."*
  - `progress` → *"📖 Damion moved to Chapter 4 (58% complete)"*
  - `weekly_summary` → summary card listing all member progress

**`bookflow/client/src/components/chat/ChatInput.tsx`**
- Text textarea with send button (Enter to send, Shift+Enter for newline)
- Attach menu (paperclip icon) with options: **Record Audio**, **Share Snippet**
- Reply-to bar (shown when replying, with cancel button)
- Disabled when `chat_settings.chat_enabled = false`

**`bookflow/client/src/components/chat/ChatAudioRecorder.tsx`**
- Adapted from FileFlow's `AudioRecorder.tsx`
- Records via `MediaRecorder` API, collects chunks client-side
- On save:
  1. Assemble `Blob`
  2. Call `api.getUploadUrl({ folderId: club.chat_audio_fileflow_folder_id })`
  3. PUT blob to signed FileFlow URL
  4. Call `api.registerFile()` → get `fileflow_file_id`
  5. Return `{ fileflow_file_id, mime_type, duration_seconds }` to parent
  6. Parent calls `sendAudioMessage()`
- Shows waveform + timer during recording
- Shows upload progress bar after stopping

**`bookflow/client/src/components/chat/ChatSettingsModal.tsx`**
- Shown to owner/admin via gear icon in chat header
- Toggles: `chat_enabled`, `allow_audio_messages`, `allow_snippet_sharing`, `weekly_status_updates`, `chapter_completion_updates`, `show_answers_in_completion`, `default_notification_mode`
- Saves to `PUT /api/clubs/:clubId/chat/settings`

**`bookflow/client/src/components/chat/NotificationPrefsPopover.tsx`**
- Shown to any member via bell icon in chat header
- Per-member override: `notification_mode` (`inherit` / `all` / `mentions` / `none`)
- Saves to `PUT /api/clubs/:clubId/chat/prefs`

---

### 3.3 Notification Toast

**`bookflow/client/src/components/chat/ChatToast.tsx`**
- Triggered by Supabase Realtime when a new message arrives and chat panel is not open
- Small bottom-right toast: avatar + sender name + message preview
- "View" button opens the club chat panel
- Auto-dismisses after 5s
- Stacks (max 3 visible at once)
- Respects user's `notification_mode` — no toast if `'none'`

---

### 3.4 "Share to Chat" button on Comments

**Changes to `bookflow/client/src/components/comments/CommentThread.tsx`**
- Add a → (share) icon button on each comment
- Opens `ShareToClubModal`:
  - Lists user's clubs where the current book `is_current`
  - Optional note field
  - Sends `chapter_snippet` message

**New: `bookflow/client/src/components/chat/ShareToClubModal.tsx`**

---

### 3.5 Page Integration

**`bookflow/client/src/pages/ClubDetail.tsx`** (existing)
- Add **Chat** tab alongside Members / Books / Discussions
- Tab badge shows unread count (from `useChatUnread`)
- Renders `<ClubChatPanel clubId={clubId} />`

**`bookflow/client/src/pages/BookReader.tsx`** (existing)
- Add floating chat button (bottom-right corner, speech bubble icon)
- Badge on button shows unread count for this club
- Button opens `<ClubChatPanel clubId={clubId} bookId={bookId} />` as a slide-in drawer over the reader
- "Share snippet from chapter" in the reader toolbar → triggers `ShareToClubModal` pre-filled with current chapter + selected text

**`bookflow/client/src/pages/ClubReader.tsx`** (existing — `/clubs/:clubId/read/:bookId`)
- Read URL params `?chapter=:chapterId&offset=:start&highlight=:end`
- On mount, scroll to `offset` and apply temporary highlight to the text range
- This is the deep-link target from `ChatSnippetCard`

---

## 4. Notification Flow Summary

| Trigger | Who gets notified | Type | Toast? | Bell? |
|---------|------------------|------|--------|-------|
| New text/audio message | All members (mode=`all`) | `chat_message` | ✓ | ✓ |
| @username mention | Mentioned user only | `chat_mention` | ✓ | ✓ |
| Chapter completion | All club members | `status_update` | ✓ | ✓ |
| Weekly summary | All club members | `status_update` | ✗ | ✓ |

Member-level overrides via `club_chat_member_prefs.notification_mode`:
- `inherit` → use club default
- `all` → toast + bell for all messages
- `mentions` → only @mentions trigger toast/bell
- `none` → no notifications (bell still shows system status updates)

---

## 5. System Status Message Formats

### Chapter completion
```
✅  Damion just finished Chapter 3: "The Soul of the World"

Here are his answers:
  Q: What did the alchemist teach Santiago?
  A: "Follow your Personal Legend"

                               [Jump to Chapter →]
```
_(Answers shown only if both `club_settings.show_member_answers` AND `chat_settings.show_answers_in_completion` are true)_

### Weekly summary (posted Monday 9am)
```
📖  Weekly Reading Update — The Alchemist

  Damion        Chapter 4 · 58% complete
  Sarah         Chapter 7 · 89% complete
  Marcus        ✓ Completed
  Jordan        Chapter 1 · 12% complete  (joined this week)
```

---

## 6. FileFlow Integration Details

### Folder structure in FileFlow
```
bookflow/
  {Club Name}/
    chat-audio/
      {timestamp}_{uuid}.webm
      {timestamp}_{uuid}.m4a
      ...
```

### Audio URL refresh
FileFlow signed URLs expire. On `GET /chat/messages`, the server batch-refreshes all `audio_fileflow_url` values in the returned page that are older than 1 hour (checking `updated_at` on message or a separate `audio_url_refreshed_at` column). This keeps the audio always playable without client-side token management.

Alternatively, the client can call `GET /api/files/:fileflowId/url` (existing FileFlow route) when an audio URL 403s.

---

## 7. Implementation Order

| Step | File(s) | What |
|------|---------|------|
| 1 | `bookflow/migrations/011_club_chat.sql` | All new tables, constraints, RLS, realtime enable, `user_notifications` type extension |
| 2 | `bookflow/server/routes/club-chat.js` | All chat API endpoints |
| 3 | `bookflow/server/services/chat-status.js` | `postCompletionUpdate`, `postWeeklySummary`, `ensureClubChatFolder` |
| 4 | `bookflow/server/routes/clubs.js` | Create `club_chat_settings` on club creation; include unread in club response |
| 5 | `bookflow/server/routes/books.js` | Hook reading progress → chat completion trigger |
| 6 | `bookflow/server/server.js` | Mount `club-chat` routes, start cron |
| 7 | `client/src/hooks/useClubChat.ts` | Data + realtime layer |
| 8 | `client/src/hooks/useChatUnread.ts` | Unread counts |
| 9 | `client/src/components/chat/` | All 10 chat components |
| 10 | `client/src/components/comments/CommentThread.tsx` | Share to Chat button |
| 11 | `client/src/pages/ClubDetail.tsx` | Chat tab |
| 12 | `client/src/pages/BookReader.tsx` | Floating chat button + snippet share |
| 13 | `client/src/pages/ClubReader.tsx` | Deep-link scroll + highlight |
| 14 | `client/src/lib/api.ts` | New API methods for chat |
| 15 | Run `011_club_chat.sql` locally + on Railway | DB ready |

---

## 8. Impact on Existing Features

| Feature | Impact |
|---------|--------|
| F06 File Storage | Chat audio uses FileFlow. `ensureClubChatFolder` calls `services/fileflow.js`. If FileFlow token missing, audio messages disabled gracefully. |
| F08 Comments | `book_comments.id` referenced as `snippet_comment_id` in chat messages. Deleting a comment sets `snippet_comment_id = NULL` (ON DELETE SET NULL). |
| F10 Notifications | New types added (`chat_message`, `chat_mention`, `status_update`). `user_notifications` CHECK constraint must be updated in migration. `NotificationBell.tsx` needs new display entries. |
| F17 App Settings | Chat audio upload uses the same FileFlow token from `app_settings`. No new settings needed. |
| F18 Reading Progress | Progress update hook triggers completion messages. |
| Club Discussions | Discussions remain separate (long-form posts). Chat is ephemeral, conversational. |

---

## 9. Cross-Feature Impact Matrix Update

Add to `bookflow-features.md` impact matrix:

| Changing | Must also check |
|----------|----------------|
| `club_chat_messages` table | F20 chat routes, realtime subscription |
| `user_notifications.type` CHECK | F10, F07, F08, F09, **F20** |
| `reading_progress` update | F18, **F20** (completion trigger) |
| `services/fileflow.js` | F06, F15, F16, F17, **F20** (chat audio) |
| `club_settings.show_member_answers` | ClubSettings page, **F20** (controls answer visibility in completion messages) |

---

## 10. Chat Admin Settings Page (`ChatSettingsModal`)

The `ChatSettingsModal` component (opened from the gear icon in the chat header, admin/owner only) provides full control over all chat behaviour:

### General Section
| Setting | Default | Description |
|---------|---------|-------------|
| Enable chat | On | Master toggle — disables input for all members when off |
| Allow audio messages | On | Show/hide the Record Audio option in the attach menu |
| Allow chapter snippet sharing | On | Show/hide Share Snippet option |

### Default Notifications Section
| Setting | Default | Description |
|---------|---------|-------------|
| Member notification default | All messages | Applied to all members unless they override via their own prefs |

Members override per-club via the 🔔 bell icon → `NotificationPrefsPopover`:
- **Club default** — inherit from admin setting
- **All messages** — toast + badge on every message
- **Mentions only** — only when @mentioned
- **None** — silent (badge still updates)

### Reading Status Updates Section
| Setting | Default | Description |
|---------|---------|-------------|
| Post chapter completion updates | On | Auto-post when a member finishes a chapter or progresses |
| Include member answers | On | Show Q&A answers in completion posts (respects club answer visibility) |
| Post weekly reading summaries | On | Auto-post weekly progress for all members |

### Weekly Summary Schedule Section
Shown only when "Post weekly reading summaries" is enabled.

**Schedule Presets (dropdown):**
- Every Monday at 9:00 AM _(default)_
- Every Monday at 6:00 AM
- Every Wednesday at 9:00 AM
- Every Friday at 9:00 AM
- Every Sunday at 9:00 AM
- Every day at 9:00 AM
- Custom… _(shows cron expression input)_

**Custom cron input:**
- Standard 5-field cron syntax (`minute hour day-of-month month day-of-week`)
- Examples shown in hint text
- Times are UTC
- Validated by `node-cron` server-side; invalid expressions are rejected
- Stored in `club_chat_settings.weekly_cron_schedule` + `weekly_cron_label`
- On save, calls `rescheduleClubCron(clubId, expression)` to hot-swap the running cron task without restart

### Server-side cron management (`chat-status.js`)
- Global default schedule (`0 9 * * 1`) runs a single cron that processes all clubs using the default
- Clubs with custom schedules each get their own `node-cron` task stored in the `activeCrons` Map
- Changing a club's schedule via the UI calls `PUT /chat/settings` which triggers `rescheduleClubCron()` in real time
- On server restart, `startStatusCron()` re-loads all custom schedules from the DB

---

## 10. DB Table → Feature Map Update

Add to `bookflow-features.md`:

| Table | Features |
|-------|---------|
| `bookflow.club_chat_messages` | F20 |
| `bookflow.club_chat_settings` | F20 |
| `bookflow.club_chat_member_prefs` | F20 |
| `bookflow.club_chat_read_receipts` | F20 |
