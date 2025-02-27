const mongoose = require('mongoose');

const notebookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  // Viite muistiinpanoihin (Note-malliin)
  notes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Note' }],
  // Viite käyttäjiin (User-malliin)
  users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Päivitetään updatedAt ennen tallennusta
notebookSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Notebook', notebookSchema);