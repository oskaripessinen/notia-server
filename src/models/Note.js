const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true, // Let MongoDB generate this
    required: true
  },
  title: {
    type: String,
    default: 'Untitled',
    trim: true
  },
  content: [String],
  notebook: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notebook',
    required: true,
    index: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Add indexes for better query performance
noteSchema.index({ notebook: 1, user: 1 });

module.exports = mongoose.model('Note', noteSchema);