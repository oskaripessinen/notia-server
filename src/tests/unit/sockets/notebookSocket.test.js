const setupNotebookSockets = require('../../../sockets/notebookSocket');
const Notebook = require('../../../models/Notebook');
const Note = require('../../../models/Note');

// Mock models
jest.mock('../../../models/Notebook');
jest.mock('../../../models/Note');

describe('Notebook Socket Handler', () => {
  let io, socket, mockIoOn;

  beforeEach(() => {
    jest.clearAllMocks();

   
    mockIoOn = jest.fn();
    io = {
      on: mockIoOn, 
      to: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(), 
      emit: jest.fn(),
      fetchSockets: jest.fn().mockResolvedValue([]) 
    };

    // Mock socket with authenticated user
    socket = {
      join: jest.fn(),
      leave: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(), 
      request: {
        user: {
          _id: 'user-id-123',
          email: 'test@example.com'
        }
      },
      rooms: new Set()
    };

    // Apply socket handlers
    setupNotebookSockets(io);
  });

  it('should register event handlers on connection', () => {
    // Simulate connection event
    const connectionHandler = mockIoOn.mock.calls.find(call => call[0] === 'connection')[1];
    connectionHandler(socket);

    expect(io.on).toHaveBeenCalledWith('connection', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('join-notebook', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('note-update', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('cursor-position', expect.any(Function));
    expect(socket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
  });

  it('should handle join-notebook event with valid notebook', async () => {
    // Extract handler function
    const connectionHandler = mockIoOn.mock.calls.find(call => call[0] === 'connection')[1];
    connectionHandler(socket);
    const joinHandler = socket.on.mock.calls.find(call => call[0] === 'join-notebook')[1];

    // Mock notebook
    const mockNotebook = {
      _id: 'notebook-id-123',
      title: 'Test Notebook',
      users: ['user-id-123'],
      notes: ['note-id-123']
    };

    // Setup mock response
    Notebook.findOne = jest.fn().mockImplementation(() => ({
      populate: jest.fn().mockResolvedValue(mockNotebook)
    }));

    // Call handler
    await joinHandler('notebook-id-123');

    // Verify behavior
    expect(Notebook.findOne).toHaveBeenCalledWith({ 
      _id: 'notebook-id-123', 
      users: 'user-id-123' 
    });
    expect(socket.join).toHaveBeenCalledWith('notebook:notebook-id-123');
    
    expect(socket.emit).toHaveBeenCalledWith(
      'notebook-sync',
      expect.objectContaining({ 
        notebook: mockNotebook,
      })
    );
  });

  it('should handle note-update event with valid data', async () => {
    // Extract handler function
    const connectionHandler = mockIoOn.mock.calls.find(call => call[0] === 'connection')[1];
    connectionHandler(socket);
    const updateHandler = socket.on.mock.calls.find(call => call[0] === 'note-update')[1];

    // Mock data and response
    const updateData = {
      notebookId: 'notebook-id-123',
      noteId: 'note-id-123',
      title: 'Updated Title',
      content: ['Updated content']
    };

    // Mock notebook access check
    Notebook.findOne.mockResolvedValue({
      _id: 'notebook-id-123',
      title: 'Test Notebook',
      users: ['user-id-123']
    });

    const mockNote = {
      _id: 'note-id-123',
      title: 'Original Title',
      content: ['Original Content'],
      notebook: 'notebook-id-123',
      save: jest.fn().mockResolvedValue({
        _id: 'note-id-123',
        title: 'Updated Title',
        content: ['Updated content']
      })
    };

    const findByIdSpy = jest.spyOn(Note, 'findById').mockResolvedValue(mockNote);

    // Call handler
    await updateHandler(updateData);

    // Verify behavior
    expect(Notebook.findOne).toHaveBeenCalledWith({ 
      _id: 'notebook-id-123', 
      users: 'user-id-123' 
    });
    

    expect(findByIdSpy).toHaveBeenCalledWith('note-id-123');
    
    expect(mockNote.title).toBe('Updated Title');
    expect(mockNote.content).toEqual(['Updated content']);
    expect(mockNote.save).toHaveBeenCalled();
    expect(io.to).toHaveBeenCalledWith('notebook:notebook-id-123');
    expect(io.emit).toHaveBeenCalledWith('note-updated', expect.objectContaining({
      noteId: 'note-id-123',
      title: 'Updated Title',
      content: ['Updated content']
    }));
  });
});