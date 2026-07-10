# 📄 RAG SYSTEM - Enterprise AI Knowledge Assistant

![MongoDB](https://img.shields.io/badge/MongoDB-green?logo=mongodb&logoColor=white)
![Express](https://img.shields.io/badge/Express-black?logo=express&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-lightgreen?logo=node.js&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-yellow?logo=javascript&logoColor=black)
![Pinecone](https://img.shields.io/badge/Pinecone-blue?logo=pinecone&logoColor=white)
![Google Gemini](https://img.shields.io/badge/Gemini%20AI-orange?logo=google&logoColor=white)
![Open Source](https://img.shields.io/badge/Open%20Source-💻-brightgreen)
![Made with ❤️ by Aniket](https://img.shields.io/badge/Made%20with-❤️-red)

> 🚀 An enterprise-grade **Retrieval-Augmented Generation (RAG) Platform** where users can **securely upload, index, and chat with their PDF documents**, while **admins manage access and monitor audit logs** — built using **Node.js, Express, MongoDB, Gemini AI, and Pinecone**.

---

## 🚀 Overview

This is a **full-stack multi-tenant AI knowledge assistant** designed to securely manage and query enterprise documents.

✔ Users can **authenticate securely**, upload PDFs, and get streaming AI answers based strictly on their documents  
✔ Admins can **provision employees, monitor audit logs, and revoke access instantly**  
✔ Includes **JWT authentication, single-index vector storage (cost-optimized), and real-time Server-Sent Events (SSE)**

---

## 🧰 Tech Stack

| Tech | Description |
|------|-------------|
| 🗄️ MongoDB | Stores user profiles, credentials & audit logs |
| ⚙️ Express.js | Backend API routing & SSE streaming |
| 🟢 Node.js | Runtime environment |
| 🧠 Gemini AI | LLM for generating answers & creating text embeddings |
| 🌲 Pinecone | Vector database for storing document chunks |
| 🔐 JWT | Role-based authentication (Admin/Employee) |
| 🎨 HTML/CSS/JS | Fully responsive, mobile-first frontend UI |

---

## ⚙️ Features

### 👤 Employee (User)
- **Secure Login:** Role-based access control.
- **Document Ingestion:** Upload and index complex PDF documents.
- **AI Streaming:** Chat with documents using Real-Time AI Streaming (SSE).
- **Export Functionality:** Export chat history and exact context citations to PDF.
- **UI Customization:** Persistent Light/Dark theme preferences.

### 🛡 Admin
- **Command Center:** Master Admin setup and secure dashboard.
- **User Management:** Provision (create) new employee accounts.
- **Audit Logging:** View and monitor real-time employee audit logs.
- **Access Control:** Instant access revocation (Delete users).

---

## 🔄 How It Works

1️⃣ **Authentication & RBAC**
- Password management and secure login via JWT.
- Strict backend routing separates the Admin command center from the Employee workspace.

2️⃣ **Document Ingestion & Embeddings**
- Backend extracts text from PDFs and chunks it intelligently.
- Google Gemini converts chunks into high-dimensional vectors.
- Vectors are stored in a single Pinecone index using isolated, multi-tenant namespaces and `documentId` metadata to optimize cloud costs.

3️⃣ **Real-Time Retrieval (RAG)**
- User queries trigger a vector similarity search within their isolated namespace.
- Context is fed to the Gemini LLM, which streams the answer back word-by-word via Server-Sent Events (SSE) to prevent UI freezing.

---

## 💻 Setup & Usage

### 1️⃣ Clone the repo
```bash
git clone [https://github.com/Aniketgupta4/RAG_PDF.git](https://github.com/Aniketgupta4/RAG_PDF.git)
cd RAG_PDF
npm install
