import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  documentId: { type: String, required: true, index: true },
  title: { type: String, default: 'New Conversation' },
  messages: [{
    role: { type: String, enum: ['user', 'model'] },
    text: { type: String, required: true },
    sources: [{
      score: Number,
      fileName: String,
      chunkIndex: Number,
      text: String
    }],
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now, index: true }
});

export default mongoose.model('Chat', chatSchema);
