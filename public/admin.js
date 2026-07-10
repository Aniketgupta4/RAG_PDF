// ==========================================
// 1. SECURITY & INITIAL SETUP
// ==========================================
const token = localStorage.getItem('nexus_token');
const role = localStorage.getItem('nexus_role');
const adminEmail = localStorage.getItem('nexus_email');

if (!token || role !== 'admin') {
  window.location.replace('/login.html');
}

document.getElementById('adminEmailDisplay').textContent = adminEmail || 'Admin';

// ==========================================
// 2. FETCH EMPLOYEES & RENDER TABLE (Fixed 5 Columns)
// ==========================================
async function fetchEmployees() {
  try {
    const response = await fetch('/api/admin/employees', {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Failed to fetch employees');
    
    const employees = await response.json();
    const tbody = document.getElementById('employeeTableBody');
    tbody.innerHTML = ''; 

    if (employees.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No employees found.</td></tr>';
      return;
    }

    employees.forEach(emp => {
      const date = new Date(emp.createdAt).toLocaleDateString();
      // Yahan 5th <td> add kiya gaya hai jisme buttons hain
      tbody.innerHTML += `
        <tr>
          <td style="font-family: monospace; font-size: 12px; color: var(--text-muted);">${emp._id}</td>
          <td style="font-weight: 500;">${emp.email}</td>
          <td><span class="role-badge">${emp.role}</span></td>
          <td>${date}</td>
          <td style="display: flex; gap: 8px;">
            <button onclick="viewActivity('${emp._id}', '${emp.email}')" class="primary-btn" style="padding: 6px 12px; font-size: 11px;">Activity</button>
            <button onclick="deleteEmployee('${emp._id}')" class="outline-btn" style="padding: 6px 12px; font-size: 11px; border-color: #ef4444; color: #ef4444;">Revoke</button>
          </td>
        </tr>
      `;
    });
  } catch (error) {
    console.error(error);
  }
}

// Initial fetch when page loads
fetchEmployees();

// ==========================================
// 3. CREATE NEW EMPLOYEE
// ==========================================
document.getElementById('createUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('newEmail').value.trim();
  const password = document.getElementById('newPassword').value.trim();
  const btn = document.getElementById('createUserBtn');
  const msgBox = document.getElementById('adminMsgBox');

  btn.disabled = true;
  btn.textContent = 'Processing...';

  try {
    const response = await fetch('/api/admin/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) throw new Error(data.error || 'Failed to create user');

    msgBox.style.display = 'block';
    msgBox.style.background = 'rgba(16,185,129,0.1)';
    msgBox.style.color = '#10b981';
    msgBox.style.borderColor = '#10b981';
    msgBox.textContent = `Success: Employee created!`;

    document.getElementById('createUserForm').reset();
    fetchEmployees(); // Refresh table
  } catch (error) {
    msgBox.style.display = 'block';
    msgBox.style.background = 'rgba(239, 68, 68, 0.1)';
    msgBox.style.color = '#ef4444';
    msgBox.style.borderColor = '#ef4444';
    msgBox.textContent = error.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
    setTimeout(() => { msgBox.style.display = 'none'; }, 4000);
  }
});

// ==========================================
// 4. REVOKE (DELETE) EMPLOYEE
// ==========================================
window.deleteEmployee = async function(userId) {
  if (!confirm("Are you sure you want to completely revoke this employee's access?")) return;

  try {
    const response = await fetch(`/api/admin/employees/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      alert("Employee access revoked.");
      fetchEmployees(); 
    } else {
      const data = await response.json();
      alert(data.error || "Failed to revoke access.");
    }
  } catch (error) {
    console.error(error);
    alert("Error communicating with server.");
  }
};

// ==========================================
// 5. VIEW ACTIVITY (MODAL)
// ==========================================
const modal = document.getElementById('activityModal');
const closeModalBtn = document.getElementById('closeModalBtn');

if (closeModalBtn) {
  closeModalBtn.addEventListener('click', () => { modal.style.display = 'none'; });
}

window.viewActivity = async function(userId, email) {
  document.getElementById('modalEmail').textContent = `Auditing: ${email}`;
  const contentDiv = document.getElementById('activityContent');
  contentDiv.innerHTML = '<p style="color: var(--text-muted); text-align: center;">Fetching secure logs...</p>';
  modal.style.display = 'flex'; 

  try {
    const response = await fetch(`/api/chats/${userId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error("Could not fetch logs");
    
    const chats = await response.json();
    contentDiv.innerHTML = '';

    if (chats.length === 0) {
      contentDiv.innerHTML = '<p style="color: var(--text-muted); text-align: center;">No activity recorded yet.</p>';
      return;
    }

    chats.forEach(chat => {
      const time = new Date(chat.createdAt).toLocaleString();
      contentDiv.innerHTML += `
        <div class="audit-card">
          <strong>Query: "${chat.title}"</strong>
          <small>Document ID: ${chat.documentId} &bull; Time: ${time}</small>
        </div>
      `;
    });
  } catch (error) {
    contentDiv.innerHTML = '<p style="color: #ef4444; text-align: center;">Error loading logs.</p>';
  }
};

// ==========================================
// 6. PER-USER THEME TOGGLE (Admin)
// ==========================================
const themeToggleBtn = document.getElementById('themeToggle');
const htmlElement = document.documentElement;
const currentUserId = localStorage.getItem('pdf-rag-user-id');

if (themeToggleBtn && currentUserId) {
  themeToggleBtn.addEventListener('click', () => {
    const currentTheme = htmlElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    htmlElement.setAttribute('data-theme', newTheme);
    
    // Save theme specific to THIS user's ID
    localStorage.setItem(`nexus_theme_${currentUserId}`, newTheme);
  });
}