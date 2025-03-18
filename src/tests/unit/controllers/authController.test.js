const authController = require('../../../controllers/authController');
const User = require('../../../models/User');

// Mock User model
jest.mock('../../../models/User', () => ({
  findOne: jest.fn(),
  create: jest.fn()
}));

describe('Auth Controller', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });
  
  describe('googleCallback', () => {
    it('should return an existing user if found', async () => {
      // Mock user exists
      const mockUser = {
        _id: 'user-id-123',
        googleId: 'google-id-123',
        email: 'test@example.com',
        displayName: 'Test User'
      };
      
      User.findOne.mockResolvedValue(mockUser);
      
      const profile = {
        id: 'google-id-123',
        displayName: 'Test User',
        emails: [{ value: 'test@example.com' }]
      };
      
      const done = jest.fn();
      
      await authController.googleCallback('access-token', 'refresh-token', profile, done);
      
      expect(User.findOne).toHaveBeenCalledWith({ googleId: 'google-id-123' });
      expect(User.create).not.toHaveBeenCalled();
      expect(done).toHaveBeenCalledWith(null, mockUser);
    });
    
    it('should create a new user if not found', async () => {
      // Mock user doesn't exist
      User.findOne.mockResolvedValue(null);
      
      const mockNewUser = {
        _id: 'new-user-id',
        googleId: 'google-id-456',
        email: 'new@example.com',
        displayName: 'New User'
      };
      
      User.create.mockResolvedValue(mockNewUser);
      
      const profile = {
        id: 'google-id-456',
        displayName: 'New User',
        emails: [{ value: 'new@example.com' }]
      };
      
      const done = jest.fn();
      
      await authController.googleCallback('access-token', 'refresh-token', profile, done);
      
      expect(User.findOne).toHaveBeenCalledWith({ googleId: 'google-id-456' });
      expect(User.create).toHaveBeenCalledWith({
        googleId: 'google-id-456',
        displayName: 'New User',
        email: 'new@example.com',
      });
      expect(done).toHaveBeenCalledWith(null, mockNewUser);
    });
    
    it('should handle invalid profile data', async () => {
      const profile = {
        // Missing id and emails
        displayName: 'Invalid User'
      };
      
      const done = jest.fn();
      
      await authController.googleCallback('access-token', 'refresh-token', profile, done);
      
      expect(User.findOne).not.toHaveBeenCalled();
      expect(User.create).not.toHaveBeenCalled();
      expect(done).toHaveBeenCalledWith(expect.any(Error), null);
    });
  });
});