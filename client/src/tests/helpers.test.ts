/**
 * Unit tests for pure helper functions used across the app.
 * Run: cd bookflow/client && npm test
 */
import { describe, it, expect } from 'vitest';

// ── timeAgo ───────────────────────────────────────────────────────────────────
// Inline copy of the helper (it's defined inline in multiple pages)

function timeAgo(dateStr: string | null) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 7 ? `${days}d ago` : new Date(dateStr).toLocaleDateString();
}

describe('timeAgo', () => {
  it('returns — for null', () => {
    expect(timeAgo(null)).toBe('—');
  });

  it('returns "just now" for <1 minute ago', () => {
    const recent = new Date(Date.now() - 30_000).toISOString();
    expect(timeAgo(recent)).toBe('just now');
  });

  it('returns minutes for <1 hour ago', () => {
    const ago = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(timeAgo(ago)).toBe('5m ago');
  });

  it('returns hours for <24 hours ago', () => {
    const ago = new Date(Date.now() - 3 * 3600_000).toISOString();
    expect(timeAgo(ago)).toBe('3h ago');
  });

  it('returns days for <7 days ago', () => {
    const ago = new Date(Date.now() - 2 * 86400_000).toISOString();
    expect(timeAgo(ago)).toBe('2d ago');
  });

  it('returns locale date for >=7 days ago', () => {
    const ago = new Date(Date.now() - 10 * 86400_000).toISOString();
    const result = timeAgo(ago);
    // Should be a date string like "6/1/2026", not "Xd ago"
    expect(result).not.toMatch(/d ago/);
    expect(result.length).toBeGreaterThan(3);
  });
});

// ── Progress percentage clamping ───────────────────────────────────────────────

function clampPct(pct: number) {
  return Math.min(100, Math.max(0, pct));
}

describe('progress bar clamping', () => {
  it('clamps negative to 0', () => expect(clampPct(-10)).toBe(0));
  it('clamps over 100 to 100', () => expect(clampPct(110)).toBe(100));
  it('passes through 0', () => expect(clampPct(0)).toBe(0));
  it('passes through 100', () => expect(clampPct(100)).toBe(100));
  it('passes through midpoint', () => expect(clampPct(55)).toBe(55));
});

// ── Member count logic ────────────────────────────────────────────────────────

interface Member { invite_accepted_at?: string; user_id: string; }

function countAccepted(members: Member[]) {
  return members.filter(m => m.invite_accepted_at).length;
}

describe('club member count', () => {
  const members: Member[] = [
    { user_id: 'a', invite_accepted_at: '2026-01-01T00:00:00Z' },
    { user_id: 'b', invite_accepted_at: '2026-01-02T00:00:00Z' },
    { user_id: 'c' }, // pending invite
  ];

  it('counts only accepted members', () => {
    expect(countAccepted(members)).toBe(2);
  });

  it('returns 0 for empty list', () => {
    expect(countAccepted([])).toBe(0);
  });

  it('returns 0 if none accepted', () => {
    expect(countAccepted([{ user_id: 'x' }, { user_id: 'y' }])).toBe(0);
  });
});

// ── Club progress sorting ─────────────────────────────────────────────────────

interface MemberStat {
  user_id: string;
  chapters_completed: number;
  items_completed: number;
}

function sortStats(stats: MemberStat[]) {
  return [...stats].sort((a, b) =>
    b.chapters_completed - a.chapters_completed || b.items_completed - a.items_completed
  );
}

describe('club progress leaderboard sort', () => {
  const stats: MemberStat[] = [
    { user_id: 'c', chapters_completed: 2, items_completed: 10 },
    { user_id: 'a', chapters_completed: 5, items_completed: 20 },
    { user_id: 'b', chapters_completed: 5, items_completed: 30 },
    { user_id: 'd', chapters_completed: 0, items_completed: 5 },
  ];

  it('ranks by chapters_completed descending', () => {
    const sorted = sortStats(stats);
    expect(sorted[0].chapters_completed).toBeGreaterThanOrEqual(sorted[1].chapters_completed);
    expect(sorted[1].chapters_completed).toBeGreaterThanOrEqual(sorted[2].chapters_completed);
  });

  it('breaks ties with items_completed descending', () => {
    const sorted = sortStats(stats);
    // Both 'a' and 'b' have 5 chapters; 'b' has 30 items so should rank higher
    expect(sorted[0].user_id).toBe('b');
    expect(sorted[1].user_id).toBe('a');
  });

  it('puts zero-progress member last', () => {
    const sorted = sortStats(stats);
    expect(sorted[sorted.length - 1].user_id).toBe('d');
  });
});

// ── Invite redirect param ─────────────────────────────────────────────────────

describe('club invite redirect URL', () => {
  it('encodes the accept path correctly', () => {
    const token = 'abc123xyz';
    const redirectParam = encodeURIComponent(`/clubs/accept/${token}`);
    expect(redirectParam).toBe('%2Fclubs%2Faccept%2Fabc123xyz');
  });

  it('reconstructs login URL with redirect', () => {
    const token = 'abc123xyz';
    const url = `/login?redirect=${encodeURIComponent(`/clubs/accept/${token}`)}`;
    expect(url).toBe('/login?redirect=%2Fclubs%2Faccept%2Fabc123xyz');
  });
});

// ── JWT payload decode (used in ClubReadPage currentUserId) ───────────────────

function decodeJwtSub(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || '';
  } catch { return ''; }
}

describe('JWT sub extraction', () => {
  // Build a fake JWT (header.payload.sig) — only payload matters
  function makeToken(sub: string) {
    const payload = btoa(JSON.stringify({ sub, exp: 9999999999 }));
    return `header.${payload}.signature`;
  }

  it('extracts sub from valid token', () => {
    expect(decodeJwtSub(makeToken('user-uuid-123'))).toBe('user-uuid-123');
  });

  it('returns empty string for malformed token', () => {
    expect(decodeJwtSub('not.a.token')).toBe('');
    expect(decodeJwtSub('')).toBe('');
  });

  it('returns empty string when sub missing', () => {
    const payload = btoa(JSON.stringify({ email: 'x@y.com' }));
    expect(decodeJwtSub(`h.${payload}.s`)).toBe('');
  });
});
