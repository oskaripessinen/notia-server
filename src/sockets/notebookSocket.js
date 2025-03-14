const Notebook = require('../models/Notebook');
const Note = require('../models/Note');

/**
 * Sets up notebook-related socket event handlers
 * @param {Object} io - Socket.IO server instance
 */
const setupNotebookSockets = (io) => {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    const user = socket.request.user;
    
    if (!user) {
      console.log('Unauthenticated socket connection - disconnecting');
      socket.disconnect(true);
      return;
    }
    
    console.log(`Authenticated user connected: ${user.email}`);
    
    // Handle joining a notebook room
    socket.on('join-notebook', async (notebookId) => {
      try {
        // Check if user has access to the notebook
        const notebook = await Notebook.findOne({
          _id: notebookId,
          users: user._id
        });
        
        if (!notebook) {
          socket.emit('error', { message: 'Access denied to notebook' });
          return;
        }
        
        // Leave any previous notebook rooms
        const rooms = Array.from(socket.rooms);
        rooms.forEach(room => {
          if (room !== socket.id && room.startsWith('notebook:')) {
            socket.leave(room);
          }
        });
        
        // Join the notebook room
        const roomName = `notebook:${notebookId}`;
        socket.join(roomName);
        console.log(`${user.email} joined notebook: ${notebookId}`);
        
        // After joining, fetch the latest notebook data to ensure sync
        // Use a DIFFERENT variable name here to avoid redeclaration
        const fullNotebook = await Notebook.findOne({
          _id: notebookId,
          users: user._id
        }).populate('notes');
        
        // Send the latest state directly to the newly joined user
        socket.emit('notebook-sync', {
          notebook: fullNotebook,
          timestamp: new Date()
        });
        
        // Notify others in the room
        socket.to(roomName).emit('user-joined', {
          userId: user._id,
          email: user.email
        });
        
        // Get all clients in the room
        const clients = await io.in(roomName).fetchSockets();
        const activeUsers = clients.map(client => {
          const clientUser = client.request.user;
          return {
            userId: clientUser._id,
            email: clientUser.email
          };
        });
        
        socket.emit('active-users', activeUsers);
      } catch (error) {
        console.error('Error joining notebook room:', error);
        socket.emit('error', { message: 'Failed to join notebook room' });
      }
    });
    
    // Handle note updates
    socket.on('note-update', async (data) => {
      try {
        const { notebookId, noteId, title, content, lineChanges } = data;
        
        // Check if user has access to this notebook
        const notebook = await Notebook.findOne({
          _id: notebookId,
          users: user._id
        });
        
        if (!notebook) {
          socket.emit('error', { message: 'Access denied to notebook' });
          return;
        }
        
        // Find the note and check if it belongs to this notebook
        const note = await Note.findOne({
          _id: noteId,
          notebook: notebookId
        });
        
        if (!note) {
          socket.emit('error', { message: 'Note not found or does not belong to notebook' });
          return;
        }
        
        // Update the note in the database
        if (title !== undefined) note.title = title;
        if (content !== undefined) note.content = content;
        await note.save();
        
        // Broadcast the update to other users in the room
        const roomName = `notebook:${notebookId}`;
        socket.to(roomName).emit('note-updated', {
          noteId,
          title,
          content,
          lineChanges, // Include specific line changes with line numbers
          updatedBy: {
            userId: user._id,
            email: user.email
          },
          timestamp: new Date()
        });
      } catch (error) {
        console.error('Error handling note update:', error);
        socket.emit('error', { message: 'Failed to update note' });
      }
    });
    
    // Handle cursor position updates
    socket.on('cursor-position', (data) => {
      const { notebookId, noteId, position } = data;
      const roomName = `notebook:${notebookId}`;
      
      // Broadcast cursor position to others in the room
      socket.to(roomName).emit('user-cursor', {
        userId: user._id,
        email: user.email,
        noteId,
        position
      });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${user.email}`);
      
      // Get all rooms this socket was in
      const rooms = Array.from(socket.rooms);
      
      // Notify each notebook room about the user leaving
      rooms.forEach(room => {
        if (room !== socket.id && room.startsWith('notebook:')) {
          io.to(room).emit('user-left', {
            userId: user._id,
            email: user.email
          });
        }
      });
    });
  });
};

module.exports = setupNotebookSockets;