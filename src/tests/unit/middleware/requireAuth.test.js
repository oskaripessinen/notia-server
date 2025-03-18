const requireAuth = require('../../../middleware/requireAuth');

describe('requireAuth Middleware', () => {
  it('should call next() for authenticated users', () => {
    const req = {
      isAuthenticated: jest.fn().mockReturnValue(true),
      user: { _id: 'user-id-1' }
    };
    const res = {};
    const next = jest.fn();
    
    requireAuth(req, res, next);
    
    expect(req.isAuthenticated).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });
  
  it('should allow access to public paths without authentication', () => {
    const req = {
      isAuthenticated: jest.fn().mockReturnValue(false),
      path: '/auth/google',
      method: 'GET'
    };
    const res = {};
    const next = jest.fn();
    
    requireAuth(req, res, next);
    
    expect(next).toHaveBeenCalled();
  });
  
  it('should return 401 for protected paths when not authenticated', () => {
    const req = {
      isAuthenticated: jest.fn().mockReturnValue(false),
      path: '/notebooks',
      method: 'GET'
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();
    
    requireAuth(req, res, next);
    
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Authentication required' });
    expect(next).not.toHaveBeenCalled();
  });
});