/**
 * notifications.js — Unified notification helper
 *
 * createNotification(supabase, { userId, type, title, body, ...extras })
 *   1. Inserts in-app notification (always)
 *   2. Looks up recipient's email + notification_prefs
 *   3. Resolves "from" address: book/club → app_settings → .env
 *   4. Sends Resend email unless user opted out of this type
 *
 * createNotifications(supabase, rows[])
 *   Batch version — fires createNotification for each row concurrently.
 *
 * From-address resolution chain:
 *   study_group_id / club_id → book_clubs.email_from
 *   book_id                  → books.email_from
 *                            → app_settings.email_from  (first admin's settings)
 *                            → process.env.EMAIL_FROM
 */

import { sendEmail, getEmailTemplate } from './email.js';

const ENV_EMAIL_FROM = process.env.EMAIL_FROM || 'BookFlow <noreply@silverflow.ca>';

/**
 * Resolve the "from" address for an outgoing email.
 * Walks: club/group → book → app_settings → .env
 */
async function resolveEmailFrom(supabase, { book_id, club_id, study_group_id } = {}) {
  const contextId = study_group_id || club_id;

  // 1. Club or study group
  if (contextId) {
    const { data: club } = await supabase
      .schema('bookflow')
      .from('book_clubs')
      .select('email_from')
      .eq('id', contextId)
      .single();
    if (club?.email_from) return club.email_from;
  }

  // 2. Book
  if (book_id) {
    const { data: book } = await supabase
      .schema('bookflow')
      .from('books')
      .select('email_from')
      .eq('id', book_id)
      .single();
    if (book?.email_from) return book.email_from;
  }

  // 3. App settings (first admin row that has email_from set)
  const { data: settings } = await supabase
    .schema('bookflow')
    .from('app_settings')
    .select('email_from')
    .neq('email_from', '')
    .limit(1)
    .maybeSingle();
  if (settings?.email_from) return settings.email_from;

  // 4. .env fallback
  return ENV_EMAIL_FROM;
}

export async function createNotification(supabase, { userId, type, title, body, ...extras }) {
  if (!userId) return;

  // 1. Insert in-app notification
  try {
    await supabase
      .schema('bookflow')
      .from('user_notifications')
      .insert({ user_id: userId, type, title, body, ...extras });
  } catch (err) {
    console.error('[notify] insert failed:', err.message);
    return;
  }

  // 2. Look up recipient profile for email + prefs
  try {
    const { data: profile } = await supabase
      .schema('bookflow')
      .from('profiles')
      .select('email, notification_prefs')
      .eq('id', userId)
      .single();

    if (!profile?.email) return;

    // 3. Check opt-out (absence = opted IN)
    const prefs = profile.notification_prefs ?? {};
    if (prefs[type] === false) return;

    // 4. Resolve from address from context chain
    const from = await resolveEmailFrom(supabase, extras);

    // 5. Send email
    const { subject, html } = getEmailTemplate(type, { title, body, ...extras });
    await sendEmail({ from, to: profile.email, subject, html });
  } catch (err) {
    // Email failure never breaks the request
    console.error('[notify] email failed:', err.message);
  }
}

export async function createNotifications(supabase, rows) {
  if (!rows?.length) return;
  await Promise.all(rows.map(row => createNotification(supabase, row)));
}
