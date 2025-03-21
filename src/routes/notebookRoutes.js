const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const Notebook = require('../models/Notebook');
const Note = require('../models/Note');

// All routes here require a valid JWT token (or session) so that req.user is set
router.use(requireAuth);

// GET /notebooks - Get all notebooks for the authenticated user
router.get('/', async (req, res) => {
  try {
    // Only return notebooks that include the current user's id
    const notebooks = await Notebook.find({ users: req.user._id }).populate('notes');
    res.json(notebooks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /notebooks - Create a new notebook for the authenticated user
router.post('/', async (req, res) => {
  try {
    const newNotebook = new Notebook({
      title: req.body.title || 'Untitled',
      notes: [],
      users: [req.user._id] 
    });
    await newNotebook.save();

    const io = req.app.get('io');
    if (io) io.emit('notebooksUpdated', { action: 'create', notebook: newNotebook });
    res.status(201).json(newNotebook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /notebooks/:id - Update notebook details (e.g. title) for the authenticated user
router.put('/:id', async (req, res) => {
  try {
    const notebook = await Notebook.findOneAndUpdate(
      { _id: req.params.id, users: req.user._id },
      { title: req.body.title },
      { new: true }
    );
    if (!notebook) return res.status(404).json({ error: 'Notebook not found.' });

    const io = req.app.get('io');
    if (io) io.emit('notebooksUpdated', { action: 'update', notebook });
    res.json(notebook);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    // Check if notebook exists and user has access
    const notebook = await Notebook.findOne({ _id: id, users: userId });
    if (!notebook) {
      return res.status(404).json({ error: 'Notebook not found or access denied' });
    }

    // Delete all notes associated with the notebook
    await Note.deleteMany({ notebook: id });

    // Delete the notebook
    await Notebook.findByIdAndDelete(id);

    res.status(200).json({ message: 'Notebook deleted successfully' });
  } catch (error) {
    console.error('Error deleting notebook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /notebooks/:id/notes - Add a new note to a notebook
router.post('/:id/notes', async (req, res) => {
  try {
    const notebook = await Notebook.findOne({ 
      _id: req.params.id, 
      users: req.user._id 
    });
    
    if (!notebook) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    const newNote = new Note({
      title: req.body.title || 'Untitled',
      content: req.body.content || [''],
      notebook: notebook._id,
      user: req.user._id
    });

    await newNote.save();

    // Add note reference to the notebook
    notebook.notes.push(newNote._id);
    await notebook.save();

    const populatedNote = await Note.findById(newNote._id);

    
    const io = req.app.get('io');
    if (io) {
      io.emit('notebooksUpdated', { 
        action: 'addNote', 
        notebookId: notebook._id, 
        note: populatedNote 
      });
    }

    res.status(201).json(populatedNote);
  } catch (err) {
    console.error('Error creating note:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /notebooks/:id/notes/:noteId - Update a note
router.put('/:id/notes/:noteId', async (req, res) => {
  try {
  
    console.log('Update note request:', {
      notebookId: req.params.id,
      noteId: req.params.noteId,
      body: req.body
    });

    const notebook = await Notebook.findById(req.params.id);
    if (!notebook) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

  
    if (!notebook.users.includes(req.user._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

   
    const note = await Note.findOneAndUpdate(
      {
        _id: req.params.noteId,
        notebook: req.params.id
      },
      {
        title: req.body.title,
        content: req.body.content
      },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // After successful update, emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`notebook:${req.params.id}`).emit('note-updated', {
        noteId: req.params.noteId,
        title: req.body.title,
        content: req.body.content,
        updatedBy: {
          userId: req.user._id,
          email: req.user.email
        },
        timestamp: new Date()
      });
    }

    res.json(note);
  } catch (err) {
    console.error('Error updating note:', err);
    res.status(500).json({ 
      error: err.message,
      stack: err.stack
    });
  }
});

// DELETE /notebooks/:id/notes/:noteId - Remove a note from a notebook for the authenticated user
router.delete('/:id/notes/:noteId', async (req, res) => {
  try {
    const notebook = await Notebook.findOne({ _id: req.params.id, users: req.user._id });
    if (!notebook) return res.status(404).json({ error: 'Notebook not found.' });


    notebook.notes = notebook.notes.filter(nId => nId.toString() !== req.params.noteId);
    await notebook.save();

   
    const note = await Note.findOneAndDelete({ _id: req.params.noteId });

    const io = req.app.get('io');
    if (io) io.emit('notebooksUpdated', { action: 'removeNote', notebookId: notebook._id, noteId: req.params.noteId });
    res.json({ message: 'Note removed from notebook', note });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add a new endpoint for sharing notebooks
router.post('/:notebookId/share', requireAuth, async (req, res) => {
  try {
    const { notebookId } = req.params;
    const { emails } = req.body;
    
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ message: 'Invalid emails provided' });
    }
    
    // Find the notebook
    const notebook = await Notebook.findById(notebookId);
    
    if (!notebook) {
      return res.status(404).json({ message: 'Notebook not found' });
    }
    
    // Check if the current user has access to this notebook
    if (!notebook.users.includes(req.user._id)) {
      return res.status(403).json({ message: 'You do not have permission to share this notebook' });
    }
    
    // Find existing users by email
    const User = require('../models/User');
    const userPromises = emails.map(async (email) => {
      const user = await User.findOne({ email: email});
      
      if (!user) {
        return { email, found: false };
      }
      
      return { user, email, found: true };
    });
    
    const results = await Promise.all(userPromises);
    
    // Filter out found users and add them to the notebook
    const foundUsers = results.filter(result => result.found).map(result => result.user);
    const notFoundEmails = results.filter(result => !result.found).map(result => result.email);
    
    // Add the new users to the notebook (prevent duplicates with Set)
    const currentUserIds = notebook.users.map(id => id.toString());
    const newUserIds = foundUsers.map(user => user._id.toString());
    const combinedUserIds = [...new Set([...currentUserIds, ...newUserIds])];
    
    // Update the notebook with the new users
    notebook.users = combinedUserIds;
    await notebook.save();
    
    // After successful share operation
    const io = req.app.get('io');
    if (io) {
      // Notify all users who have access to this notebook
      io.to(`notebook:${notebookId}`).emit('notebook-shared', {
        notebookId,
        sharedWith: emails,
        sharedBy: req.user.email,
        timestamp: new Date()
      });
    }
    
    // Return response with results
    res.status(200).json({
      success: true,
      message: 'Notebook shared successfully',
      notebook: {
        _id: notebook._id,
        title: notebook.title,
        users: combinedUserIds
      },
      notFoundEmails: notFoundEmails
    });
    
  } catch (error) {
    console.error('Error sharing notebook:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add endpoint for removing users from a shared notebook
router.delete('/:notebookId/share/:userId', requireAuth, async (req, res) => {
  try {
    const { notebookId, userId } = req.params;
    
    // Find the notebook
    const notebook = await Notebook.findById(notebookId);
    
    if (!notebook) {
      return res.status(404).json({ message: 'Notebook not found' });
    }
    
    // Check if the current user has access to this notebook
    if (!notebook.users.includes(req.user._id)) {
      return res.status(403).json({ message: 'You do not have permission to modify sharing for this notebook' });
    }
    
    // Remove the user from the notebook's users array
    notebook.users = notebook.users.filter(id => id.toString() !== userId);
    await notebook.save();
    
    res.status(200).json({
      success: true,
      message: 'User removed from shared notebook',
      notebook: {
        _id: notebook._id,
        title: notebook.title,
        users: notebook.users
      }
    });
    
  } catch (error) {
    console.error('Error removing user from shared notebook:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;