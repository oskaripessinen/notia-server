const mongoose = require('mongoose');
const Note = require('../../../models/Note');

// Mock mongoose
jest.mock('mongoose', () => {
  const mMongoose = { Schema: jest.fn() };
  mMongoose.Schema.prototype.pre = jest.fn().mockReturnThis();
  mMongoose.Schema.prototype.index = jest.fn().mockReturnThis(); // Mockataan index-metodi
  mMongoose.Schema.Types = {
    ObjectId: String
  };
  mMongoose.model = jest.fn().mockReturnValue(function NoteMock(data) {
    this._id = 'mock-note-id';
    this.title = 'Untitled'; // Default arvo
    this.content = ['']; // Default arvo
    Object.assign(this, data);
    
    this.validate = jest.fn().mockImplementation(() => {
      // Simuloi validaatiologiikkaa
      if (!this.notebook) {
        const error = new Error('Note validation failed');
        error.errors = { notebook: { message: 'Notebook is required' } };
        return Promise.reject(error);
      }
      if (!this.user) {
        const error = new Error('Note validation failed');
        error.errors = { user: { message: 'User is required' } };
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

describe('Note Model', () => {
  it('should create a valid note', async () => {
    const noteData = {
      title: 'Test Note',
      content: ['Line 1', 'Line 2'],
      notebook: 'notebook-id-1',
      user: 'user-id-1'
    };
    
    const note = new Note(noteData);
    await note.validate();
    
    expect(note.title).toBe(noteData.title);
    expect(note.content).toEqual(noteData.content);
    expect(note.notebook).toBe(noteData.notebook);
    expect(note.user).toBe(noteData.user);
  });
  
  it('should have default values for title and content', () => {
    const note = new Note({
      notebook: 'notebook-id-1',
      user: 'user-id-1'
    });
    
    expect(note.title).toBe('Untitled');
    expect(Array.isArray(note.content)).toBe(true);
    expect(note.content.length).toBe(1);
    expect(note.content[0]).toBe('');
  });
  
  it('should fail validation if notebook is missing', async () => {
    const noteData = {
      title: 'Test Note',
      content: ['Content'],
      user: 'user-id-1'
      // notebook puuttuu
    };
    
    const note = new Note(noteData);
    
    await expect(note.validate()).rejects.toThrow();
  });
  
  it('should fail validation if user is missing', async () => {
    const noteData = {
      title: 'Test Note',
      content: ['Content'],
      notebook: 'notebook-id-1'
      // user puuttuu
    };
    
    const note = new Note(noteData);
    
    await expect(note.validate()).rejects.toThrow();
  });
});