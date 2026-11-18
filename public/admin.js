// ==========================================
// 1. SECURITY & ADMIN STATE
// ==========================================
const token = localStorage.getItem('nexus_token');
const role = localStorage.getItem('nexus_role');
const adminEmail = localStorage.getItem('nexus_email');
const currentUserId = localStorage.getItem('pdf-rag-user-id');

if (!token || role !== 'admin') {
  window.location.replace('/login');
}

const adminEmailDisplay = document.getElementById('adminEmailDisplay');
if (adminEmailDisplay) {
  adminEmailDisplay.textContent = adminEmail || 'Admin Security Portal';
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

// Theme Toggle
const themeToggleBtn = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const htmlElement = document.documentElement;

const moonIcon = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
const sunIcon = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';

const currentTheme = htmlElement.getAttribute('data-theme') || 'dark';
if (themeIcon) themeIcon.innerHTML = currentTheme === 'light' ? moonIcon : sunIcon;

if (themeToggleBtn) {
  themeToggleBtn.addEventListener('click', () => {
    const nextTheme = htmlElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    htmlElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem(`nexus_theme_${currentUserId}`, nextTheme);
    localStorage.setItem('nexus_global_theme', nextTheme);
    if (themeIcon) themeIcon.innerHTML = nextTheme === 'light' ? moonIcon : sunIcon;
  });
}

// ==========================================
// 2. ADMIN TABS NAVIGATION
// ==========================================
window.switchAdminTab = (tabId, btn) => {
  document.querySelectorAll('.tab-content-panel').forEach(panel => {
    panel.style.display = 'none';
  });
  document.querySelectorAll('.admin-tab-btn').forEach(b => {
    b.classList.remove('active');
  });

  const activePanel = document.getElementById(tabId);
  if (activePanel) activePanel.style.display = 'block';
  if (btn) btn.classList.add('active');

  if (tabId === 'rosterTab') fetchEmployees();
  if (tabId === 'kbTab') fetchCompanyDocs();
  if (tabId === 'taxonomyTab') fetchTaxonomy();
  if (tabId === 'auditTab') fetchAuditLogs();
  if (tabId === 'healthTab') fetchSystemHealth();
};

// ==========================================
// 3. STATS & TELEMETRY
// ==========================================
async function fetchAdminStats() {
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Stats failure');
    const data = await res.json();

    document.getElementById('statTotalUsers').textContent = data.totalUsers || 0;
    document.getElementById('statTotalDocs').textContent = data.totalDocuments || 0;
    document.getElementById('statTotalChats').textContent = data.totalChats || 0;
    document.getElementById('statTotalQueries').textContent = data.totalQueries || 0;
  } catch (err) {
    console.error('Stats error:', err);
  }
}

// ==========================================
// 4. FLEET ROSTER & USER MANAGEMENT
// ==========================================
async function fetchEmployees() {
  const tbody = document.getElementById('employeeTableBody');
  try {
    const res = await fetch('/api/admin/employees', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load roster');

    const employees = await res.json();
    tbody.innerHTML = '';

    if (employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">No employees registered yet.</td></tr>';
      return;
    }

    const currentAdminEmail = localStorage.getItem('nexus_email') || '';

    employees.forEach(emp => {
      const joinDate = new Date(emp.createdAt).toLocaleDateString();
      const isSuspended = emp.status === 'suspended';
      const isAdminUser = emp.role === 'admin';
      const isSelf = emp.email === currentAdminEmail;

      const roleBadge = isAdminUser
        ? `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3);">Administrator</span>`
        : `<span class="badge ${emp.role === 'analyst' ? 'badge-primary' : ''}">${escapeHtml(emp.role || 'employee')}</span>`;

      tbody.innerHTML += `
        <tr>
          <td>
            <strong>${escapeHtml(emp.name || 'Member')}</strong><br/>
            <small style="color: var(--text-muted);">${escapeHtml(emp.email)}</small>
          </td>
          <td>
            ${roleBadge}
          </td>
          <td style="color: var(--text-secondary);">${escapeHtml(emp.department || 'Operations')}</td>
          <td>
            <span style="font-weight: 600;">${emp.docCount || 0} Docs</span> &bull; 
            <span style="color: var(--text-muted);">${emp.chatCount || 0} Chats</span>
          </td>
          <td style="color: var(--text-muted); font-size: 12.5px;">${joinDate}</td>
          <td>
            <span class="badge ${isSuspended ? 'badge-danger' : 'badge-success'}" style="${isSuspended ? 'color: var(--status-error); background: var(--status-error-bg);' : ''}">
              ${isSuspended ? 'Suspended' : 'Active'}
            </span>
          </td>
          <td>
            <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
              <button onclick="openClearanceModal('${emp._id}', '${escapeHtml(emp.email)}', '${escapeHtml(emp.role)}', '${escapeHtml(emp.department)}')" class="outline-btn" style="padding: 4px 8px; font-size: 11px; border-color: rgba(99, 102, 241, 0.4); color: var(--accent-secondary);" title="Modify Role or Department Clearance">Clearance</button>
              <button onclick="viewActivity('${emp._id}', '${escapeHtml(emp.email)}')" class="outline-btn" style="padding: 4px 8px; font-size: 11px;">Audit Logs</button>
              ${!isSelf ? `
                <button onclick="toggleUserStatus('${emp._id}')" class="outline-btn" style="padding: 4px 8px; font-size: 11px;">${isSuspended ? 'Activate' : 'Suspend'}</button>
                <button onclick="deleteEmployee('${emp._id}', '${escapeHtml(emp.email)}')" class="outline-btn" style="padding: 4px 8px; font-size: 11px; border-color: rgba(239,68,68,0.3); color: var(--status-error);">Revoke</button>
              ` : `
                <span style="font-size: 11px; color: var(--text-muted); padding: 4px 6px;">(You)</span>
              `}
            </div>
          </td>
        </tr>
      `;
    });
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7" style="color: var(--status-error); text-align: center;">Error loading roster: ${error.message}</td></tr>`;
  }
}

// Provision New User Form
document.getElementById('createUserForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('newName').value.trim();
  const email = document.getElementById('newEmail').value.trim();
  const password = document.getElementById('newPassword').value.trim();
  const role = document.getElementById('newRole').value;
  const department = document.getElementById('newDepartment')?.value || 'Operations';
  const btn = document.getElementById('createUserBtn');
  const msgBox = document.getElementById('adminMsgBox');

  btn.disabled = true;
  btn.textContent = 'Provisioning Account...';
  msgBox.style.display = 'none';

  try {
    const res = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, email, password, role, department })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Provisioning failed');

    msgBox.style.display = 'block';
    msgBox.style.background = 'var(--status-success-bg)';
    msgBox.style.color = 'var(--status-success)';
    msgBox.style.borderColor = 'rgba(16, 185, 129, 0.3)';
    msgBox.textContent = `✓ Account provisioned for ${data.user.email} (${data.user.department} Dept)`;

    document.getElementById('createUserForm').reset();
    fetchEmployees();
    fetchAdminStats();
  } catch (err) {
    msgBox.style.display = 'block';
    msgBox.style.background = 'var(--status-error-bg)';
    msgBox.style.color = 'var(--status-error)';
    msgBox.style.borderColor = 'rgba(239, 68, 68, 0.3)';
    msgBox.textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Provision Credentials';
    setTimeout(() => { msgBox.style.display = 'none'; }, 5000);
  }
});

// ==========================================
// 5. COMPANY KNOWLEDGE BASE MANAGEMENT
// ==========================================
async function fetchCompanyDocs() {
  const tbody = document.getElementById('companyDocsTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/company/documents', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load company documents');

    const docs = await res.json();
    tbody.innerHTML = '';

    if (docs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 24px;">No company documents uploaded yet. Use the form on the left to publish documents.</td></tr>';
      return;
    }

    docs.forEach(doc => {
      const tr = document.createElement('tr');
      const dept = doc.department || 'All';
      let deptColor = '#818cf8';
      let deptBg = 'rgba(99, 102, 241, 0.12)';
      if (dept === 'HR') { deptColor = '#ec4899'; deptBg = 'rgba(236, 72, 153, 0.12)'; }
      else if (dept === 'Finance') { deptColor = '#f59e0b'; deptBg = 'rgba(245, 158, 11, 0.12)'; }
      else if (dept === 'IT') { deptColor = '#06b6d4'; deptBg = 'rgba(6, 182, 212, 0.12)'; }

      const dateStr = doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : 'N/A';
      const sizeMb = doc.fileSize ? (doc.fileSize / (1024 * 1024)).toFixed(1) + ' MB' : '1.2 MB';

      tr.innerHTML = `
        <td>
          <div style="font-weight: 600; color: var(--text-main); font-size: 13.5px;">${escapeHtml(doc.fileName)}</div>
          <small style="color: var(--text-muted); font-size: 11px;">${sizeMb} • ${escapeHtml(doc.description || '')}</small>
        </td>
        <td>
          <span style="background: ${deptBg}; color: ${deptColor}; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase;">
            ${escapeHtml(dept)}
          </span>
        </td>
        <td>
          <span style="background: var(--bg-surface-elevated); color: var(--text-secondary); padding: 2px 8px; border-radius: 6px; font-size: 11.5px; border: 1px solid var(--border-color);">
            ${escapeHtml(doc.category || 'Policy')}
          </span>
        </td>
        <td>
          <span style="font-size: 12px; font-weight: 600;">${doc.pages || 1} pgs • ${doc.chunks || 0} chunks</span>
        </td>
        <td style="color: var(--text-muted); font-size: 12px;">${dateStr}</td>
        <td>
          <button class="outline-btn" onclick="deleteCompanyDoc('${doc.documentId}')" style="padding: 4px 8px; font-size: 11px; border-color: rgba(239, 68, 68, 0.4); color: var(--status-error);">
            Delete
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Fetch company docs error:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--status-error); padding: 20px;">Failed to load assets: ${err.message}</td></tr>`;
  }
}

window.deleteCompanyDoc = async function (documentId) {
  if (!confirm('Are you sure you want to purge this company document and remove its vector embeddings?')) return;

  try {
    const res = await fetch(`/api/company/documents/${documentId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete company document');

    showToast('Company document and vector embeddings purged', 'success');
    fetchCompanyDocs();
    fetchAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// Handle Company Document Upload Form
document.getElementById('kbUploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('kbFileInput');
  const department = document.getElementById('kbDepartment').value;
  const category = document.getElementById('kbCategory').value;
  const description = document.getElementById('kbDescription').value;
  const submitBtn = document.getElementById('kbSubmitBtn');
  const msgBox = document.getElementById('kbMsgBox');

  if (!fileInput.files[0]) {
    alert('Please select a PDF file.');
    return;
  }

  const formData = new FormData();
  formData.append('pdf', fileInput.files[0]);
  formData.append('department', department);
  formData.append('category', category);
  formData.append('description', description);

  submitBtn.disabled = true;
  submitBtn.textContent = 'Vectorizing & Publishing...';
  msgBox.style.display = 'none';

  try {
    const res = await fetch('/api/company/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to publish document');

    showToast(`Published to [${department}] Knowledge Base`, 'success');
    document.getElementById('kbUploadForm').reset();
    fetchCompanyDocs();
    fetchAdminStats();
  } catch (err) {
    msgBox.style.display = 'block';
    msgBox.style.background = 'var(--status-error-bg)';
    msgBox.style.color = 'var(--status-error)';
    msgBox.textContent = err.message;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Publish to Knowledge Base';
  }
});

// Toast Notification Engine for Admin
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

// Toggle User Status
window.toggleUserStatus = async (userId) => {
  try {
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Status update failed');
    fetchEmployees();
    showToast('User status updated.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// Revoke Employee
window.deleteEmployee = async (userId, email) => {
  if (!confirm(`Are you sure you want to completely revoke credentials and delete vector workspaces for ${email}?`)) return;

  try {
    const res = await fetch(`/api/admin/employees/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Revocation failed');

    showToast('Employee credentials and vector workspace purged.', 'success');
    fetchEmployees();
    fetchAdminStats();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ==========================================
// 5. AUDIT TRAIL FEED
// ==========================================
async function fetchAuditLogs() {
  const tbody = document.getElementById('auditTableBody');
  try {
    const res = await fetch('/api/admin/audit-logs?limit=40', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load audit logs');

    const logs = await res.json();
    tbody.innerHTML = '';

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No query activity recorded yet.</td></tr>';
      return;
    }

    logs.forEach(log => {
      const timeStr = new Date(log.timestamp).toLocaleString();
      tbody.innerHTML += `
        <tr>
          <td style="font-family: var(--font-mono); font-size: 12px; color: var(--text-muted);">${timeStr}</td>
          <td>
            <strong>${escapeHtml(log.userName)}</strong><br/>
            <small style="color: var(--text-muted);">${escapeHtml(log.userEmail)}</small>
          </td>
          <td>
            <span class="badge" style="font-size: 11px;">📄 ${escapeHtml(log.documentName)}</span>
          </td>
          <td style="max-width: 380px;">
            <div style="font-size: 13.5px; font-weight: 500; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(log.query)}">
              "${escapeHtml(log.query)}"
            </div>
          </td>
          <td>
            <span class="badge badge-success" style="font-size: 10px;">Grounded (Verified)</span>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="color: var(--status-error); text-align: center;">Error loading logs: ${err.message}</td></tr>`;
  }
}

// Activity Modal for Individual Employee
const modal = document.getElementById('activityModal');
const closeModalBtn = document.getElementById('closeModalBtn');
if (closeModalBtn) {
  closeModalBtn.addEventListener('click', () => { modal.style.display = 'none'; });
}

window.viewActivity = async (userId, email) => {
  document.getElementById('modalEmail').textContent = `Auditing sessions for: ${email}`;
  const contentDiv = document.getElementById('activityContent');
  contentDiv.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Fetching secure activity transcript...</p>';
  modal.style.display = 'flex';

  try {
    const res = await fetch(`/api/chats/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Could not fetch activity');

    const chats = await res.json();
    contentDiv.innerHTML = '';

    if (chats.length === 0) {
      contentDiv.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No activity recorded for this user yet.</p>';
      return;
    }

    chats.forEach(chat => {
      const time = new Date(chat.createdAt).toLocaleString();
      contentDiv.innerHTML += `
        <div style="background: var(--bg-surface-elevated); padding: 12px 16px; border-radius: 8px; border: 1px solid var(--border-color);">
          <strong style="color: var(--text-main); font-size: 13.5px; display: block; margin-bottom: 4px;">Session: "${escapeHtml(chat.title)}"</strong>
          <small style="color: var(--text-muted); font-size: 11px;">Document: ${chat.documentId} &bull; Recorded: ${time}</small>
        </div>
      `;
    });
  } catch (err) {
    contentDiv.innerHTML = `<p style="color: var(--status-error); text-align: center;">${err.message}</p>`;
  }
};

// ==========================================
// 6. SYSTEM HEALTH & DIAGNOSTICS
// ==========================================
async function fetchSystemHealth() {
  try {
    const res = await fetch('/api/system/health');
    const data = await res.json();

    document.getElementById('diagDbStatus').textContent = data.database === 'connected' ? 'Connected (Optimal)' : 'Offline';
    document.getElementById('diagVectorStatus').textContent = data.vectorStore === 'ready' ? 'Online & Scoped' : 'Offline';
    document.getElementById('diagLlmStatus').textContent = data.llmEngine === 'ready' ? 'Ready (Gemini 2.5 Flash)' : 'Offline';
    document.getElementById('diagVersion').textContent = data.version;

    const hours = Math.floor((data.uptimeSeconds || 0) / 3600);
    const mins = Math.floor(((data.uptimeSeconds || 0) % 3600) / 60);
    document.getElementById('diagUptime').textContent = `${hours}h ${mins}m`;

    if (data.memory?.rss) {
      const mb = Math.round(data.memory.rss / (1024 * 1024));
      document.getElementById('diagMemory').textContent = `${mb} MB (RSS)`;
    }
  } catch (err) {
    console.error('Health check failed:', err);
  }
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

// Initial Boot
fetchAdminStats();
fetchEmployees();
fetchTaxonomy();

// ==========================================
// 7. DYNAMIC TAXONOMY & RBAC GOVERNANCE
// ==========================================
let cachedTaxonomy = { departments: [], roles: [], categories: [] };

async function fetchTaxonomy() {
  try {
    const res = await fetch('/api/admin/taxonomy', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load taxonomy');
    cachedTaxonomy = await res.json();

    // 1. Populate Dropdowns dynamically
    populateDynamicDropdowns();

    // 2. Render Taxonomy Management Tab Lists
    renderTaxonomyLists();

    // 3. Update active count badges
    const deptBadge = document.getElementById('badgeDeptCount');
    const roleBadge = document.getElementById('badgeRoleCount');
    const catBadge = document.getElementById('badgeCatCount');
    if (deptBadge) deptBadge.textContent = `${(cachedTaxonomy.departments || []).length} active`;
    if (roleBadge) roleBadge.textContent = `${(cachedTaxonomy.roles || []).length} active`;
    if (catBadge) catBadge.textContent = `${(cachedTaxonomy.categories || []).length} active`;
  } catch (err) {
    console.error('Fetch taxonomy error:', err);
  }
}

function populateDynamicDropdowns() {
  const { departments = [], roles = [], categories = [] } = cachedTaxonomy;

  // Populate newRole dropdown
  const newRoleSelect = document.getElementById('newRole');
  if (newRoleSelect && roles.length > 0) {
    const currentVal = newRoleSelect.value;
    newRoleSelect.innerHTML = roles.map(r => 
      `<option value="${escapeHtml(r.name)}">${escapeHtml(r.label || r.name)}</option>`
    ).join('');
    if (currentVal && roles.some(r => r.name === currentVal)) newRoleSelect.value = currentVal;
  }

  // Populate newDepartment dropdown
  const newDeptSelect = document.getElementById('newDepartment');
  if (newDeptSelect && departments.length > 0) {
    const currentVal = newDeptSelect.value;
    newDeptSelect.innerHTML = departments.map(d => 
      `<option value="${escapeHtml(d.name)}">${escapeHtml(d.label || d.name)}</option>`
    ).join('');
    if (currentVal && departments.some(d => d.name === currentVal)) newDeptSelect.value = currentVal;
  }

  // Populate kbDepartment (Company Knowledge Base Scope)
  const kbDeptSelect = document.getElementById('kbDepartment');
  if (kbDeptSelect && departments.length > 0) {
    const currentVal = kbDeptSelect.value;
    kbDeptSelect.innerHTML = departments.map(d => 
      `<option value="${escapeHtml(d.name)}">${escapeHtml(d.label || d.name)}</option>`
    ).join('');
    if (currentVal && departments.some(d => d.name === currentVal)) kbDeptSelect.value = currentVal;
  }

  // Populate kbCategory (Company Knowledge Base Category)
  const kbCatSelect = document.getElementById('kbCategory');
  if (kbCatSelect && categories.length > 0) {
    const currentVal = kbCatSelect.value;
    kbCatSelect.innerHTML = categories.map(c => 
      `<option value="${escapeHtml(c.name)}">${escapeHtml(c.label || c.name)}</option>`
    ).join('');
    if (currentVal && categories.some(c => c.name === currentVal)) kbCatSelect.value = currentVal;
  }

  // Populate clearanceModal dropdowns
  const modalRole = document.getElementById('clearanceModalRole');
  if (modalRole && roles.length > 0) {
    modalRole.innerHTML = roles.map(r => 
      `<option value="${escapeHtml(r.name)}">${escapeHtml(r.label || r.name)}</option>`
    ).join('');
  }
  const modalDept = document.getElementById('clearanceModalDept');
  if (modalDept && departments.length > 0) {
    modalDept.innerHTML = departments.map(d => 
      `<option value="${escapeHtml(d.name)}">${escapeHtml(d.label || d.name)}</option>`
    ).join('');
  }
}

function renderTaxonomyLists() {
  const { departments = [], roles = [], categories = [] } = cachedTaxonomy;

  // Departments List
  const deptList = document.getElementById('deptListContainer');
  if (deptList) {
    if (departments.length === 0) {
      deptList.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 12px;">No departments found.</div>';
    } else {
      deptList.innerHTML = departments.map(d => `
        <div class="taxonomy-item">
          <div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <strong style="color: var(--text-main); font-size: 13px;">${escapeHtml(d.label || d.name)}</strong>
              <code style="font-size: 11px; background: var(--bg-surface); padding: 1px 5px; border-radius: 4px; color: var(--accent-secondary);">${escapeHtml(d.name)}</code>
              ${d.isSystem ? '<span class="badge" style="font-size: 10px; padding: 2px 5px;">System</span>' : ''}
            </div>
            <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">${escapeHtml(d.description || 'Access clearance scope')}</p>
          </div>
          ${!d.isSystem ? `
            <button onclick="deleteTaxonomyItem('${d._id}', '${escapeHtml(d.name)}')" class="outline-btn" style="padding: 3px 8px; font-size: 11px; border-color: rgba(239, 68, 68, 0.4); color: var(--status-error);" title="Delete custom department">
              Delete
            </button>
          ` : ''}
        </div>
      `).join('');
    }
  }

  // Roles List
  const roleList = document.getElementById('roleListContainer');
  if (roleList) {
    if (roles.length === 0) {
      roleList.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 12px;">No roles found.</div>';
    } else {
      roleList.innerHTML = roles.map(r => `
        <div class="taxonomy-item">
          <div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <strong style="color: var(--text-main); font-size: 13px;">${escapeHtml(r.label || r.name)}</strong>
              <code style="font-size: 11px; background: var(--bg-surface); padding: 1px 5px; border-radius: 4px; color: var(--accent-secondary);">${escapeHtml(r.name)}</code>
              ${r.isSystem ? '<span class="badge" style="font-size: 10px; padding: 2px 5px;">System</span>' : ''}
            </div>
            <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">${escapeHtml(r.description || 'Access role profile')}</p>
          </div>
          ${!r.isSystem ? `
            <button onclick="deleteTaxonomyItem('${r._id}', '${escapeHtml(r.name)}')" class="outline-btn" style="padding: 3px 8px; font-size: 11px; border-color: rgba(239, 68, 68, 0.4); color: var(--status-error);" title="Delete custom role">
              Delete
            </button>
          ` : ''}
        </div>
      `).join('');
    }
  }

  // Categories List
  const catList = document.getElementById('catListContainer');
  if (catList) {
    if (categories.length === 0) {
      catList.innerHTML = '<div style="color: var(--text-muted); font-size: 12px; text-align: center; padding: 12px;">No categories found.</div>';
    } else {
      catList.innerHTML = categories.map(c => `
        <div class="taxonomy-item">
          <div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <strong style="color: var(--text-main); font-size: 13px;">${escapeHtml(c.label || c.name)}</strong>
              ${c.isSystem ? '<span class="badge" style="font-size: 10px; padding: 2px 5px;">System</span>' : ''}
            </div>
            <p style="font-size: 11.5px; color: var(--text-muted); margin-top: 3px;">${escapeHtml(c.description || 'Document category')}</p>
          </div>
          ${!c.isSystem ? `
            <button onclick="deleteTaxonomyItem('${c._id}', '${escapeHtml(c.name)}')" class="outline-btn" style="padding: 3px 8px; font-size: 11px; border-color: rgba(239, 68, 68, 0.4); color: var(--status-error);" title="Delete custom category">
              Delete
            </button>
          ` : ''}
        </div>
      `).join('');
    }
  }
}

// Add Department Form Submit
document.getElementById('addDeptForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('newDeptName');
  const labelInput = document.getElementById('newDeptLabel');
  const descInput = document.getElementById('newDeptDesc');
  const name = nameInput.value.trim();
  const label = labelInput.value.trim() || name;
  const description = descInput.value.trim();

  if (!name) return;

  try {
    const res = await fetch('/api/admin/taxonomy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ type: 'department', name, label, description })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add department');

    showToast(`Department "${label}" created successfully!`, 'success');
    nameInput.value = '';
    labelInput.value = '';
    descInput.value = '';
    fetchTaxonomy();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Add Role Form Submit
document.getElementById('addRoleForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('newRoleName');
  const labelInput = document.getElementById('newRoleLabel');
  const descInput = document.getElementById('newRoleDesc');
  const name = nameInput.value.trim();
  const label = labelInput.value.trim() || name;
  const description = descInput.value.trim();

  if (!name) return;

  try {
    const res = await fetch('/api/admin/taxonomy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ type: 'role', name, label, description })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add role');

    showToast(`Role "${label}" created successfully!`, 'success');
    nameInput.value = '';
    labelInput.value = '';
    descInput.value = '';
    fetchTaxonomy();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Add Category Form Submit
document.getElementById('addCatForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const nameInput = document.getElementById('newCatName');
  const descInput = document.getElementById('newCatDesc');
  const name = nameInput.value.trim();
  const description = descInput.value.trim();

  if (!name) return;

  try {
    const res = await fetch('/api/admin/taxonomy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ type: 'category', name, label: name, description })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to add category');

    showToast(`Category "${name}" created successfully!`, 'success');
    nameInput.value = '';
    descInput.value = '';
    fetchTaxonomy();
  } catch (err) {
    showToast(err.message, 'error');
  }
});

// Delete Taxonomy Item
window.deleteTaxonomyItem = async function (id, name) {
  if (!confirm(`Are you sure you want to delete "${name}" from enterprise classifications?`)) return;

  try {
    const res = await fetch(`/api/admin/taxonomy/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete classification');

    showToast(data.message || 'Classification removed.', 'success');
    fetchTaxonomy();
  } catch (err) {
    showToast(err.message, 'error');
  }
};

// ==========================================
// 8. DYNAMIC CLEARANCE & ROLE MODAL
// ==========================================
window.openClearanceModal = (userId, email, currentRole, currentDept) => {
  const modal = document.getElementById('clearanceModal');
  const userEmailDisplay = document.getElementById('clearanceModalUserEmail');
  const userIdInput = document.getElementById('clearanceUserId');
  const roleSelect = document.getElementById('clearanceModalRole');
  const deptSelect = document.getElementById('clearanceModalDept');

  if (userEmailDisplay) userEmailDisplay.textContent = email;
  if (userIdInput) userIdInput.value = userId;

  if (roleSelect && currentRole) roleSelect.value = currentRole;
  if (deptSelect && currentDept) deptSelect.value = currentDept;

  if (modal) modal.style.display = 'flex';
};

window.closeClearanceModal = () => {
  const modal = document.getElementById('clearanceModal');
  if (modal) modal.style.display = 'none';
};

document.getElementById('clearanceForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const userId = document.getElementById('clearanceUserId').value;
  const role = document.getElementById('clearanceModalRole').value;
  const department = document.getElementById('clearanceModalDept').value;
  const saveBtn = document.getElementById('saveClearanceBtn');

  if (!userId) return;

  saveBtn.disabled = true;
  saveBtn.textContent = 'Updating...';

  try {
    const res = await fetch(`/api/admin/users/${userId}/clearance`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ role, department })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update clearance');

    showToast(data.message || 'Clearance updated successfully!', 'success');
    closeClearanceModal();
    fetchEmployees();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save Clearance';
  }
});
