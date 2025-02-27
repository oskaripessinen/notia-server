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
      users: [req.user._id]  // Assign the notebook only to the current user
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

// DELETE /notebooks/:id - Delete a notebook (and optionally its notes) for the authenticated user
router.delete('/:id', async (req, res) => {
  try {
    const notebook = await Notebook.findOneAndDelete({ _id: req.params.id, users: req.user._id });
    if (!notebook) return res.status(404).json({ error: 'Notebook not found.' });

    // Optionally, delete all notes referenced by this notebook:
    if (notebook.notes && notebook.notes.length > 0) {
      await Note.deleteMany({ _id: { $in: notebook.notes } });
    }
    const io = req.app.get('io');
    if (io) io.emit('notebooksUpdated', { action: 'delete', notebookId: notebook._id });
    res.json({ message: 'Notebook and its notes deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    // Create the new note
    const newNote = new Note({
      title: req.body.title || 'Untitled',
      content: req.body.content || [''],
      notebook: notebook._id,
      user: req.user._id
    });

    // Save the new note
    await newNote.save();

    // Add note reference to the notebook
    notebook.notes.push(newNote._id);
    await notebook.save();

    // Return the created note
    const populatedNote = await Note.findById(newNote._id);

    // Emit socket event if needed
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
    // Log the request for debugging
    console.log('Update note request:', {
      notebookId: req.params.id,
      noteId: req.params.noteId,
      body: req.body
    });

    // First find the notebook
    const notebook = await Notebook.findById(req.params.id);
    if (!notebook) {
      return res.status(404).json({ error: 'Notebook not found' });
    }

    // Check if the user has access to this notebook
    if (!notebook.users.includes(req.user._id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Find and update the note
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

    // Remove the note's ObjectId from the notebook's notes array
    notebook.notes = notebook.notes.filter(nId => nId.toString() !== req.params.noteId);
    await notebook.save();

    // Optionally delete the note document itself:
    const note = await Note.findOneAndDelete({ _id: req.params.noteId });

    const io = req.app.get('io');
    if (io) io.emit('notebooksUpdated', { action: 'removeNote', notebookId: notebook._id, noteId: req.params.noteId });
    res.json({ message: 'Note removed from notebook', note });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;