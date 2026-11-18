import mongoose from 'mongoose';

const taxonomySchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['department', 'role', 'category'],
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  label: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  isSystem: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound unique index on type + name
taxonomySchema.index({ type: 1, name: 1 }, { unique: true });

export default mongoose.model('Taxonomy', taxonomySchema);
