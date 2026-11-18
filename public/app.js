// ==========================================
// 1. SECURITY & USER CONTEXT
// ==========================================
const token = localStorage.getItem('nexus_token');
const userId = localStorage.getItem('pdf-rag-user-id');
const role = localStorage.getItem('nexus_role');
const userEmail = localStorage.getItem('nexus_email') || 'analyst@nexus.ai';
const userName = localStorage.getItem('nexus_name') || 'Enterprise Analyst';
const userDepartment = localStorage.getItem('nexus_department') || 'Finance';

if (!token || !userId) {
  window.location.replace('/login');
}

// Display user profile in left sidebar
const userNameDisplay = document.getElementById('userNameDisplay');
const userRoleDisplay = document.getElementById('userRoleDisplay');
const userDeptDisplay = document.getElementById('userDeptDisplay');
const userAvatarText = document.getElementById('userAvatarText');
const adminNavBtn = document.getElementById('adminNavBtn');

if (userNameDisplay) userNameDisplay.textContent = userName;
if (userRoleDisplay) userRoleDisplay.textContent = role === 'admin' ? 'Security Admin' : `${userDepartment} Analyst`;
if (userDeptDisplay) userDeptDisplay.textContent = `${userDepartment} Dept`;
if (userAvatarText) userAvatarText.textContent = (userName.charAt(0) || 'U').toUpperCase();

if (adminNavBtn && role === 'admin') {
  adminNavBtn.style.display = 'block';
}

const namespaceText = document.getElementById('namespaceText');
if (namespaceText) {
  namespaceText.textContent = `company-knowledge (${userDepartment})`;
}

// ==========================================
// 2. STATE VARIABLES & DOM ELEMENTS
// ==========================================
let currentScope = 'company'; // Default to Company Knowledge Base
let activeDocumentId = '';
let activeDocumentName = '';
let currentChatId = null;
let chatHistory = [];
let userDocuments = [];
let allSidebarChats = [];
let isQueryAllDocsMode = false;

const uploadForm = document.getElementById('uploadForm');
const askForm = document.getElementById('askForm');
const pdfInput = document.getElementById('pdfInput');
const fileNameDisplay = document.getElementById('fileNameDisplay');
const questionInput = document.getElementById('questionInput');
const messages = document.getElementById('messages');
const statusText = document.getElementById('statusText');
const documentText = document.getElementById('documentText');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistoryList = document.getElementById('chatHistoryList');
const docLibraryList = document.getElementById('docLibraryList');
const docCountBadge = document.getElementById('docCountBadge');
const activeDocChip = document.getElementById('activeDocChip');
const activeDocChipName = document.getElementById('activeDocChipName');
const historySearchInput = document.getElementById('historySearchInput');
const toggleAllDocsBtn = document.getElementById('toggleAllDocsBtn');
const latencyBadge = document.getElementById('latencyBadge');
const latencyValue = document.getElementById('latencyValue');

// ==========================================
// 3. TOAST NOTIFICATION ENGINE
// ==========================================
window.showToast = function (message, type = 'info', duration = 3500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'ℹ️';
  if (type === 'success') icon = '✓';
  if (type === 'error') icon = '✕';

  toast.innerHTML = `
    <span style="font-weight: 700; color: ${type === 'success' ? 'var(--status-success)' : type === 'error' ? 'var(--status-error)' : 'var(--accent-secondary)'};">${icon}</span>
    <span style="flex: 1;">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
};

// ==========================================
// 4. MOBILE BOTTOM TAB NAVIGATION
// ==========================================
window.switchMobileTab = (tabId, btn) => {
  document.querySelectorAll('.mobile-tab-view').forEach(view => {
    view.classList.remove('active-tab');
  });
  document.querySelectorAll('.mobile-tab-btn').forEach(b => {
    b.classList.remove('active');
  });

  const targetView = document.getElementById(tabId);
  if (targetView) targetView.classList.add('active-tab');
  if (btn) btn.classList.add('active');
};

// ==========================================
// 5. THEME TOGGLE (PER-USER)
// ==========================================
const themeToggleBtn = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const htmlElement = document.documentElement;

const moonIcon = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
const sunIcon = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';

function setTheme(theme) {
  htmlElement.setAttribute('data-theme', theme);
  localStorage.setItem(`nexus_theme_${userId}`, theme);
  localStorage.setItem('nexus_global_theme', theme);
  if (themeIcon) themeIcon.innerHTML = theme === 'light' ? moonIcon : sunIcon;
}

const currentTheme = htmlElement.getAttribute('data-theme') || 'dark';
if (themeIcon) themeIcon.innerHTML = currentTheme === 'light' ? moonIcon : sunIcon;

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const nextTheme = htmlElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    showToast(`Switched to ${nextTheme} theme`, 'info', 2000);
  });
}

// Exit / Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
  localStorage.removeItem('nexus_token');
  localStorage.removeItem('nexus_role');
  localStorage.removeItem('nexus_email');
  localStorage.removeItem('nexus_name');
  localStorage.removeItem('pdf-rag-user-id');
  window.location.replace('/login');
});

// Configure Markdown Parser
if (typeof marked !== 'undefined') {
  marked.setOptions({
    gfm: true,
    breaks: true,
    highlight: function (code, lang) {
      if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return typeof hljs !== 'undefined' ? hljs.highlightAuto(code).value : code;
    }
  });
}

// ==========================================
// 6. HYBRID KNOWLEDGE BASE & WORKSPACE SCOPE
// ==========================================
window.switchKnowledgeScope = async (scope) => {
  currentScope = scope;
  clearActiveDocument();

  const compBtn = document.getElementById('scopeCompanyBtn');
  const persBtn = document.getElementById('scopePersonalBtn');
  const compNotice = document.getElementById('companyNoticeBox');
  const persUpload = document.getElementById('personalUploadBox');
  const libTitle = document.getElementById('libraryTitleText');
  const deptNotice = document.getElementById('deptClearanceNotice');
  const deptText = document.getElementById('deptClearanceText');
  const deptSub = document.getElementById('deptClearanceSub');

  if (scope === 'company') {
    compBtn?.classList.add('active');
    persBtn?.classList.remove('active');
    if (compNotice) compNotice.style.display = 'block';
    if (persUpload) persUpload.style.display = 'none';
    if (libTitle) libTitle.textContent = 'Company Knowledge Base';
    if (deptNotice) deptNotice.style.display = 'block';
    if (deptText) deptText.textContent = `${userDepartment} Clearance`;
    if (deptSub) deptSub.textContent = `Accessing certified policies for [${userDepartment}] & Universal Scope. Unrelated department records are isolated.`;
    
    if (namespaceText) {
      namespaceText.textContent = `company-knowledge (${userDepartment})`;
    }
    showToast(`Switched to Company Knowledge Base (${userDepartment} Clearance)`, 'info');
  } else {
    persBtn?.classList.add('active');
    compBtn?.classList.remove('active');
    if (compNotice) compNotice.style.display = 'none';
    if (persUpload) persUpload.style.display = 'block';
    if (libTitle) libTitle.textContent = 'Personal Documents';
    if (deptNotice) deptNotice.style.display = 'none';
    
    if (namespaceText) {
      namespaceText.textContent = `tenant-${userId.substring(0, 10)}... (Private Sandbox)`;
    }
    showToast('Switched to Private Personal Workspace', 'info');
  }

  fetchUserDocuments();
};

async function fetchUserDocuments() {
  try {
    const endpoint = currentScope === 'company' ? '/api/company/documents' : '/api/documents?scope=personal';
    const res = await fetch(endpoint, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch documents');

    userDocuments = await res.json();
    renderDocumentLibrary();
  } catch (error) {
    console.error('Document fetch error:', error);
  }
}

function renderDocumentLibrary() {
  if (!docLibraryList) return;
  if (docCountBadge) docCountBadge.textContent = `${userDocuments.length} Docs`;

  if (userDocuments.length === 0) {
    const emptyMsg = currentScope === 'company' 
      ? 'No company documents available for your department clearance.'
      : 'No personal documents uploaded yet. Drag & drop a PDF above.';
    docLibraryList.innerHTML = `
      <div style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 14px;">
        ${emptyMsg}
      </div>
    `;
    return;
  }

  docLibraryList.innerHTML = '';
  userDocuments.forEach(doc => {
    const card = document.createElement('div');
    const isActive = !isQueryAllDocsMode && doc.documentId === activeDocumentId;
    card.className = `doc-card-item ${isActive ? 'active' : ''}`;
    
    const formattedSize = doc.fileSize ? `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB` : 'PDF';
    const dept = doc.department || 'All';
    let deptBg = 'rgba(99, 102, 241, 0.15)';
    let deptColor = '#818cf8';
    if (dept === 'HR') { deptBg = 'rgba(236, 72, 153, 0.15)'; deptColor = '#ec4899'; }
    else if (dept === 'Finance') { deptBg = 'rgba(245, 158, 11, 0.15)'; deptColor = '#f59e0b'; }
    else if (dept === 'IT') { deptBg = 'rgba(6, 182, 212, 0.15)'; deptColor = '#06b6d4'; }

    const deptBadge = doc.scope === 'company'
      ? `<span style="background: ${deptBg}; color: ${deptColor}; padding: 1px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700; text-transform: uppercase;">${escapeHtml(dept)}</span>`
      : `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 1px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700; text-transform: uppercase;">Personal</span>`;

    const deleteBtn = (doc.scope === 'company' && role !== 'admin')
      ? ''
      : `
        <button class="doc-delete-btn" onclick="deleteDocument('${doc.documentId}', event)" title="Purge document & vector index">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      `;

    card.onclick = () => selectActiveDocument(doc.documentId, doc.fileName);
    card.innerHTML = `
      <div class="doc-info" style="flex: 1; min-width: 0;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
          ${deptBadge}
          <span class="doc-name text-truncate" title="${escapeHtml(doc.fileName)}" style="font-size: 12.5px; font-weight: 600;">${escapeHtml(doc.fileName)}</span>
        </div>
        <span class="doc-meta" style="font-size: 11px; color: var(--text-muted);">${doc.pages || 1} pgs • ${doc.chunks || 0} chunks • ${formattedSize}</span>
      </div>
      ${deleteBtn}
    `;
    docLibraryList.appendChild(card);
  });
}

window.selectActiveDocument = (docId, docName) => {
  isQueryAllDocsMode = false;
  if (toggleAllDocsBtn) {
    toggleAllDocsBtn.style.background = 'transparent';
    toggleAllDocsBtn.style.borderColor = 'var(--border-color)';
    toggleAllDocsBtn.textContent = '🌐 Query All Docs';
  }

  activeDocumentId = docId;
  activeDocumentName = docName;

  statusText.textContent = 'Ready (Vector Grounded)';
  statusText.style.color = 'var(--status-success)';

  if (documentText) {
    documentText.innerHTML = `
      <div class="doc-title-row">
        <span class="text-truncate" style="max-width: 80%;" title="${docName}">${docName}</span>
        <button id="clearDocBtn" class="clear-doc-btn" title="Deselect Context" onclick="clearActiveDocument()">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;
  }

  if (activeDocChip && activeDocChipName) {
    activeDocChip.style.display = 'inline-flex';
    activeDocChipName.textContent = docName;
  }

  renderDocumentLibrary();
  showToast(`Active context: ${docName}`, 'success', 2500);

  // If on mobile, switch to chat view automatically
  if (window.innerWidth <= 992) {
    switchMobileTab('mobileChatTab', document.querySelectorAll('.mobile-tab-btn')[1]);
  }
};

window.toggleQueryAllDocs = () => {
  if (userDocuments.length === 0) {
    return showToast('No documents in library to query.', 'error');
  }

  isQueryAllDocsMode = !isQueryAllDocsMode;

  if (isQueryAllDocsMode) {
    activeDocumentId = 'all';
    activeDocumentName = `Entire Library (${userDocuments.length} Documents)`;
    toggleAllDocsBtn.style.background = 'var(--accent-gradient-subtle)';
    toggleAllDocsBtn.style.borderColor = 'var(--accent-primary)';
    toggleAllDocsBtn.textContent = '✓ Multi-Doc Active';

    statusText.textContent = 'Cross-Document Mode';
    statusText.style.color = 'var(--accent-secondary)';

    if (documentText) documentText.textContent = activeDocumentName;
    if (activeDocChip && activeDocChipName) {
      activeDocChip.style.display = 'inline-flex';
      activeDocChipName.textContent = 'All Documents';
    }

    renderDocumentLibrary();
    showToast('Cross-Document RAG enabled! Queries now search all indexed documents.', 'info', 3000);
  } else {
    clearActiveDocument();
    toggleAllDocsBtn.style.background = 'transparent';
    toggleAllDocsBtn.style.borderColor = 'var(--border-color)';
    toggleAllDocsBtn.textContent = '🌐 Query All Docs';
  }

  if (window.innerWidth <= 992) {
    switchMobileTab('mobileChatTab', document.querySelectorAll('.mobile-tab-btn')[1]);
  }
};

window.clearActiveDocument = () => {
  activeDocumentId = '';
  activeDocumentName = '';
  isQueryAllDocsMode = false;
  statusText.textContent = 'Awaiting Document';
  statusText.style.color = 'var(--text-muted)';
  if (documentText) documentText.textContent = 'None Selected';
  if (activeDocChip) activeDocChip.style.display = 'none';
  renderDocumentLibrary();
};

window.deleteDocument = async (docId, event) => {
  event.stopPropagation();
  if (!confirm('Are you sure you want to permanently delete this document and purge its Pinecone vector embeddings?')) return;

  try {
    const res = await fetch(`/api/documents/${docId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Deletion failed');

    userDocuments = userDocuments.filter(d => d.documentId !== docId);
    if (activeDocumentId === docId) {
      clearActiveDocument();
    }
    renderDocumentLibrary();
    fetchSidebarChats();
    showToast('Document and vector embeddings purged.', 'success');
  } catch (err) {
    showToast('Failed to delete document: ' + err.message, 'error');
  }
};

// ==========================================
// 7. SESSIONS & HISTORY
// ==========================================
async function fetchSidebarChats() {
  try {
    const res = await fetch(`/api/chats/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to fetch chats');

    allSidebarChats = await res.json();
    renderSidebarChats(allSidebarChats);
  } catch (error) {
    console.error('Chat history fetch error:', error);
  }
}

function renderSidebarChats(chats) {
  if (!chatHistoryList) return;
  chatHistoryList.innerHTML = '<div class="history-label">Recent Sessions</div>';

  if (chats.length === 0) {
    chatHistoryList.innerHTML += `<div style="padding: 12px; font-size: 12px; color: var(--text-muted);">No active sessions found.</div>`;
    return;
  }

  chats.forEach(chat => {
    const chatItem = document.createElement('div');
    chatItem.className = `chat-item ${chat._id === currentChatId ? 'active' : ''}`;

    chatItem.innerHTML = `
      <div class="chat-title-wrapper" onclick="loadChatHistory('${chat._id}', '${chat.documentId}')">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <span class="chat-title">${escapeHtml(chat.title)}</span>
      </div>
      <div class="chat-actions">
        <button class="action-btn" onclick="renameChat('${chat._id}', '${escapeHtml(chat.title)}', event)" title="Rename Session">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
        </button>
        <button class="action-btn delete-btn" onclick="deleteChat('${chat._id}', event)" title="Delete Session">
          <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </div>
    `;
    chatHistoryList.appendChild(chatItem);
  });
}

if (historySearchInput) {
  historySearchInput.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      renderSidebarChats(allSidebarChats);
      return;
    }
    const filtered = allSidebarChats.filter(c => (c.title || '').toLowerCase().includes(query));
    renderSidebarChats(filtered);
  });
}

window.loadChatHistory = async (chatId, docId) => {
  try {
    const res = await fetch(`/api/chats/history/${chatId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load chat');
    const chatData = await res.json();

    currentChatId = chatData._id;
    messages.innerHTML = '';
    chatHistory = [];

    const matchedDoc = userDocuments.find(d => d.documentId === chatData.documentId);
    const docName = matchedDoc ? matchedDoc.fileName : (chatData.documentId === 'all' ? 'All Documents' : 'Indexed Context');
    
    if (chatData.documentId === 'all') {
      toggleQueryAllDocs();
    } else {
      selectActiveDocument(chatData.documentId, docName);
    }

    chatData.messages.forEach(msg => {
      chatHistory.push({ role: msg.role, text: msg.text });
      const isAssistant = msg.role === 'model';
      const node = addMessage(isAssistant ? 'assistant' : 'user', msg.text, isAssistant);

      if (isAssistant && msg.sources && msg.sources.length > 0) {
        renderSourceBadges(node, msg.sources);
      }
      if (isAssistant) {
        attachResponseTools(node, msg.text);
      }
    });

    renderSidebarChats(allSidebarChats);

    if (window.innerWidth <= 992) {
      switchMobileTab('mobileChatTab', document.querySelectorAll('.mobile-tab-btn')[1]);
    }
  } catch (error) {
    showToast('Failed to load conversation history.', 'error');
  }
};

window.renameChat = async (chatId, currentTitle, event) => {
  event.stopPropagation();
  const newTitle = prompt('Enter a new title for this conversation:', currentTitle);
  if (!newTitle || newTitle.trim() === currentTitle) return;

  try {
    const res = await fetch(`/api/chats/${chatId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ title: newTitle.trim() })
    });
    if (res.ok) {
      fetchSidebarChats();
      showToast('Session renamed.', 'success');
    }
  } catch (err) {
    showToast('Rename failed.', 'error');
  }
};

window.deleteChat = async (chatId, event) => {
  event.stopPropagation();
  if (!confirm('Are you sure you want to delete this session?')) return;

  try {
    await fetch(`/api/chats/${chatId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (currentChatId === chatId) createNewChat();
    fetchSidebarChats();
    showToast('Session deleted.', 'info');
  } catch (error) {
    console.error('Delete failed:', error);
  }
};

function createNewChat() {
  currentChatId = null;
  chatHistory = [];
  messages.innerHTML = `
    <div class="message assistant">
      <strong>New Session Initialized.</strong><br/>
      Query your active document context below or select another PDF from your Document Library.
    </div>
  `;
  renderSidebarChats(allSidebarChats);
  if (window.innerWidth <= 992) {
    switchMobileTab('mobileChatTab', document.querySelectorAll('.mobile-tab-btn')[1]);
  }
}

if (newChatBtn) newChatBtn.addEventListener('click', createNewChat);

// ==========================================
// 8. UPLOAD PDF LOGIC (PARALLEL INGESTION)
// ==========================================
if (pdfInput && fileNameDisplay) {
  pdfInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      fileNameDisplay.textContent = e.target.files[0].name;
      fileNameDisplay.style.color = 'var(--accent-secondary)';
    } else {
      fileNameDisplay.textContent = 'Click or drag corporate PDF';
      fileNameDisplay.style.color = 'var(--text-main)';
    }
  });
}

uploadForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = pdfInput.files[0];
  if (!file) return;

  const submitBtn = document.getElementById('uploadSubmitBtn');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Vectorizing & Ingesting PDF...</span>';
  }

  statusText.textContent = 'Indexing Vector Embeddings...';
  statusText.style.color = 'var(--accent-secondary)';

  createNewChat();
  addMessage('assistant', `Ingesting <strong>${escapeHtml(file.name)}</strong>. Extracting text, generating dense embeddings with Gemini, and indexing into tenant namespace...`);

  try {
    const formData = new FormData();
    formData.append('pdf', file);

    const response = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Indexing pipeline failed.');

    await fetchUserDocuments();
    selectActiveDocument(data.documentId, data.fileName);

    addMessage('assistant', `Vectorization complete! Successfully indexed <strong>${data.pages} pages</strong> into <strong>${data.chunks} semantic chunks</strong>. You can now execute grounded queries.`);
    showToast(`Indexed ${data.fileName} (${data.chunks} chunks)`, 'success', 3500);

    uploadForm.reset();
    fileNameDisplay.textContent = 'Click or drag corporate PDF';
    fileNameDisplay.style.color = 'var(--text-main)';
  } catch (error) {
    statusText.textContent = 'Ingestion Error';
    statusText.style.color = 'var(--status-error)';
    addMessage('error', error.message);
    showToast('PDF Ingestion failed: ' + error.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="16 16 12 12 8 16"></polyline><line x1="12" y1="12" x2="12" y2="21"></line><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"></path><polyline points="16 16 12 12 8 16"></polyline></svg>
        <span>Index into Vector Space</span>
      `;
    }
  }
});

// ==========================================
// 9. STREAMING & CHAT LOGIC (SSE)
// ==========================================
window.applySuggestion = (text) => {
  if (questionInput) {
    questionInput.value = text;
    askForm.dispatchEvent(new Event('submit', { cancelable: true }));
  }
};

askForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;

  if (!activeDocumentId && !isQueryAllDocsMode) {
    showToast('Please select a document or click "Query All Docs".', 'error');
    return addMessage('error', 'No active document selected. Please select a document from your library or toggle "Query All Docs" first.');
  }

  questionInput.value = '';
  addMessage('user', question, false);

  const submitBtn = document.getElementById('submitAskBtn');
  if (submitBtn) submitBtn.disabled = true;

  const msgNode = document.createElement('div');
  msgNode.className = 'message assistant markdown-body';
  const textContainer = document.createElement('div');
  textContainer.innerHTML = '<span style="color: var(--text-muted); font-style: italic;">Retrieving semantic chunks & generating grounded response...</span>';
  msgNode.appendChild(textContainer);
  messages.appendChild(msgNode);
  messages.scrollTop = messages.scrollHeight;

  let pendingSources = null;
  let rawAiText = '';

  try {
    const response = await fetch('/api/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        documentId: isQueryAllDocsMode ? 'all' : activeDocumentId,
        question,
        history: chatHistory,
        chatId: currentChatId,
        scope: currentScope
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Server processing error occurred.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;
    let hasClearedPlaceholder = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;

      if (value) {
        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            if (!dataStr) continue;

            try {
              const payload = JSON.parse(dataStr);

              if (payload.type === 'sources') {
                pendingSources = payload.data;
              } else if (payload.type === 'telemetry') {
                if (latencyValue) {
                  latencyValue.textContent = `${payload.data.latencyMs}ms • ${payload.data.topScore}% Match`;
                }
              } else if (payload.type === 'text') {
                if (!hasClearedPlaceholder) {
                  textContainer.innerHTML = '';
                  hasClearedPlaceholder = true;
                }
                rawAiText += payload.data;
                textContainer.innerHTML = marked.parse(rawAiText);
                messages.scrollTop = messages.scrollHeight;
              } else if (payload.type === 'saved_chat') {
                currentChatId = payload.data.chatId;
                fetchSidebarChats();
              } else if (payload.type === 'done') {
                chatHistory.push({ role: 'user', text: question });
                chatHistory.push({ role: 'model', text: rawAiText });

                if (pendingSources && pendingSources.length > 0) {
                  renderSourceBadges(msgNode, pendingSources);
                }
                attachResponseTools(msgNode, rawAiText);
              } else if (payload.type === 'error') {
                textContainer.innerHTML = `<strong>Error:</strong> ${payload.data}`;
                msgNode.classList.add('error');
              }
            } catch (jsonErr) {
              console.error('SSE parse error:', jsonErr);
            }
          }
        }
      }
    }
  } catch (error) {
    textContainer.textContent = error.message;
    msgNode.classList.add('error');
    showToast(error.message, 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    questionInput.focus();
  }
});

// ==========================================
// 10. VOICE INPUT (SPEECH-TO-TEXT)
// ==========================================
const voiceInputBtn = document.getElementById('voiceInputBtn');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition && voiceInputBtn) {
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  let isRecording = false;

  voiceInputBtn.addEventListener('click', () => {
    if (isRecording) {
      recognition.stop();
      return;
    }

    try {
      recognition.start();
      isRecording = true;
      voiceInputBtn.classList.add('recording');
      showToast('Listening... Speak your query clearly.', 'info', 2000);
    } catch (e) {
      console.warn('Speech recognition start error:', e);
    }
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    if (questionInput) {
      questionInput.value = transcript;
      showToast(`Transcribed: "${transcript}"`, 'success', 2500);
      questionInput.focus();
    }
  };

  recognition.onend = () => {
    isRecording = false;
    voiceInputBtn.classList.remove('recording');
  };

  recognition.onerror = (event) => {
    isRecording = false;
    voiceInputBtn.classList.remove('recording');
    showToast('Speech recognition error: ' + event.error, 'error');
  };
} else if (voiceInputBtn) {
  voiceInputBtn.title = 'Speech-to-Text not supported on this browser';
  voiceInputBtn.style.opacity = '0.5';
  voiceInputBtn.onclick = () => showToast('Browser does not support Web Speech API.', 'error');
}

// ==========================================
// 11. AUTO EXECUTIVE BRIEFING GENERATOR
// ==========================================
const docSummaryBtn = document.getElementById('docSummaryBtn');
const briefingModal = document.getElementById('briefingModal');
const closeBriefingModal = document.getElementById('closeBriefingModal');

if (closeBriefingModal && briefingModal) {
  closeBriefingModal.addEventListener('click', () => briefingModal.style.display = 'none');
}

docSummaryBtn?.addEventListener('click', async () => {
  if (!activeDocumentId && !isQueryAllDocsMode) {
    return showToast('Select a document from your library first.', 'error');
  }

  document.getElementById('briefingDocTitle').textContent = `Document Context: ${activeDocumentName}`;
  const contentDiv = document.getElementById('briefingContent');
  contentDiv.innerHTML = '<p style="color: var(--text-muted); font-style: italic;">Analyzing semantic chunks across document and synthesizing executive briefing...</p>';
  briefingModal.style.display = 'flex';

  try {
    const res = await fetch('/api/documents/summary', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ documentId: isQueryAllDocsMode ? 'all' : activeDocumentId })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to synthesize summary');

    contentDiv.innerHTML = marked.parse(data.summary);
  } catch (err) {
    contentDiv.innerHTML = `<p style="color: var(--status-error);">Error: ${err.message}</p>`;
  }
});

// ==========================================
// 12. EXPORT OPTIONS MENU (PDF / MD / TXT)
// ==========================================
const exportDropdownBtn = document.getElementById('exportDropdownBtn');
const exportMenu = document.getElementById('exportMenu');

if (exportDropdownBtn && exportMenu) {
  exportDropdownBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.style.display = exportMenu.style.display === 'block' ? 'none' : 'block';
  });

  document.addEventListener('click', () => {
    exportMenu.style.display = 'none';
  });
}

window.exportMarkdown = () => {
  if (chatHistory.length === 0) return showToast('No conversation to export.', 'error');

  let md = `# NexusAI Enterprise Intelligence Session\n`;
  md += `**Document:** ${activeDocumentName || 'Indexed Vector Model'}\n`;
  md += `**Auditor:** ${userName} (${userEmail})\n`;
  md += `**Date:** ${new Date().toLocaleString()}\n\n---\n\n`;

  chatHistory.forEach(msg => {
    md += `### ${msg.role === 'user' ? '👤 User Query' : '🤖 NexusAI Grounded Response'}\n\n`;
    md += `${msg.text}\n\n`;
  });

  downloadFile(md, `NexusAI_Session_${Date.now()}.md`, 'text/markdown');
  showToast('Exported Markdown transcript.', 'success');
};

window.exportPlainText = () => {
  if (chatHistory.length === 0) return showToast('No conversation to export.', 'error');

  let txt = `=======================================================\n`;
  txt += `NEXUSAI ENTERPRISE AUDIT TRANSCRIPT\n`;
  txt += `Document: ${activeDocumentName || 'Indexed Model'}\n`;
  txt += `Generated: ${new Date().toLocaleString()}\n`;
  txt += `=======================================================\n\n`;

  chatHistory.forEach(msg => {
    txt += `[${msg.role.toUpperCase()}]:\n${msg.text}\n\n`;
  });

  downloadFile(txt, `NexusAI_Session_${Date.now()}.txt`, 'text/plain');
  showToast('Exported TXT transcript.', 'success');
};

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

window.exportAuditPDF = () => {
  if (chatHistory.length === 0) return showToast('No conversation to export.', 'error');

  showToast('Compiling executive PDF report...', 'info', 2000);

  const pdfContainer = document.createElement('div');
  pdfContainer.style.padding = '24px';
  pdfContainer.style.fontFamily = 'Helvetica, Arial, sans-serif';
  pdfContainer.style.color = '#0f172a';
  pdfContainer.style.background = '#ffffff';

  pdfContainer.innerHTML = `
    <div style="border-bottom: 2px solid #6366f1; padding-bottom: 12px; margin-bottom: 24px;">
      <h1 style="color: #4f46e5; margin: 0 0 6px 0; font-size: 22px;">NexusAI Enterprise Grounded Audit Report</h1>
      <p style="margin: 0; font-size: 13px;"><strong>Active Context:</strong> ${activeDocumentName || 'Indexed Vector Model'}</p>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #64748b;"><strong>Auditor:</strong> ${userName} (${userEmail}) &bull; Date: ${new Date().toLocaleString()}</p>
    </div>
  `;

  chatHistory.forEach(msg => {
    const isUser = msg.role === 'user';
    let content = msg.text;
    if (!isUser && typeof marked !== 'undefined') {
      content = marked.parse(content);
    } else {
      content = `<p style="margin: 0;">${content}</p>`;
    }

    pdfContainer.innerHTML += `
      <div style="margin-bottom: 18px; padding: 14px 18px; background: ${isUser ? '#f1f5f9' : '#ffffff'}; border: ${isUser ? 'none' : '1px solid #e2e8f0'}; border-radius: 8px;">
        <div style="font-size: 11px; font-weight: 700; color: #4f46e5; text-transform: uppercase; margin-bottom: 6px;">
          ${isUser ? 'User Grounded Query' : 'Verified AI Synthesis'}
        </div>
        <div style="font-size: 13.5px; line-height: 1.6;">${content}</div>
      </div>
    `;
  });

  html2pdf().set({
    margin: 10,
    filename: `NexusAI_Audit_Report_${Date.now()}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  }).from(pdfContainer).save().then(() => {
    showToast('PDF audit report downloaded!', 'success');
  }).catch(err => {
    showToast('PDF generation failed: ' + err.message, 'error');
  });
};

// ==========================================
// 13. CITATIONS & MODAL LOGIC
// ==========================================
function renderSourceBadges(containerNode, sources) {
  const sourcesContainer = document.createElement('div');
  sourcesContainer.className = 'sources-container';

  const sourceLabel = document.createElement('span');
  sourceLabel.textContent = 'Evidence: ';
  sourceLabel.className = 'source-label';
  sourcesContainer.appendChild(sourceLabel);

  sources.slice(0, 4).forEach((src, idx) => {
    const badge = document.createElement('span');
    const scoreText = src.score ? ` (${(src.score * 100).toFixed(0)}%)` : '';
    badge.textContent = `Chunk #${src.chunkIndex}${scoreText}`;
    badge.className = 'source-badge';
    badge.onclick = () => openCitationModal(src, idx + 1);
    sourcesContainer.appendChild(badge);
  });

  containerNode.appendChild(sourcesContainer);
  messages.scrollTop = messages.scrollHeight;
}

const citationModal = document.getElementById('citationModal');
const closeCitationModal = document.getElementById('closeCitationModal');
const copyCitationBtn = document.getElementById('copyCitationBtn');
let currentCitationSnippet = '';

if (closeCitationModal) {
  closeCitationModal.addEventListener('click', () => {
    citationModal.style.display = 'none';
  });
}

if (copyCitationBtn) {
  copyCitationBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(currentCitationSnippet);
    showToast('Citation text chunk copied to clipboard!', 'success');
  });
}

function openCitationModal(src, index) {
  if (!citationModal) return;
  currentCitationSnippet = src.snippet || 'No excerpt available.';
  document.getElementById('citationModalMeta').textContent = `Source #${index} • File: ${src.fileName || activeDocumentName} • Chunk: ${src.chunkIndex} • Cosine Similarity: ${src.score ? (src.score * 100).toFixed(1) + '%' : 'High'}`;
  document.getElementById('citationModalContent').textContent = currentCitationSnippet;
  citationModal.style.display = 'flex';
}

function attachResponseTools(messageNode, rawText) {
  const toolStrip = document.createElement('div');
  toolStrip.style.display = 'flex';
  toolStrip.style.gap = '8px';
  toolStrip.style.marginTop = '10px';

  const copyBtn = document.createElement('button');
  copyBtn.className = 'outline-btn';
  copyBtn.style.padding = '3px 9px';
  copyBtn.style.fontSize = '11px';
  copyBtn.innerHTML = '📋 Copy';
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(rawText);
    showToast('Response copied to clipboard!', 'success', 2000);
  };

  toolStrip.appendChild(copyBtn);
  messageNode.appendChild(toolStrip);
}

function addMessage(type, text, parseMarkdown = false) {
  const node = document.createElement('div');
  node.className = `message ${type}`;

  if (parseMarkdown && typeof marked !== 'undefined') {
    node.className += ' markdown-body';
    node.innerHTML = marked.parse(text);
  } else {
    node.textContent = text;
  }

  messages.appendChild(node);
  messages.scrollTop = messages.scrollHeight;
  return node;
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, function (m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m];
  });
}

// ==========================================
// 14. COMMAND PALETTE (CTRL+K / CMD+K)
// ==========================================
const cmdPaletteOverlay = document.getElementById('cmdPaletteOverlay');
const cmdPaletteInput = document.getElementById('cmdPaletteInput');

window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    toggleCommandPalette();
  }
  if (e.key === 'Escape' && cmdPaletteOverlay.style.display === 'flex') {
    cmdPaletteOverlay.style.display = 'none';
  }
});

function toggleCommandPalette() {
  if (!cmdPaletteOverlay) return;
  const isShown = cmdPaletteOverlay.style.display === 'flex';
  cmdPaletteOverlay.style.display = isShown ? 'none' : 'flex';
  if (!isShown && cmdPaletteInput) {
    cmdPaletteInput.value = '';
    cmdPaletteInput.focus();
  }
}

cmdPaletteOverlay?.addEventListener('click', (e) => {
  if (e.target === cmdPaletteOverlay) cmdPaletteOverlay.style.display = 'none';
});

window.triggerCmd = (action) => {
  cmdPaletteOverlay.style.display = 'none';
  if (action === 'newChat') createNewChat();
  if (action === 'briefing') docSummaryBtn?.click();
  if (action === 'queryAll') toggleQueryAllDocs();
  if (action === 'export') exportAuditPDF();
  if (action === 'theme') themeToggleBtn?.click();
};

// Initial Boot
fetchUserDocuments();
fetchSidebarChats();
