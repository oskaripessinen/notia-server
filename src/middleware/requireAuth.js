const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  // Add detailed logging
  console.log('Authentication check:', { 
    isAuthenticated: req.isAuthenticated ? req.isAuthenticated() : false,
    session: req.session ? Object.keys(req.session) : 'No session',
    hasCookies: !!req.headers.cookie,
    hasAuthHeader: !!req.headers.authorization
  });

  // 1. Check Passport session first
  if (req.isAuthenticated && req.isAuthenticated()) {
    console.log('User authenticated via session:', req.user?._id);
    return next();
  }

  // 2. Check for JWT in cookies
  if (req.headers.cookie && req.headers.cookie.includes('jwt=')) {
    try {
      // Extract JWT from cookie string
      const cookies = req.headers.cookie.split(';').map(c => c.trim());
      const jwtCookie = cookies.find(c => c.startsWith('jwt='));
      if (jwtCookie) {
        const token = jwtCookie.split('=')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        console.log('User authenticated via cookie JWT:', decoded);
        return next();
      }
    } catch (err) {
      console.error('JWT cookie verification failed:', err.message);
      // Continue to next authentication method
    }
  }

  // 3. Check for JWT in Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      console.log('User authenticated via Authorization header');
      return next();
    } catch (err) {
      console.error('JWT header verification failed:', err.message);
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  }

  // If we're accessing a public route or checking auth status, allow it
  const publicPaths = ['/auth/google', '/auth/status', '/auth/login', '/auth/google/callback'];
  if (publicPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  // If we get here, no authentication method succeeded
  console.log('Authentication failed:', { 
    path: req.path,
    method: req.method
  });
  return res.status(401).json({ error: 'Authentication required' });
}

module.exports = requireAuth;
