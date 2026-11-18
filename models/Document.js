import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  userId: { 
    type: String, 
    required: true, 
    index: true 
  },
  userEmail: { 
    type: String, 
    default: '' 
  },
  documentId: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  },
  fileName: { 
    type: String, 
    required: true 
  },
  fileSize: { 
    type: Number, 
    default: 0 
  },
  pages: { 
    type: Number, 
    default: 1 
  },
  chunks: { 
    type: Number, 
    default: 0 
  },
  status: { 
    type: String, 
    enum: ['ready', 'processing', 'error'], 
    default: 'ready' 
  },
  scope: { 
    type: String, 
    enum: ['company', 'personal'], 
    default: 'personal', 
    index: true 
  },
  department: { 
    type: String, 
    default: 'All', 
    index: true 
  },
  category: { 
    type: String, 
    default: 'General' 
  },
  description: { 
    type: String, 
    default: '' 
  },
  approved: { 
    type: Boolean, 
    default: true 
  },
  uploadedAt: { 
    type: Date, 
    default: Date.now 
  }
});

export default mongoose.model('Document', documentSchema);
