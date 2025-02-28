const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/requireAuth');
const Note = require('../models/Note'); 

// All routes here require a valid JWT token
router.use(requireAuth);

// GET /notes - Get all notes for the authenticated user
router.get('/', async (req, res) => {
  try {
    const notes = await Note.find({ user: req.user._id });
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /notes - Create a new note
router.post('/', async (req, res) => {
  try {
    const note = new Note({ ...req.body, user: req.user._id });
    await note.save();


    const io = req.app.get('io');
    if (io) io.emit('notesUpdated', { action: 'create', note });

    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /notes/:id - Update an existing note
router.put('/:id', async (req, res) => {
  try {
    const note = await Note.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      req.body,
      { new: true }
    );
    if (!note) return res.status(404).json({ error: 'Note not found.' });

    const io = req.app.get('io');
    if (io) io.emit('notesUpdated', { action: 'update', note });

    res.json(note);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /notes/:id - Delete a note
router.delete('/:id', async (req, res) => {
  try {
    const note = await Note.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!note) return res.status(404).json({ error: 'Note not found.' });

    const io = req.app.get('io');
    if (io) io.emit('notesDeleted', note);

    res.json({ message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
