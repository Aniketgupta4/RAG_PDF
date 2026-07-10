import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import { mkdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';
import pdf from 'pdf-parse/lib/pdf-parse.js';
import { GoogleGenAI } from '@google/genai';
import { Pinecone } from '@pinecone-database/pinecone';

// --- NEW SECURITY & DB IMPORTS ---
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from './models/User.js';
import Chat from './models/Chat.js'; 
import { verifyToken, isAdmin } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = process.env.VERCEL ? '/tmp/pdf-rag-uploads' : path.join(__dirname, 'uploads');

await mkdir(uploadsDir, { recursive: true });

const requiredEnv = ['GEMINI_API_KEY', 'PINECONE_API_KEY', 'PINECONE_INDEX_NAME', 'MONGODB_URI', 'JWT_SECRET'];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.warn(`Missing ${key}. Add it in .env before running the app.`);
  }
}

// YEH FUNCTION MISSING THA
function hasRequiredEnv() {
  return requiredEnv.every((key) => Boolean(process.env[key]));
}

// ==========================================
// MONGODB SETUP
// ==========================================
if (process.env.MONGODB_URI) {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ MongoDB Connected Successfully'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));
}

const app = express();
const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      cb(new Error('Only PDF files are allowed.'));
      return;
    }
    cb(null, true);
  }
});

const embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
const chatModel = process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash';

let ai;
let pineconeIndex;

if (hasRequiredEnv()) {
  ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);
}

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function getNamespace(userId) { return `user-${userId}`; }
function getUserScopedIndex(userId) { return pineconeIndex.namespace(getNamespace(userId)); }
function validateUserId(userId) { return typeof userId === 'string' && /^[a-zA-Z0-9_-]{6,80}$/.test(userId); }
function ensureConfigured(res) {
  if (ai && pineconeIndex) return true;
  res.status(500).json({ error: 'Server is missing API Keys in .env.' });
  return false;
}

// ==========================================
// AUTHENTICATION & ADMIN ROUTES
// ==========================================

// 1. Setup Master Admin (Run once in browser: http://localhost:3000/api/setup-admin)
// app.get('/api/setup-admin', async (req, res) => {
//   try {
//     const adminExists = await User.findOne({ role: 'admin' });
//     if (adminExists) return res.json({ message: 'Admin already exists!' });

//     const newAdmin = new User({
//       email: 'aniketkumargupta302@gmail.com',
//       password: 'Aniket2006', // Change this in production
//       role: 'admin'
//     });
    
//     await newAdmin.save();
//     res.json({ message: 'Master Admin created successfully. Email: admin@nexus.com' });
//   } catch (error) {
//     // YEH 2 LINES CHANGE HUI HAIN:
//     console.error("🚨 ADMIN SETUP ERROR:", error); 
//     res.status(500).json({ error: 'Setup failed', details: error.message }); 
//   }
// });

// 2. Login API (Admin & Employees)
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid Email or Password' });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) return res.status(400).json({ error: 'Invalid Email or Password' });

    const token = jwt.sign(
      { _id: user._id, role: user.role, email: user.email }, 
      process.env.JWT_SECRET, 
      { expiresIn: '24h' }
    );

    res.json({ token, role: user.role, email: user.email, userId: user._id });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// 3. Admin: Create Employee Account
app.post('/api/admin/create-user', verifyToken, isAdmin, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ error: 'Employee email already registered.' });

    const newEmployee = new User({ email, password, role: 'employee' });
    await newEmployee.save();
    
    res.json({ message: 'Employee account created successfully!', email: newEmployee.email });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create employee.' });
  }
});

// 4. Admin: View All Employees
app.get('/api/admin/employees', verifyToken, isAdmin, async (req, res) => {
  try {
    const employees = await User.find({ role: 'employee' }).select('-password');
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch employees.' });
  }
});


// 5. ADMIN ONLY: Revoke Access (Delete Employee)
app.delete('/api/admin/employees/:id', verifyToken, isAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ error: 'Cannot delete an admin account.' });

    await User.findByIdAndDelete(req.params.id);
    
    // Optional: Delete all chat history of this user to clear database space
    await Chat.deleteMany({ userId: req.params.id });

    res.json({ success: true, message: 'Employee access revoked.' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke employee access.' });
  }
});


// ==========================================
// CHAT HISTORY APIs (PROTECTED)
// ==========================================

// 1. Get all chats for sidebar (Added verifyToken)
app.get('/api/chats/:userId', verifyToken, async (req, res) => {
  try {
    // Extra Security: Check ki logged-in user apni hi history dekh raha hai
    if (req.user._id !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access to this history.' });
    }

    const chats = await Chat.find({ userId: req.params.userId })
                            .select('_id title documentId createdAt')
                            .sort({ createdAt: -1 });
    res.json(chats);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

// 2. Get full message history (Added verifyToken)
app.get('/api/chats/history/:chatId', verifyToken, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    
    if (chat.userId !== req.user._id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access.' });
    }
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load history' });
  }
});

// 3. Rename a chat (Added verifyToken)
app.put('/api/chats/:chatId', verifyToken, async (req, res) => {
  try {
    const { title } = req.body;
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    
    if (chat.userId !== req.user._id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized action.' });
    }

    chat.title = title;
    await chat.save();
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: 'Failed to rename chat' });
  }
});

// 4. Delete a chat (Added verifyToken)
app.delete('/api/chats/:chatId', verifyToken, async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.chatId);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    
    if (chat.userId !== req.user._id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized action.' });
    }

    await Chat.findByIdAndDelete(req.params.chatId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// ==========================================
// RAG PIPELINE (UPLOAD & ASK)
// ==========================================

app.post('/api/upload',verifyToken, upload.single('pdf'), async (req, res, next) => {
  const { userId } = req.body;
  const file = req.file;

  if (!ensureConfigured(res)) {
    await cleanupFile(file?.path);
    return;
  }

  if (!validateUserId(userId)) {
    await cleanupFile(file?.path);
    res.status(400).json({ error: 'Invalid user id.' });
    return;
  }

  if (!file) {
    res.status(400).json({ error: 'PDF file is required.' });
    return;
  }

  const documentId = nanoid(12);
  const originalName = file.originalname;

  try {
    const buffer = await readFile(file.path);
    const parsed = await pdf(buffer);
    const chunks = splitText(parsed.text, { chunkSize: 1000, chunkOverlap: 150 });

    if (chunks.length === 0) {
      res.status(400).json({ error: 'No readable text was found in this PDF.' });
      return;
    }

    const records = [];
    for (let index = 0; index < chunks.length; index++) {
      const text = chunks[index];
      const values = await embedText(text);
      records.push({
        id: `${documentId}-${index}`,
        values,
        metadata: { userId, documentId, fileName: originalName, chunkIndex: index, text, uploadedAt: new Date().toISOString() }
      });
    }

    const namespaceIndex = getUserScopedIndex(userId);
    for (let i = 0; i < records.length; i += 20) {
      await namespaceIndex.upsert(records.slice(i, i + 20));
    }

    res.json({ documentId, fileName: originalName, pages: parsed.numpages, chunks: chunks.length, namespace: getNamespace(userId) });
  } catch (error) {
    next(error);
  } finally {
    await cleanupFile(file.path);
  }
});

app.post('/api/ask',verifyToken, async (req, res, next) => {
  if (!ensureConfigured(res)) return;

  const { userId, documentId, question, history = [], chatId } = req.body;

  if (!validateUserId(userId) || !documentId || !question?.trim()) {
    res.status(400).json({ error: 'userId, documentId, and question are required.' });
    return;
  }

  try {
    const queryVector = await embedText(question);
    const searchResults = await getUserScopedIndex(userId).query({
      topK: 6,
      vector: queryVector,
      includeMetadata: true,
      filter: { documentId }
    });

    const matches = searchResults.matches ?? [];
    const context = matches
      .map((match, index) => `Source ${index + 1}, chunk ${match.metadata?.chunkIndex ?? 'unknown'}:\n${match.metadata?.text ?? ''}`)
      .join('\n\n---\n\n');

    const chatContents = history.map((msg) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    }));

    const finalPrompt = `
You are an expert Enterprise Document Assistant.
Answer the user's question based strictly on the provided Context.
If the answer cannot be found in the context, clearly state: "I don't have enough information in this document to answer that."
Use markdown formatting (bolding, bullet points, numbered lists, and code blocks) to make your response highly readable.

Context:
${context}

User Question:
${question}
`;

    chatContents.push({ role: 'user', parts: [{ text: finalPrompt }] });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const sources = matches.map((match) => ({
      score: match.score,
      fileName: match.metadata?.fileName,
      chunkIndex: match.metadata?.chunkIndex
    }));
    res.write(`data: ${JSON.stringify({ type: 'sources', data: sources })}\n\n`);

    const responseStream = await ai.models.generateContentStream({
      model: chatModel,
      contents: chatContents, 
      config: { temperature: 0.2 }
    });

    let fullModelResponse = "";

    for await (const chunk of responseStream) {
      if (chunk.text) {
        fullModelResponse += chunk.text;
        res.write(`data: ${JSON.stringify({ type: 'text', data: chunk.text })}\n\n`);
      }
    }

    if (mongoose.connection.readyState === 1) { 
        let activeChat;
        if (chatId) activeChat = await Chat.findById(chatId);
        
        if (!activeChat) {
             activeChat = new Chat({ userId, documentId, title: question.substring(0, 30) + '...' });
        }

        activeChat.messages.push({ role: 'user', text: question });
        activeChat.messages.push({ role: 'model', text: fullModelResponse });
        await activeChat.save();

        res.write(`data: ${JSON.stringify({ type: 'saved_chat', data: { chatId: activeChat._id } })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();

  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      next(error);
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', data: error.message || 'Streaming failed.' })}\n\n`);
      res.end();
    }
  }
});

// ==========================================
// ERROR HANDLING & SERVER INIT
// ==========================================
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: error.message || 'Something went wrong.' });
});

async function embedText(text) {
  const response = await ai.models.embedContent({ model: embeddingModel, contents: text });
  const values = response.embeddings?.[0]?.values;
  if (!values?.length) throw new Error('Embedding API returned an empty vector.');
  return values;
}

function splitText(text, { chunkSize, chunkOverlap }) {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) return [];

  const chunks = [];
  let start = 0;
  while (start < cleanText.length) {
    let end = Math.min(start + chunkSize, cleanText.length);
    const sentenceEnd = cleanText.lastIndexOf('.', end);
    if (sentenceEnd > start + chunkSize * 0.6) end = sentenceEnd + 1;
    chunks.push(cleanText.slice(start, end).trim());
    if (end === cleanText.length) break;
    start = Math.max(0, end - chunkOverlap);
  }
  return chunks;
}

async function cleanupFile(filePath) {
  if (!filePath) return;
  try { await unlink(filePath); } catch {}
}

if (!process.env.VERCEL) {
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`PDF RAG website running at http://localhost:${port}`);
  });
}

export default app;