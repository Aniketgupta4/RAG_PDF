// ==========================================
// 1. THEME TOGGLE (LOGIN)
// ==========================================
const loginThemeToggleBtn = document.getElementById('loginThemeToggle');
const loginThemeIcon = document.getElementById('loginThemeIcon');
const htmlElement = document.documentElement;

const moonIcon = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
const sunIcon = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';

const currentTheme = htmlElement.getAttribute('data-theme') || 'dark';
if (loginThemeIcon) {
  loginThemeIcon.innerHTML = currentTheme === 'light' ? moonIcon : sunIcon;
}

if (loginThemeToggleBtn) {
  loginThemeToggleBtn.addEventListener('click', () => {
    const theme = htmlElement.getAttribute('data-theme');
    const newTheme = theme === 'light' ? 'dark' : 'light';
    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('nexus_global_theme', newTheme);
    if (loginThemeIcon) {
      loginThemeIcon.innerHTML = newTheme === 'light' ? moonIcon : sunIcon;
    }
  });
}

// Password Visibility Toggle
const togglePasswordBtn = document.getElementById('togglePasswordBtn');
const passwordInput = document.getElementById('passwordInput');
if (togglePasswordBtn && passwordInput) {
  togglePasswordBtn.addEventListener('click', () => {
    const isPass = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isPass ? 'text' : 'password');
    togglePasswordBtn.textContent = isPass ? 'Hide' : 'Show';
  });
}

// ==========================================
// 2. ALERTS & NOTIFICATIONS
// ==========================================
const loginForm = document.getElementById('loginForm');
const authAlert = document.getElementById('authAlert');

function showAlert(message, type = 'error') {
  if (!authAlert) return;
  authAlert.textContent = message;
  authAlert.className = `auth-alert ${type}`;
  authAlert.style.display = 'block';
}

function clearAlert() {
  if (!authAlert) return;
  authAlert.style.display = 'none';
  authAlert.textContent = '';
}

// ==========================================
// 3. SESSION PERSISTENCE & ROUTING
// ==========================================
function saveSessionAndRedirect(data) {
  localStorage.setItem('nexus_token', data.token);
  localStorage.setItem('nexus_role', data.role);
  localStorage.setItem('nexus_email', data.email);
  localStorage.setItem('nexus_name', data.name || 'User');
  localStorage.setItem('nexus_department', data.department || 'Operations');
  localStorage.setItem('pdf-rag-user-id', data.userId);
  localStorage.setItem(`nexus_theme_${data.userId}`, htmlElement.getAttribute('data-theme') || 'dark');

  if (data.role === 'admin') {
    window.location.replace('/admin.html');
  } else {
    window.location.replace('/app');
  }
}

// ==========================================
// 4. SIGN IN FORM SUBMISSION
// ==========================================
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearAlert();

  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value.trim();
  const loginBtn = document.getElementById('loginBtn');

  if (!email || !password) {
    showAlert('Please enter your corporate email and password.');
    return;
  }

  const originalBtnHtml = loginBtn.innerHTML;
  loginBtn.innerHTML = '<span>Verifying Credentials...</span>';
  loginBtn.disabled = true;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Authentication rejected. Verify your email and password.');
    }

    loginBtn.innerHTML = '<span>Access Verified &rarr;</span>';
    loginBtn.style.background = 'var(--status-success)';
    showAlert('Authentication successful. Redirecting to workspace...', 'success');

    setTimeout(() => {
      saveSessionAndRedirect(data);
    }, 500);
  } catch (err) {
    showAlert(err.message, 'error');
    loginBtn.innerHTML = originalBtnHtml;
    loginBtn.disabled = false;
  }
});
