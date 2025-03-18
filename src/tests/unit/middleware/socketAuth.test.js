const socketAuth = require('../../../middleware/socketAuth');

// Mock cookie
jest.mock('cookie', () => ({
  parse: jest.fn().mockImplementation((cookieString) => {
    if (cookieString.includes('valid')) {
      return { 'notia.sid': 's:valid-session' };
    }
    return {};
  })
}));

// Mock User model
jest.mock('../../../models/User', () => ({
  findById: jest.fn().mockImplementation((id) => {
    if (id === 'valid-user-id') {
      return Promise.resolve({ 
        _id: 'valid-user-id',
        email: 'test@example.com',
        displayName: 'Test User'
      });
    }
    return Promise.resolve(null);
  })
}));

describe('socketAuth Middleware', () => {
  it('should be a function that returns a middleware function', () => {
    const sessionMiddleware = jest.fn();
    const middleware = socketAuth(sessionMiddleware);
    
    expect(typeof middleware).toBe('function');
  });
  
  it('should reject connection without cookies', async () => {
    const sessionMiddleware = jest.fn();
    const middleware = socketAuth(sessionMiddleware);
    
    const socket = {
      handshake: {
        headers: {}
      }
    };
    
    const next = jest.fn();
    
    await middleware(socket, next);
    
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining('No cookies found')
    }));
  });
  
  it('should apply the session middleware when valid cookie is found', async () => {
    // Mock session middleware to act on mockReq
    const sessionMiddleware = jest.fn((req, res, next) => {
      req.session = {
        passport: {
          user: 'valid-user-id'
        }
      };
      next();
    });
    
    const middleware = socketAuth(sessionMiddleware);
    
    const socket = {
      handshake: {
        headers: {
          cookie: 'notia.sid=valid-session'
        },
        address: '127.0.0.1'
      },
      request: {}
    };
    
    const next = jest.fn();
    
    await middleware(socket, next);
    
    expect(sessionMiddleware).toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(); // Called with no arguments = success
    expect(socket.request.user).toBeDefined();
  });
});