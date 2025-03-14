const cookie = require('cookie');
const User = require('../models/User');

/**
 * Socket.IO middleware to authenticate users using HTTP-only cookies
 */
const socketAuth = (sessionMiddleware) => async (socket, next) => {
  try {
    // Parse cookies from handshake headers
    if (!socket.handshake.headers.cookie) {
      console.log('No cookies found in socket handshake');
      return next(new Error('No cookies found'));
    }
    
    const parsedCookie = cookie.parse(socket.handshake.headers.cookie);
    console.log('Parsed cookies:', Object.keys(parsedCookie));
    
    // Create a properly structured mock request
    const mockReq = {
      headers: {
        cookie: socket.handshake.headers.cookie
      },
      url: '/socket.io/', // Add this missing property
      method: 'GET',
      connection: {
        remoteAddress: socket.handshake.address
      },
      // These properties are needed by express-session
      secure: socket.handshake.secure,
      path: '/',
      originalUrl: '/socket.io/'
    };
    
    const mockRes = {
      setHeader: () => {},
      getHeader: () => {},
      on: () => {},
      once: () => {},
      emit: () => {},
      end: () => {},
      write: () => {},
      writeHead: () => {}
    };
    
    sessionMiddleware(mockReq, mockRes, async () => {
      try {
        // First try passport auth method
        if (mockReq.session?.passport?.user) {
          const userId = mockReq.session.passport.user;
          console.log('Found passport user ID:', userId);
          
          const user = await User.findById(userId);
          if (!user) {
            console.log('User not found in database');
            return next(new Error('User not found'));
          }
          
          console.log('Socket authenticated for user:', user.email);
          socket.request.user = user;
          socket.request.session = mockReq.session;
          return next();
        }
        
        // Try direct userId method as fallback
        if (mockReq.session?.userId) {
          const user = await User.findById(mockReq.session.userId);
          if (user) {
            console.log('Socket auth via userId:', user.email);
            socket.request.user = user;
            socket.request.session = mockReq.session;
            return next();
          }
        }
        
        console.log('Session found but no user ID:', mockReq.session);
        next(new Error('No user found in session'));
      } catch (dbError) {
        console.error('Database error in socket auth:', dbError);
        next(new Error('Database error'));
      }
    });
  } catch (error) {
    console.error('Socket authentication error:', error);
    next(new Error('Authentication error: ' + error.message));
  }
};

module.exports = socketAuth;