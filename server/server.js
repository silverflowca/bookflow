import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth.js';
import booksRoutes from './routes/books.js';
import chaptersRoutes from './routes/chapters.js';
import inlineContentRoutes from './routes/inline-content.js';
import filesRoutes from './routes/files.js';
import changesRoutes from './routes/changes.js';
import settingsRoutes from './routes/settings.js';
import ttsRoutes from './routes/tts.js';
import collaboratorsRoutes, { acceptInvite, getMyRole } from './routes/collaborators.js';
import versionsRoutes from './routes/versions.js';
import commentsRouter from './routes/comments.js';
import reviewsRoutes from './routes/reviews.js';
import notificationsRoutes from './routes/notifications.js';
import publishRoutes from './routes/publish.js';
import exportsRoutes from './routes/exports.js';
import publishersRoutes from './routes/publishers.js';
import clubsRoutes from './routes/clubs.js';
import clubChatRoutes from './routes/club-chat.js';
import activityRoutes from './routes/activity.js';
import formResponsesRoutes from './routes/form-responses.js';
import progressRoutes from './routes/progress.js';
import ratingsRoutes from './routes/ratings.js';
import liveRoutes from './routes/live.js';
import profileRoutes from './routes/profile.js';
import adminRoutes from './routes/admin.js';
import feedbackRoutes from './routes/feedback.js';
import savedBooksRoutes from './routes/saved-books.js';
import bookLandingRoutes from './routes/book-landing.js';
import { authenticate, optionalAuth } from './middleware/auth.js';
import { startStatusCron } from './services/chat-status.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8682;

// CORS configuration
const allowedOrigins = [
  'http://localhost:5177',
  'http://127.0.0.1:5177',
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',').map(s => s.trim()) : []),
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'bookflow-api',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/books', booksRoutes);
app.use('/api', chaptersRoutes);
app.use('/api', inlineContentRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/changes', changesRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/tts', ttsRoutes);

// Collaboration routes
app.use('/api/books/:bookId/collaborators', collaboratorsRoutes);
app.use('/api/books/:bookId/versions', versionsRoutes);
app.use('/api/chapters/:chapterId/comments', commentsRouter);
app.use('/api/books/:bookId/reviews', reviewsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/books/:bookId', publishRoutes);
app.use('/api/public', publishRoutes);
app.use('/api/books', exportsRoutes);
app.use('/api/books', publishersRoutes);
app.use('/api/clubs', clubsRoutes);
app.use('/api/clubs/:clubId/chat', clubChatRoutes);
app.use('/api/clubs/chat', clubChatRoutes);  // for /unread-all (no clubId)
app.use('/api/books/:bookId/activity', activityRoutes);
app.use('/api', formResponsesRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api', ratingsRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/saved-books', savedBooksRoutes);
app.use('/api/book-landing', bookLandingRoutes);
app.use('/api/bl', bookLandingRoutes); // short alias: /bl/:slug

// Invite acceptance
app.post('/api/invites/accept/:token', optionalAuth, acceptInvite);

// My role on a book
app.get('/api/books/:bookId/my-role', authenticate, getMyRole);

// ── OG preview for social crawlers on /book/:id ─────────────────────────────
// WhatsApp, Facebook, Twitter etc. send a specific User-Agent — detect them
// and return a lightweight HTML page with Open Graph meta tags so the link
// unfurls with cover image + title.  Regular browsers get the SPA as usual.
const CRAWLER_UA = /whatsapp|facebookexternalhit|twitterbot|linkedinbot|slackbot|telegrambot|discordbot|googlebot|bingbot/i;

app.get('/book/:bookId', async (req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  if (!CRAWLER_UA.test(ua)) return next(); // regular browser → serve SPA below

  try {
    const { data: book, error } = await supabase
      .from('books')
      .select('title, subtitle, description, cover_image_url, visibility, author:profiles!books_author_id_fkey(display_name)')
      .eq('id', req.params.bookId)
      .single();

    if (error || !book || book.visibility !== 'public') return next();

    const siteUrl = process.env.CLIENT_URL?.split(',')[0]?.trim() || `https://books.silverflow.ca`;
    const pageUrl = `${siteUrl}/book/${req.params.bookId}`;
    const title = book.title + (book.subtitle ? ` — ${book.subtitle}` : '');
    const description = book.description || `A book by ${book.author?.display_name || 'an author'} on BookFlow.`;
    const image = book.cover_image_url || '';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(description)}" />

  <!-- Open Graph -->
  <meta property="og:type"        content="book" />
  <meta property="og:url"         content="${escHtml(pageUrl)}" />
  <meta property="og:title"       content="${escHtml(title)}" />
  <meta property="og:description" content="${escHtml(description)}" />
  ${image ? `<meta property="og:image" content="${escHtml(image)}" />
  <meta property="og:image:width"  content="800" />
  <meta property="og:image:height" content="1200" />` : ''}

  <!-- Twitter card -->
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${escHtml(title)}" />
  <meta name="twitter:description" content="${escHtml(description)}" />
  ${image ? `<meta name="twitter:image" content="${escHtml(image)}" />` : ''}

  <!-- Redirect browsers that somehow land here -->
  <meta http-equiv="refresh" content="0;url=${escHtml(pageUrl)}" />
</head>
<body>
  <script>location.replace(${JSON.stringify(pageUrl)});</script>
</body>
</html>`);
  } catch (err) {
    console.error('[og-preview] error:', err.message);
    next();
  }
});

function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const publicPath = path.join(__dirname, 'public');
  app.use(express.static(publicPath));

  // Handle client-side routing - serve index.html for non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(path.join(publicPath, 'index.html'));
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start chat status cron jobs
startStatusCron().catch(err => console.error('Failed to start status cron:', err.message));

// Start server
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║   📚 BookFlow API Server                                  ║
║                                                           ║
║   Server running on http://localhost:${PORT}               ║
║   Health check: http://localhost:${PORT}/api/health        ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
