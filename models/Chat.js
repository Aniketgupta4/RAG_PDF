import mongoose from 'mongoose';

const chatSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  documentId: { type: String, required: true },
  title: { type: String, default: 'New Conversation' },
  messages: [{
    role: { type: String, enum: ['user', 'model'] },
    text: String,
    timestamp: { type: Date, default: Date.now }
  }],
  createdAt: { type: Date, default: Date.now }
});

// Model ko export karein taaki server.js isko use kar sake
export default mongoose.model('Chat', chatSchema);