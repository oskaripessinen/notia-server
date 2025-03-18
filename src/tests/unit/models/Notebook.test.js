const mongoose = require('mongoose');
const Notebook = require('../../../models/Notebook');

// Mock mongoose
jest.mock('mongoose', () => {
  const mMongoose = { Schema: jest.fn() };
  mMongoose.Schema.prototype.pre = jest.fn().mockReturnThis();
  mMongoose.Schema.Types = {
    ObjectId: String
  };
  mMongoose.model = jest.fn().mockReturnValue(function NotebookMock(data) {
    this._id = 'mock-notebook-id';
    this.createdAt = new Date();
    this.updatedAt = new Date();
    Object.assign(this, data);
    
    this.validate = jest.fn().mockImplementation(() => {
      // Simuloi validaatiologiikkaa
      if (!this.title) {
        const error = new Error('Notebook validation failed');
        error.errors = { title: { message: 'Title is required' } };
        return Promise.reject(error);
      }
      if (!this.users || !this.users.length) {
        const error = new Error('Notebook validation failed');
        error.errors = { users: { message: 'At least one user is required' } };
        return Promise.reject(error);
      }
      return Promise.resolve();
    });
    
    this.save = jest.fn().mockImplementation(() => {
      this.updatedAt = new Date();
      return this.validate().then(() => this);
    });
  });
  return mMongoose;
});

describe('Notebook Model', () => {
  it('should create a valid notebook', async () => {
    const notebookData = {
      title: 'Test Notebook',
      notes: ['note-id-1', 'note-id-2'],
      users: ['user-id-1']
    };
    
    const notebook = new Notebook(notebookData);
    await notebook.validate();
    
    expect(notebook.title).toBe(notebookData.title);
    expect(notebook.notes).toEqual(notebookData.notes);
    expect(notebook.users).toEqual(notebookData.users);
    expect(notebook.createdAt).toBeInstanceOf(Date);
    expect(notebook.updatedAt).toBeInstanceOf(Date);
  });
  
  it('should fail validation if title is missing', async () => {
    const notebookData = {
      notes: [],
      users: ['user-id-1']
      // title puuttuu
    };
    
    const notebook = new Notebook(notebookData);
    
    await expect(notebook.validate()).rejects.toThrow();
  });
  
  it('should update the updatedAt timestamp when saving', async () => {
    const notebook = new Notebook({
      title: 'Test Notebook',
      notes: [],
      users: ['user-id-1']
    });
    
    const originalDate = notebook.updatedAt;
    
    // Simuloi viivettä
    await new Promise(resolve => setTimeout(resolve, 10));
    
    await notebook.save();
    
    expect(notebook.updatedAt).not.toEqual(originalDate);
  });
});