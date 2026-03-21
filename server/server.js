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
import { authenticate, optionalAuth } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8682;

// CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:5177',
    'http://127.0.0.1:5177',
    process.env.CLIENT_URL
  ].filter(Boolean),
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

// Invite acceptance
app.post('/api/invites/accept/:token', optionalAuth, acceptInvite);

// My role on a book
app.get('/api/books/:bookId/my-role', authenticate, getMyRole);

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
