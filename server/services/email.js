/**
 * email.js — Resend email service for BookFlow
 *
 * sendEmail({ to, subject, html }) — sends via Resend API
 * getEmailTemplate(type, data)    — returns { subject, html } per notification type
 *
 * Gracefully no-ops if RESEND_API_KEY is not set.
 */

const ENV_RESEND_API_KEY = process.env.RESEND_API_KEY;
export const EMAIL_FROM  = process.env.EMAIL_FROM || 'BookFlow <noreply@silverflow.ca>';
const CLIENT_URL         = (process.env.CLIENT_URL || 'http://localhost:5177').split(',')[0].trim();

// ── Resend API wrapper ────────────────────────────────────────────────────────

// `from` is optional — callers can pass a context-resolved address; falls back to EMAIL_FROM
// `apiKey` is optional — callers can pass the DB-stored key; falls back to process.env.RESEND_API_KEY
export async function sendEmail({ from, to, subject, html, apiKey } = {}) {
  const key = apiKey || ENV_RESEND_API_KEY;
  if (!key) return false;
  if (!to) return false;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: from || EMAIL_FROM, to, subject, html }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[email] Resend error:', res.status, err);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] sendEmail failed:', err.message);
    return false;
  }
}

// ── Shared layout wrapper ─────────────────────────────────────────────────────

function layout({ title, preheader, body, ctaLabel, ctaUrl }) {
  const settingsUrl = `${CLIENT_URL}/profile`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:ui-sans-serif,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f3f4f6;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#4f46e5;padding:24px 32px;">
            <span style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">BookFlow</span>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 12px;font-size:18px;font-weight:600;color:#111827;">${title}</h2>
            ${preheader ? `<p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">${preheader}</p>` : ''}
            ${body ? `<p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">${body}</p>` : ''}
            ${ctaLabel && ctaUrl ? `
            <a href="${ctaUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">${ctaLabel} →</a>
            ` : ''}
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 24px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
              You received this email because you have notifications enabled on BookFlow.
              <a href="${settingsUrl}" style="color:#6b7280;">Manage email preferences</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export function getEmailTemplate(type, data = {}) {
  const { title, body, book_id, chapter_id, club_id, invite_token } = data;

  const bookUrl    = book_id    ? `${CLIENT_URL}/book/${book_id}` : CLIENT_URL;
  const clubUrl    = club_id    ? `${CLIENT_URL}/clubs/${club_id}` : CLIENT_URL;
  const inviteUrl  = invite_token ? `${CLIENT_URL}/invite/${invite_token}` : bookUrl;
  const settingsUrl = `${CLIENT_URL}/profile`;

  switch (type) {
    case 'invite':
      return {
        subject: title || 'You have been invited to collaborate on a book',
        html: layout({
          title: title || 'Book Collaboration Invite',
          preheader: body,
          ctaLabel: 'View Book',
          ctaUrl: inviteUrl,
        }),
      };

    case 'comment':
      return {
        subject: title || 'New comment on your book',
        html: layout({
          title: title || 'New Comment',
          body: body,
          ctaLabel: 'View Comment',
          ctaUrl: chapter_id ? `${CLIENT_URL}/book/${book_id}/chapter/${chapter_id}` : bookUrl,
        }),
      };

    case 'comment_reply':
      return {
        subject: title || 'New reply to a comment',
        html: layout({
          title: title || 'New Reply',
          body: body,
          ctaLabel: 'View Reply',
          ctaUrl: chapter_id ? `${CLIENT_URL}/book/${book_id}/chapter/${chapter_id}` : bookUrl,
        }),
      };

    case 'review_submitted':
      return {
        subject: title || 'A review has been requested',
        html: layout({
          title: title || 'Review Requested',
          body: body,
          ctaLabel: 'View Book',
          ctaUrl: bookUrl,
        }),
      };

    case 'review_approved':
      return {
        subject: title || 'Your review has been approved',
        html: layout({
          title: title || 'Review Approved',
          body: body || 'Congratulations! Your review was approved.',
          ctaLabel: 'View Book',
          ctaUrl: bookUrl,
        }),
      };

    case 'review_rejected':
      return {
        subject: title || 'Your review was not approved',
        html: layout({
          title: title || 'Review Not Approved',
          body: body,
          ctaLabel: 'View Book',
          ctaUrl: bookUrl,
        }),
      };

    case 'feedback_reply':
      return {
        subject: title || 'New reply to your feedback',
        html: layout({
          title: title || 'Feedback Reply',
          body: body,
          ctaLabel: 'View Feedback',
          ctaUrl: `${CLIENT_URL}/my-feedback`,
        }),
      };

    case 'club_invite':
      return {
        subject: title || 'You have been invited to a book club',
        html: layout({
          title: title || 'Book Club Invite',
          body: body,
          ctaLabel: 'View Club',
          ctaUrl: club_id ? clubUrl : CLIENT_URL,
        }),
      };

    case 'club_join_request':
      return {
        subject: title || 'New join request for your club',
        html: layout({
          title: title || 'Join Request',
          body: body,
          ctaLabel: 'View Club',
          ctaUrl: clubUrl,
        }),
      };

    case 'club_request_declined':
    case 'club_invite_cancelled':
      return {
        subject: title || 'Club membership update',
        html: layout({
          title: title || 'Club Update',
          body: body,
          ctaLabel: 'Browse Clubs',
          ctaUrl: `${CLIENT_URL}/clubs`,
        }),
      };

    case 'club_book_added':
      return {
        subject: title || 'A new book was added to your club',
        html: layout({
          title: title || 'New Club Book',
          body: body,
          ctaLabel: 'View Club',
          ctaUrl: clubUrl,
        }),
      };

    case 'club_discussion':
      return {
        subject: title || 'New discussion in your club',
        html: layout({
          title: title || 'New Discussion',
          body: body,
          ctaLabel: 'Join Discussion',
          ctaUrl: clubUrl,
        }),
      };

    case 'club_discussion_reply':
      return {
        subject: title || 'New reply in a club discussion',
        html: layout({
          title: title || 'Discussion Reply',
          body: body,
          ctaLabel: 'View Reply',
          ctaUrl: clubUrl,
        }),
      };

    case 'chat_mention':
      return {
        subject: title || 'You were mentioned in a club chat',
        html: layout({
          title: title || 'You were mentioned',
          body: body,
          ctaLabel: 'View Chat',
          ctaUrl: clubUrl,
        }),
      };

    case 'chat_message':
      return {
        subject: title || 'New message in your book club',
        html: layout({
          title: title || 'New Club Message',
          body: body,
          ctaLabel: 'View Chat',
          ctaUrl: clubUrl,
        }),
      };

    default:
      return {
        subject: title || 'BookFlow notification',
        html: layout({ title: title || 'Notification', body }),
      };
  }
}
