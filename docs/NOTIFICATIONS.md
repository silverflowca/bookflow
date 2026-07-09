# BookFlow — Notifications & Email Manual

## Overview

BookFlow has two parallel notification systems that always run together:

- **In-app notifications** — appear in the bell icon in the top nav, always delivered
- **Email notifications** — sent via Resend, subject to user preferences and domain configuration

Every notification event inserts an in-app record first, then attempts an email. Email failure never blocks the original action.

---

## For Platform Administrators

### Setting up Resend email

1. Go to [resend.com](https://resend.com) and create an account
2. Add your domain under **Domains** (e.g. `silverflow.ca`) and follow the DNS verification steps
3. Generate an API key under **API Keys**
4. In BookFlow **Settings → Resend Email**:
   - Paste your API key into **Resend API Key**
   - Set the **Default From Address** (e.g. `BookFlow <noreply@silverflow.ca>`)
5. Restart the server (or set `RESEND_API_KEY` and `EMAIL_FROM` in `.env` for server-level config)

> The domain in the From Address must be verified in Resend or emails will be rejected.

### Default From Address priority

BookFlow resolves the sender address using this fallback chain:

```
Study Group / Club  →  email_from on book_clubs table
Book                →  email_from on books table
App Settings        →  Default From Address (set in Settings UI)
Server              →  EMAIL_FROM in .env
```

The first non-empty value wins. This means each book and club can have its own branded sender address.

### Configuring which user types receive emails

System-level email enablement is controlled globally. All registered users with a profile email are eligible by default. Individual users can opt out per notification type from their own settings.

---

## For Book Authors

### Setting a book-level From Address

In your book's settings, you can set a custom **Email From** address for all notifications related to that book (comments, reviews, invites). This overrides the platform default.

Example: `My Novel <hello@mynovel.com>`

> The domain must be verified in the same Resend account used by the platform.

### Notification events for your book

| Event | Who receives it |
|-------|----------------|
| New comment on a chapter | Book author |
| Reply to a comment | Book author |
| Collaborator invited | The invited person |
| Review submitted | Book author |
| Review approved | The reviewer |
| Review not approved | The reviewer |

---

## For Book Club Owners

### Setting a club-level From Address

In your club settings, you can set a custom **Email From** address for all club notifications. This overrides both the book-level and platform-level defaults.

Example: `Our Book Club <hello@ourbookclub.com>`

### Notification events for clubs

| Event | Who receives it |
|-------|----------------|
| Club invite | The invited person |
| New book added to club | All club members |
| New discussion posted | All club members |
| Reply to a discussion | The discussion author |
| Chat mention (@name) | The mentioned user |
| New chat message | All club members (based on their chat notification mode) |

### Chat notification modes (per member)

Each member can set their own chat notification level:

| Mode | Behaviour |
|------|-----------|
| **All** | Email for every new message |
| **Mentions only** | Email only when @mentioned |
| **None** | No chat emails (in-app only) |
| **Inherit** | Uses the club's default setting |

Club owners set the club default in **Club Settings → Chat**.

---

## For Study Group Facilitators

Study groups use the same infrastructure as clubs (`club_type = 'study_group'`). The same From Address and notification config fields apply.

### Notification events for study groups

| Event | Who receives it |
|-------|----------------|
| Group invite | The invited participant |
| New book added to group | All participants |
| Session scheduled | All participants |
| Chapter deadline approaching | All participants |
| Facilitator posted a discussion | All participants |
| Reply to a group discussion | The discussion author |
| Member completed a chapter | Facilitator |
| Chat mention | The mentioned user |

---

## For All Users — Managing Your Email Preferences

Go to **Settings → Email Notifications** to control which types of emails you receive.

Each toggle controls one notification type:

| Toggle | What it controls |
|--------|-----------------|
| New comments | Someone comments on a book you're involved with |
| Comment replies | Someone replies to your comment |
| Collaboration invites | You're invited to co-author a book |
| Review submitted | A review is created on your book |
| Review approved | Your review was approved |
| Review not approved | Your review was not approved |
| Feedback replies | An admin replied to your feedback submission |
| Club invites | You're invited to join a book club |
| New club book | A book is added to a club you're in |
| Club discussions | A new discussion is posted in your club |
| Discussion replies | Someone replies to your discussion |
| Chat mentions | You're @mentioned in club or group chat |
| Club chat messages | New messages in club chat (if set to All) |

**Toggling off a type:**
- Stops the email for that type
- In-app notification still appears in the bell icon
- Change takes effect immediately — no page reload required

**Important:** These are your personal preferences. A club owner cannot override your opt-out. However, if the platform administrator has disabled a notification type at the system level, you will not receive it even if your toggle is on.

---

## For Developers / Self-Hosting

### Environment variables

```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx   # Resend API key
EMAIL_FROM=BookFlow <noreply@yourdomain.com>  # Fallback from address
```

### Database columns

| Table | Column | Purpose |
|-------|--------|---------|
| `bookflow.profiles` | `notification_prefs JSONB` | Per-user opt-out map e.g. `{ "comment": false }` |
| `bookflow.books` | `email_from TEXT` | Book-level from address override |
| `bookflow.book_clubs` | `email_from TEXT` | Club/group-level from address override |
| `bookflow.app_settings` | `resend_api_key TEXT` | Per-admin Resend key (UI-configurable) |
| `bookflow.app_settings` | `email_from TEXT` | Platform default from address (UI-configurable) |
| `bookflow.user_notifications` | All records | In-app notification store |
| `bookflow.study_group_progress` | Per member per chapter | Chapter completion tracking for study groups |

### Notification types (full list)

```
Book:         comment, comment_reply, invite,
              review_submitted, review_approved, review_rejected

Club:         club_invite, club_book_added, club_discussion,
              club_discussion_reply, club_join_request,
              club_request_declined, club_invite_cancelled,
              chat_message, chat_mention, status_update

Study Group:  group_invite, group_book_added, group_session,
              group_chapter_due, group_discussion,
              group_discussion_reply, group_progress

System:       feedback_reply
```

### Service files

| File | Purpose |
|------|---------|
| `server/services/email.js` | Resend REST wrapper + HTML email templates |
| `server/services/notifications.js` | `createNotification()` — in-app insert + email dispatch + from-address resolution |

### Adding a new notification type

1. Add the type string to the `CHECK` constraint in a new migration (follow pattern of `043_email_from_notify_config.sql`)
2. Add a template case to `getEmailTemplate()` in `server/services/email.js`
3. Call `createNotification(supabase, { userId, type, title, body, ...contextIds })` from your route
4. Add a toggle to `client/src/pages/Settings.tsx` notification prefs list if it should be user-controllable

### Migrations required for a fresh install (run in order)

```
040_enable_insert_panel.sql
041_notification_prefs.sql
042_resend_api_key.sql
043_email_from_notify_config.sql
```
