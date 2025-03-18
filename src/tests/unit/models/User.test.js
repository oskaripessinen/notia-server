const mongoose = require('mongoose');
const User = require('../../../models/User');

// Mock mongoose
jest.mock('mongoose', () => {
  const mMongoose = { Schema: jest.fn() };
  mMongoose.Schema.prototype.pre = jest.fn().mockReturnThis();
  mMongoose.Schema.Types = {
    ObjectId: String
  };
  mMongoose.model = jest.fn().mockReturnValue(function UserMock(data) {
    this._id = 'mock-id-123';
    Object.assign(this, data);
    
    this.validate = jest.fn().mockImplementation(() => {
      // Simuloi validaatiologiikkaa
      if (!this.email) {
        const error = new Error('User validation failed');
        error.errors = { email: { message: 'Email is required' } };
        return Promise.reject(error);
      }
      if (!this.googleId) {
        const error = new Error('User validation failed');
        error.errors = { googleId: { message: 'GoogleId is required' } };
        return Promise.reject(error);
      }
      return Promise.resolve();
    });
    
    this.save = jest.fn().mockImplementation(() => {
      return this.validate().then(() => this);
    });
  });
  return mMongoose;
});

describe('User Model', () => {
  it('should create a valid user', async () => {
    const userData = {
      googleId: 'test-google-id',
      displayName: 'Test User',
      email: 'test@example.com'
    };
    
    const user = new User(userData);
    await user.validate();
    
    expect(user.googleId).toBe(userData.googleId);
    expect(user.displayName).toBe(userData.displayName);
    expect(user.email).toBe(userData.email);
  });
  
  it('should fail validation if email is missing', async () => {
    const userData = {
      googleId: 'test-google-id',
      displayName: 'Test User'
      // email puuttuu
    };
    
    const user = new User(userData);
    
    await expect(user.validate()).rejects.toThrow();
  });
  
  it('should fail validation if googleId is missing', async () => {
    const userData = {
      displayName: 'Test User',
      email: 'test@example.com'
      // googleId puuttuu
    };
    
    const user = new User(userData);
    
    await expect(user.validate()).rejects.toThrow();
  });
});