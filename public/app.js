// ==========================================
// 1. SECURITY & USER DATA
// ==========================================
const token = localStorage.getItem('nexus_token');
const userId = localStorage.getItem('pdf-rag-user-id');
const role = localStorage.getItem('nexus_role');

// Intruders ko baahar nikalo
if (!token || !userId) {
  window.location.replace('/login.html'); 
}

// ==========================================
// 2. STATE VARIABLES
// ==========================================
let documentId = '';
let documentName = '';
let currentChatId = null; 
let chatHistory = []; 

const uploadForm = document.querySelector('#uploadForm');
const askForm = document.querySelector('#askForm');
const pdfInput = document.querySelector('#pdfInput');
const fileNameDisplay = document.querySelector('#fileNameDisplay');
const questionInput = document.querySelector('#questionInput');
const messages = document.querySelector('#messages');
const statusText = document.querySelector('#statusText');
const documentText = document.querySelector('#documentText');
const newChatBtn = document.getElementById('newChatBtn');
const chatHistoryList = document.getElementById('chatHistoryList');

// ==========================================
// 3. THEME TOGGLE (PER-USER)
// ==========================================
const themeToggleBtn = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const htmlElement = document.documentElement;

const moonIcon = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
const sunIcon = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';

// Load this specific user's theme
const savedTheme = localStorage.getItem(`nexus_theme_${userId}`);
if (savedTheme) {
  setTheme(savedTheme);
} else {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  setTheme(prefersDark ? 'dark' : 'light');
}

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
  });
}

function setTheme(themeName) {
  htmlElement.setAttribute('data-theme', themeName);
  localStorage.setItem(`nexus_theme_${userId}`, themeName); // Specific to User ID
  if (themeIcon) themeIcon.innerHTML = themeName === 'light' ? moonIcon : sunIcon;
}

// ==========================================
// 4. MARKDOWN CONFIG
// ==========================================
if (typeof marked !== 'undefined' && typeof hljs !== 'undefined') {
  marked.setOptions({
    highlight: function (code, lang) {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    }
  });
}

// ==========================================
// 5. SIDEBAR CHAT HISTORY
// ==========================================
async function fetchSidebarChats() {
  try {
    const res = await fetch(`/api/chats/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` } // SECURE
    });
    if (!res.ok) throw new Error('Failed to fetch chats');
    
    const chats = await res.json();
    chatHistoryList.innerHTML = '<div class="history-label">Recent Chats</div>';

    if(chats.length === 0) {
        chatHistoryList.innerHTML += `<div style="padding: 12px; font-size: 12px; color: var(--text-muted);">No recent chats.</div>`;
        return;
    }

    chats.forEach(chat => {
      const chatItem = document.createElement('div');
      chatItem.className = `chat-item ${chat._id === currentChatId ? 'active' : ''}`;
      
      chatItem.innerHTML = `
        <div class="chat-title-wrapper" onclick="loadChatHistory('${chat._id}', '${chat.documentId}')">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
          <span class="chat-title">${chat.title}</span>
        </div>
        <div class="chat-actions">
          <button class="action-btn delete-btn" onclick="deleteChat('${chat._id}')" title="Delete Chat">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      `;
      chatHistoryList.appendChild(chatItem);
    });
  } catch (error) {
    console.error("Error fetching chats:", error);
  }
}

window.loadChatHistory = async (chatId, docId) => {
  try {
    const res = await fetch(`/api/chats/history/${chatId}`, {
      headers: { 'Authorization': `Bearer ${token}` } // SECURE
    });
    const chatData = await res.json();
    
    currentChatId = chatData._id;
    setDocumentState(chatData.documentId, "Archived PDF Context");
    
    messages.innerHTML = '';
    chatHistory = [];
    
    chatData.messages.forEach(msg => {
      chatHistory.push({ role: msg.role, text: msg.text });
      addMessage(msg.role === 'model' ? 'assistant' : 'user', msg.text, msg.role === 'model');
    });
    
    fetchSidebarChats();
  } catch (error) {
    addMessage('error', 'Failed to load chat history.');
  }
};

window.deleteChat = async (chatId) => {
  if (!confirm('Are you sure you want to delete this chat?')) return;
  try {
    await fetch(`/api/chats/${chatId}`, { 
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` } // SECURE
    });
    if (currentChatId === chatId) createNewChat();
    fetchSidebarChats();
  } catch (error) {
    console.error('Delete failed', error);
  }
};

function createNewChat() {
  currentChatId = null;
  chatHistory = [];
  setDocumentState('', '');
  messages.innerHTML = `
    <div class="message assistant">
      <strong>System initialized.</strong> Upload a PDF document in the right sidebar to begin the embedding process, or select a previous conversation from the left menu.
    </div>
  `;
  fetchSidebarChats();
}

if(newChatBtn) newChatBtn.addEventListener('click', createNewChat);
fetchSidebarChats(); // Initial Load

// ==========================================
// 6. UPLOAD PDF LOGIC
// ==========================================
function setDocumentState(id, name) {
  documentId = id;
  documentName = name;

  if (id && name) {
    statusText.textContent = 'Ready';
    statusText.style.color = 'var(--status-success)'; 
    documentText.innerHTML = `
      <div class="doc-title-row">
        <span class="text-truncate" style="max-width: 80%;" title="${name}">${name}</span>
        <button id="clearDocBtn" class="clear-doc-btn" title="Remove Document">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    `;
    document.getElementById('clearDocBtn').addEventListener('click', () => {
      createNewChat();
      addMessage('assistant', 'Active document removed. Please upload a new PDF to continue querying.');
    });
  } else {
    statusText.textContent = 'Awaiting Data';
    statusText.style.color = 'inherit';
    documentText.textContent = 'None';
  }
}

if (pdfInput && fileNameDisplay) {
  pdfInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      fileNameDisplay.textContent = e.target.files[0].name;
      fileNameDisplay.style.color = 'var(--accent-primary)';
    } else {
      fileNameDisplay.textContent = 'Click to browse or drag PDF';
      fileNameDisplay.style.color = 'var(--text-main)';
    }
  });
}

uploadForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = pdfInput.files[0];
  if (!file) return;

  setBusy(uploadForm, true);
  statusText.textContent = 'Indexing PDF...';
  
  createNewChat();
  addMessage('assistant', `Indexing "${file.name}". This can take a little time for large PDFs.`);

  try {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('userId', userId);

    const response = await fetch('/api/upload', { 
      method: 'POST', 
      headers: { 'Authorization': `Bearer ${token}` }, // SECURE
      body: formData 
    });
    
    const data = await readJson(response);
    setDocumentState(data.documentId, data.fileName);
    addMessage('assistant', `Done. I indexed ${data.pages} pages into ${data.chunks} chunks. Ask me anything about this document!`);
    
    uploadForm.reset();
    fileNameDisplay.textContent = 'Click to browse or drag PDF';
    fileNameDisplay.style.color = 'var(--text-main)';
  } catch (error) {
    statusText.textContent = 'Upload failed';
    statusText.style.color = 'var(--status-error)';
    addMessage('error', error.message);
  } finally {
    setBusy(uploadForm, false);
  }
});

// ==========================================
// 7. STREAMING & CHAT LOGIC
// ==========================================
askForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question = questionInput.value.trim();
  if (!question) return;
  
  if (!documentId) {
    return addMessage('error', 'No active document. Please upload and index a PDF first.');
  }

  questionInput.value = '';
  addMessage('user', question, false);
  setBusy(askForm, true);

  const msgNode = document.createElement('div');
  msgNode.className = 'message assistant markdown-body';
  const textContainer = document.createElement('div');
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
        'Authorization': `Bearer ${token}` // SECURE
      },
      body: JSON.stringify({ userId, documentId, question, history: chatHistory, chatId: currentChatId })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Server error occurred.');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let done = false;

    while (!done) {
      const { value, done: readerDone } = await reader.read();
      done = readerDone;
      
      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6);
            if (!dataStr) continue;
            
            try {
              const parsed = JSON.parse(dataStr);
              
              if (parsed.type === 'sources') {
                pendingSources = parsed.data;
              } 
              else if (parsed.type === 'text') {
                rawAiText += parsed.data;
                if (typeof marked !== 'undefined') {
                  textContainer.innerHTML = marked.parse(rawAiText);
                } else {
                  textContainer.textContent = rawAiText;
                }
                messages.scrollTop = messages.scrollHeight;
              } 
              else if (parsed.type === 'saved_chat') {
                currentChatId = parsed.data.chatId;
                fetchSidebarChats(); 
              }
              else if (parsed.type === 'done') {
                chatHistory.push({ role: 'user', text: question });
                chatHistory.push({ role: 'model', text: rawAiText });
                
                attachCopyButtons(msgNode, rawAiText); // ADD COPY BUTTONS

                if (pendingSources && pendingSources.length > 0) {
                  const sourcesContainer = document.createElement('div');
                  sourcesContainer.className = 'sources-container';
                  
                  const sourceLabel = document.createElement('span');
                  sourceLabel.textContent = 'Context: ';
                  sourceLabel.className = 'source-label';
                  sourcesContainer.appendChild(sourceLabel);

                  pendingSources.slice(0, 3).forEach((src) => {
                    const badge = document.createElement('span');
                    badge.textContent = `Chunk #${src.chunkIndex}`;
                    badge.className = 'source-badge';
                    sourcesContainer.appendChild(badge);
                  });

                  msgNode.appendChild(sourcesContainer);
                  messages.scrollTop = messages.scrollHeight;
                }
              }
              else if (parsed.type === 'error') {
                textContainer.innerHTML = `<strong>Error:</strong> ${parsed.data}`;
                msgNode.classList.add('error');
              }
            } catch (e) {
              console.error('Error parsing SSE payload:', e);
            }
          }
        }
      }
    }
  } catch (error) {
    textContainer.textContent = error.message;
    msgNode.classList.add('error');
  } finally {
    setBusy(askForm, false);
    questionInput.focus();
  }
});

// ==========================================
// 8. HELPERS & COPY BUTTONS
// ==========================================
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
}

function setBusy(form, busy) {
  for (const element of form.querySelectorAll('button, input')) {
    element.disabled = busy;
  }
}

async function readJson(response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

function attachCopyButtons(messageNode, rawText) {
  const copyMsgBtn = document.createElement('button');
  copyMsgBtn.className = 'copy-btn';
  copyMsgBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
  
  copyMsgBtn.onclick = () => {
    navigator.clipboard.writeText(rawText);
    copyMsgBtn.innerHTML = 'Copied!';
    copyMsgBtn.classList.add('copied');
    setTimeout(() => {
      copyMsgBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
      copyMsgBtn.classList.remove('copied');
    }, 2000);
  };
  messageNode.appendChild(copyMsgBtn);
}

// ==========================================
// 9. PDF EXPORT
// ==========================================
const exportChatBtn = document.getElementById('exportChatBtn');
if (exportChatBtn && typeof html2pdf !== 'undefined') {
  exportChatBtn.addEventListener('click', () => {
    if (chatHistory.length === 0) return alert('No chat history available to export.');

    const originalContent = exportChatBtn.innerHTML;
    exportChatBtn.innerHTML = `Processing PDF...`;
    exportChatBtn.disabled = true;

    const pdfContainer = document.createElement('div');
    pdfContainer.style.padding = '20px';
    pdfContainer.style.fontFamily = 'Helvetica, Arial, sans-serif';
    pdfContainer.style.color = '#1e293b'; 
    pdfContainer.style.background = '#ffffff';

    pdfContainer.innerHTML = `
      <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 10px; margin-bottom: 20px;">
        <h1 style="color: #4f46e5; margin: 0 0 5px 0;">Nexus RAG - Chat Report</h1>
        <p style="margin: 0; font-size: 14px;"><strong>Document Context:</strong> ${documentName || 'None'}</p>
        <p style="margin: 5px 0 0 0; font-size: 14px; color: #64748b;">Generated on: ${new Date().toLocaleString()}</p>
      </div>
    `;

    chatHistory.forEach(msg => {
      const isUser = msg.role === 'user';
      let content = msg.text;
      if (!isUser && typeof marked !== 'undefined') content = marked.parse(content);
      else content = `<p style="margin: 0;">${content}</p>`;

      pdfContainer.innerHTML += `
        <div style="margin-bottom: 20px; padding: 16px; background: ${isUser ? '#f8fafc' : '#ffffff'}; border: ${isUser ? 'none' : '1px solid #e2e8f0'}; border-radius: 8px;">
          <strong style="color: #4f46e5; font-size: 12px; letter-spacing: 1px;">${isUser ? 'USER QUERY' : 'AI RESPONSE'}</strong>
          <div style="margin-top: 10px; font-size: 14px; line-height: 1.6;">${content}</div>
        </div>
      `;
    });

    html2pdf().set({
      margin: 10,
      filename: `Nexus_Report_${new Date().getTime()}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(pdfContainer).save().then(() => {
      exportChatBtn.innerHTML = originalContent;
      exportChatBtn.disabled = false;
    }).catch(err => {
      console.error(err);
      exportChatBtn.innerHTML = originalContent;
      exportChatBtn.disabled = false;
    });
  });
}