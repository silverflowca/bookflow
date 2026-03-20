import supabase from '../config/supabase.js';

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
 * Author-only middleware - requires user to be book author
 */
export async function requireAuthor(req, res, next) {
  const bookId = req.params.bookId || req.params.id || req.body.book_id;

  if (!bookId) {
    return res.status(400).json({ error: 'Book ID required' });
  }

  try {
    const { data: book, error } = await supabase
      .from('books')
      .select('author_id')
      .eq('id', bookId)
      .single();

    if (error || !book) {
      return res.status(404).json({ error: 'Book not found' });
    }

    if (book.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized - author only' });
    }

    req.book = book;
    next();
  } catch (err) {
    console.error('Author check error:', err);
    return res.status(500).json({ error: 'Authorization check failed' });
  }
}

/**
 * Role-based middleware factory — requires user to be book owner OR a collaborator
 * with one of the specified roles.
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

export default { authenticate, optionalAuth, requireAuthor, requireRole };
