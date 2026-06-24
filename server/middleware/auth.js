import supabase from '../config/supabase.js';
import { createHash } from 'crypto';

function sha256(str) {
  return createHash('sha256').update(str).digest('hex');
}

/**
 * Check if a user ID belongs to a super_admin.
 * Uses service-role client so it always bypasses RLS.
 */
async function isSuperAdmin(userId) {
  const { data } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', userId)
    .single();
  return data?.system_role === 'super_admin';
}

/**
 * Authentication middleware - requires valid Supabase auth token
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

/**
 * Optional authentication - continues even without token
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    req.user = error ? null : user;
    req.token = token;
  } catch (err) {
    req.user = null;
  }

  next();
}

/**
 * Author-only middleware - requires user to be book owner OR accepted author-collaborator.
 * Kept for backwards compatibility; prefer requireRole(['owner', 'author']) for new routes.
 */
export async function requireAuthor(req, res, next) {
  return requireRole(['owner', 'author'])(req, res, next);
}

/**
 * Super-admin guard — requires the authenticated user to have system_role = 'super_admin'.
 */
export async function requireSuperAdmin(req, res, next) {
  try {
    if (await isSuperAdmin(req.user.id)) {
      req.userRole = 'super_admin';
      return next();
    }
    return res.status(403).json({ error: 'Super admin access required' });
  } catch (err) {
    console.error('Super admin check error:', err);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

/**
 * Role-based middleware factory — requires user to be book owner OR a collaborator
 * with one of the specified roles.
 *
 * Super admins automatically bypass all book-level role checks and receive
 * req.userRole = 'super_admin'.
 *
 * Usage:  requireRole(['owner', 'author', 'editor'])
 *
 * Sets req.book and req.userRole on success.
 */
export function requireRole(allowedRoles) {
  return async (req, res, next) => {
    const bookId = req.params.bookId || req.params.id || req.body.book_id;

    if (!bookId) {
      return res.status(400).json({ error: 'Book ID required' });
    }

    try {
      // Super admins bypass all book-level role checks
      if (await isSuperAdmin(req.user.id)) {
        const { data: book } = await supabase
          .from('books')
          .select('id, author_id, status, visibility, slug, share_token, review_status')
          .eq('id', bookId)
          .single();
        req.book = book;
        req.userRole = 'super_admin';
        return next();
      }

      const { data: book, error } = await supabase
        .from('books')
        .select('id, author_id, status, visibility, slug, share_token, review_status')
        .eq('id', bookId)
        .single();

      if (error || !book) {
        return res.status(404).json({ error: 'Book not found' });
      }

      // Book owner always maps to 'owner' role
      if (book.author_id === req.user.id) {
        if (!allowedRoles.includes('owner')) {
          return res.status(403).json({ error: 'Not authorized for this action' });
        }
        req.book = book;
        req.userRole = 'owner';
        return next();
      }

      // Check collaborator role
      const { data: collab } = await supabase
        .from('book_collaborators')
        .select('role, invite_accepted_at')
        .eq('book_id', bookId)
        .eq('user_id', req.user.id)
        .single();

      if (!collab || !collab.invite_accepted_at) {
        return res.status(403).json({ error: 'Not a collaborator on this book' });
      }

      if (!allowedRoles.includes(collab.role)) {
        return res.status(403).json({ error: `Requires one of: ${allowedRoles.join(', ')}` });
      }

      req.book = book;
      req.userRole = collab.role;
      next();
    } catch (err) {
      console.error('Role check error:', err);
      return res.status(500).json({ error: 'Authorization check failed' });
    }
  };
}

/**
 * Dual auth middleware — accepts either X-API-Key header or Bearer JWT.
 * API keys are stored as SHA-256 hashes in the api_keys table.
 */
export async function authenticateAny(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (apiKey) {
    try {
      const hash = sha256(apiKey);
      const { data } = await supabase
        .from('api_keys')
        .select('user_id')
        .eq('key_hash', hash)
        .maybeSingle();
      if (!data) return res.status(401).json({ error: 'Invalid API key' });
      req.user = { id: data.user_id };
      // fire-and-forget
      supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('key_hash', hash);
      return next();
    } catch (err) {
      console.error('API key auth error:', err);
      return res.status(401).json({ error: 'Authentication failed' });
    }
  }
  return authenticate(req, res, next);
}

export default { authenticate, optionalAuth, requireAuthor, requireRole, requireSuperAdmin, authenticateAny };
