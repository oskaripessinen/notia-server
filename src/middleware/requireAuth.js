const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  // Log authentication status
  console.log('Authentication check:', { 
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    session: req.session ? Object.keys(req.session) : 'No session'
  });

  // Check Passport session authentication
  if (req.isAuthenticated && req.isAuthenticated()) {
    console.log('User authenticated via session:', req.user?._id);
    return next();
  }

  // If we're accessing a public route or checking auth status, allow it
  const publicPaths = ['/auth/google', '/auth/status', '/auth/login', '/auth/google/callback'];
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // Authentication failed
  console.log('Authentication failed:', { 
    path: req.path,
    method: req.method
  });
  return res.status(401).json({ error: 'Authentication required' });
}

module.exports = requireAuth;
