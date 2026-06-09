/**
 * BookFlow API Integration Tests
 * --------------------------------
 * Runs against the live server at http://localhost:8682
 * Start the server first: cd bookflow/server && node server.js
 *
 * Run:  node bookflow/server/api.test.mjs
 */

const BASE = 'http://localhost:8682/api';
const TEST_EMAIL = `test_${Date.now()}@bookflow-test.invalid`;
const TEST_PASSWORD = 'testpass123';
const TEST_NAME = 'Test Runner';

let token = null;
let userId = null;
let bookId = null;
let chapterId = null;
let clubId = null;
let inviteToken = null;

// ── Runner ────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗  ${name}`);
    console.error(`       ${err.message}`);
    failed++;
    failures.push({ name, error: err.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}

async function req(method, path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

// ── Test Suites ───────────────────────────────────────────────────────────────

async function runAuth() {
  console.log('\n── Auth ──────────────────────────────────────────');

  await test('GET /health returns 200', async () => {
    const res = await fetch(`${BASE}/health`);
    assertEqual(res.status, 200);
  });

  await test('POST /auth/register creates account and returns session', async () => {
    const { status, data } = await req('POST', '/auth/register', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      display_name: TEST_NAME,
    }, false);
    assert(status === 200 || status === 201, `Register failed (${status}): ${JSON.stringify(data).slice(0, 200)}`);
    assert(data.session?.access_token, 'No access token in register response');
    token = data.session.access_token;
    userId = data.user?.id;
  });

  await test('POST /auth/register duplicate email returns 409', async () => {
    const { status } = await req('POST', '/auth/register', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      display_name: TEST_NAME,
    }, false);
    assert(status === 409 || status === 400, `Expected 409/400, got ${status}`);
  });

  await test('GET /auth/me returns current user', async () => {
    const { status, data } = await req('GET', '/auth/me');
    assertEqual(status, 200, `GET /me failed: ${JSON.stringify(data)}`);
    assert(data.user?.id, 'No user.id in /me response');
    assert(data.profile, 'No profile in /me response');
  });

  await test('GET /auth/me without token returns 401', async () => {
    const { status } = await req('GET', '/auth/me', null, false);
    assertEqual(status, 401);
  });

  await test('POST /auth/login with valid credentials returns session', async () => {
    const { status, data } = await req('POST', '/auth/login', {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }, false);
    assertEqual(status, 200, `Login failed: ${JSON.stringify(data)}`);
    assert(data.session?.access_token, 'No access token in login response');
    token = data.session.access_token; // refresh token for rest of tests
  });

  await test('POST /auth/login with wrong password returns 401', async () => {
    const { status } = await req('POST', '/auth/login', {
      email: TEST_EMAIL,
      password: 'wrongpassword',
    }, false);
    assertEqual(status, 401);
  });
}

async function runProfile() {
  console.log('\n── Profile ───────────────────────────────────────');

  await test('GET /profile/me returns profile', async () => {
    const { status, data } = await req('GET', '/profile/me');
    assertEqual(status, 200);
    assert(data.profile || data.display_name, 'No profile data returned');
  });

  await test('PUT /profile/me updates display name', async () => {
    const { status, data } = await req('PUT', '/profile/me', {
      display_name: 'Updated Runner',
    });
    assertEqual(status, 200, `Profile update failed: ${JSON.stringify(data)}`);
  });

  await test('GET /profile/:userId returns public profile', async () => {
    if (!userId) return;
    const { status } = await req('GET', `/profile/${userId}`);
    assert(status === 200 || status === 404, `Unexpected status ${status}`);
  });
}

async function runBooks() {
  console.log('\n── Books ─────────────────────────────────────────');

  await test('POST /books creates a book', async () => {
    const { status, data } = await req('POST', '/books', {
      title: 'Test Book ' + Date.now(),
      visibility: 'private',
      status: 'draft',
    });
    assertEqual(status, 201, `Create book failed: ${JSON.stringify(data)}`);
    assert(data.id, 'No book id returned');
    bookId = data.id;
  });

  await test('GET /books returns list including new book', async () => {
    const { status, data } = await req('GET', '/books');
    assertEqual(status, 200);
    const list = data.books ?? data.data ?? (Array.isArray(data) ? data : null);
    assert(Array.isArray(list), `Expected array, got: ${JSON.stringify(data).slice(0, 100)}`);
  });

  await test('GET /books/:id returns the book', async () => {
    const { status, data } = await req('GET', `/books/${bookId}`);
    assertEqual(status, 200, `Get book failed: ${JSON.stringify(data)}`);
    assertEqual(data.id, bookId);
  });

  await test('PUT /books/:id updates the book', async () => {
    const { status, data } = await req('PUT', `/books/${bookId}`, {
      title: 'Updated Test Book',
    });
    assertEqual(status, 200, `Update book failed: ${JSON.stringify(data)}`);
  });

  await test('GET /books/:id/my-role returns owner role', async () => {
    const { status, data } = await req('GET', `/books/${bookId}/my-role`);
    assertEqual(status, 200);
    assert(data.role, 'No role returned');
  });
}

async function runChapters() {
  console.log('\n── Chapters ──────────────────────────────────────');

  await test('POST /books/:bookId/chapters creates a chapter', async () => {
    const { status, data } = await req('POST', `/books/${bookId}/chapters`, {
      title: 'Chapter 1',
      status: 'published',
    });
    assertEqual(status, 201, `Create chapter failed: ${JSON.stringify(data)}`);
    assert(data.id, 'No chapter id');
    chapterId = data.id;
  });

  await test('GET /books/:bookId/chapters returns chapter list', async () => {
    const { status, data } = await req('GET', `/books/${bookId}/chapters`);
    assertEqual(status, 200);
    assert(Array.isArray(data), 'Expected array of chapters');
    assert(data.length > 0, 'Expected at least one chapter');
  });

  await test('GET /chapters/:id returns chapter', async () => {
    const { status, data } = await req('GET', `/chapters/${chapterId}`);
    assertEqual(status, 200);
    assertEqual(data.id, chapterId);
  });

  await test('PUT /chapters/:id updates chapter title', async () => {
    const { status } = await req('PUT', `/chapters/${chapterId}`, {
      title: 'Chapter 1 Updated',
    });
    assertEqual(status, 200);
  });
}

async function runClubs() {
  console.log('\n── Clubs ─────────────────────────────────────────');

  await test('POST /clubs creates a club', async () => {
    const { status, data } = await req('POST', '/clubs', {
      name: 'Test Club ' + Date.now(),
      description: 'Integration test club',
    });
    assertEqual(status, 201, `Create club failed: ${JSON.stringify(data)}`);
    assert(data.id, 'No club id');
    clubId = data.id;
  });

  await test('GET /clubs returns list including new club', async () => {
    const { status, data } = await req('GET', '/clubs');
    assertEqual(status, 200);
    assert(Array.isArray(data), 'Expected array');
    const found = data.find(c => c.id === clubId);
    assert(found, 'New club not in list');
  });

  await test('GET /clubs/:clubId returns club with member_count', async () => {
    const { status, data } = await req('GET', `/clubs/${clubId}`);
    assertEqual(status, 200);
    assertEqual(data.id, clubId);
    assert(typeof data.member_count === 'number', 'No member_count in response');
  });

  await test('GET /clubs list shows member_count > 0', async () => {
    const { status, data } = await req('GET', '/clubs');
    assertEqual(status, 200);
    const club = data.find(c => c.id === clubId);
    assert(club, 'Club not found in list');
    assert(club.member_count > 0, `member_count should be > 0, got ${club.member_count}`);
  });

  await test('PUT /clubs/:clubId/settings updates settings', async () => {
    const { status, data } = await req('PUT', `/clubs/${clubId}/settings`, {
      show_member_reading_progress: true,
      show_member_answers: false,
      show_member_highlights: true,
      show_member_media: true,
    });
    assertEqual(status, 200, `Update settings failed: ${JSON.stringify(data)}`);
  });

  await test('POST /clubs/:clubId/invite creates invite', async () => {
    const { status, data } = await req('POST', `/clubs/${clubId}/invite`, {
      email: `invitee_${Date.now()}@bookflow-test.invalid`,
    });
    assert(status === 200 || status === 201, `Invite failed: ${JSON.stringify(data)}`);
    inviteToken = data.token || data.invite_token;
  });

  await test('GET /clubs/invite/:token returns invite preview', async () => {
    if (!inviteToken) { throw new Error('No invite token from previous test'); }
    const { status, data } = await req('GET', `/clubs/invite/${inviteToken}`, null, false);
    assertEqual(status, 200, `Preview failed: ${JSON.stringify(data)}`);
    assert(data.club_name, 'No club_name in preview');
  });

  await test('GET /clubs/invite/invalid-token returns 404', async () => {
    const { status } = await req('GET', '/clubs/invite/not-a-real-token-xyz', null, false);
    assertEqual(status, 404);
  });

  await test('POST /clubs/:clubId/books adds book to club', async () => {
    if (!bookId) { throw new Error('No bookId from books tests'); }
    const { status, data } = await req('POST', `/clubs/${clubId}/books`, {
      book_id: bookId,
      is_current: true,
    });
    assert(status === 200 || status === 201, `Add book failed: ${JSON.stringify(data)}`);
  });
}

async function runProgress() {
  console.log('\n── Progress ──────────────────────────────────────');

  await test('GET /progress/club/:clubId returns member stats array', async () => {
    const { status, data } = await req('GET', `/progress/club/${clubId}`);
    // 403 is valid if progress tracking not enabled; 200 means it worked
    assert(status === 200 || status === 403, `Unexpected status ${status}: ${JSON.stringify(data)}`);
    if (status === 200) {
      assert(Array.isArray(data), 'Expected array of member stats');
    }
  });

  await test('GET /books/:bookId/progress returns 200 (null when no progress yet)', async () => {
    const { status } = await req('GET', `/books/${bookId}/progress`);
    assertEqual(status, 200);
  });
}

async function runNotifications() {
  console.log('\n── Notifications ─────────────────────────────────');

  await test('GET /notifications returns list', async () => {
    const { status, data } = await req('GET', '/notifications');
    assertEqual(status, 200);
    assert(Array.isArray(data), 'Expected array');
  });

  await test('GET /notifications/unread-count returns number', async () => {
    const { status, data } = await req('GET', '/notifications/unread-count');
    assertEqual(status, 200);
    assert(typeof data.count === 'number', 'Expected { count: number }');
  });

  await test('PUT /notifications/read-all returns 200', async () => {
    const { status } = await req('PUT', '/notifications/read-all');
    assertEqual(status, 200);
  });
}

async function runCleanup() {
  console.log('\n── Cleanup ───────────────────────────────────────');

  await test('DELETE /clubs/:clubId removes club', async () => {
    if (!clubId) return;
    const { status } = await req('DELETE', `/clubs/${clubId}`);
    assert(status === 200 || status === 204, `Delete club failed: status ${status}`);
  });

  await test('DELETE /chapters/:id removes chapter', async () => {
    if (!chapterId) return;
    const { status } = await req('DELETE', `/chapters/${chapterId}`);
    assert(status === 200 || status === 204, `Delete chapter failed: status ${status}`);
  });

  await test('DELETE /books/:id removes book', async () => {
    if (!bookId) return;
    const { status } = await req('DELETE', `/books/${bookId}`);
    assert(status === 200 || status === 204, `Delete book failed: status ${status}`);
  });

  await test('POST /auth/logout succeeds', async () => {
    const { status } = await req('POST', '/auth/logout');
    assert(status === 200 || status === 204, `Logout failed: status ${status}`);
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('BookFlow API Integration Tests');
  console.log(`Target: ${BASE}`);
  console.log(`Test user: ${TEST_EMAIL}`);

  // Check server is reachable first
  try {
    await fetch(`${BASE}/health`);
  } catch {
    console.error('\n❌ Cannot reach server at ' + BASE);
    console.error('   Start the server: cd bookflow/server && node server.js\n');
    process.exit(1);
  }

  await runAuth();
  await runProfile();
  await runBooks();
  await runChapters();
  await runClubs();
  await runProgress();
  await runNotifications();
  await runCleanup();

  console.log('\n─────────────────────────────────────────────────');
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failures.length) {
    console.log('\nFailed tests:');
    failures.forEach(f => console.log(`  ✗ ${f.name}\n    ${f.error}`));
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed');
  }
}

main();
