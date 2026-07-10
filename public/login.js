// ==========================================
// 1. CENTRALIZED THEME TOGGLE (LOGIN)
// ==========================================
const loginThemeToggleBtn = document.getElementById('loginThemeToggle');
const loginThemeIcon = document.getElementById('loginThemeIcon');
const htmlElement = document.documentElement;

const moonIcon = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
const sunIcon = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';

// Initialize Icon based on current theme
const currentTheme = htmlElement.getAttribute('data-theme') || 'dark';
if (loginThemeIcon) {
  loginThemeIcon.innerHTML = currentTheme === 'light' ? moonIcon : sunIcon;
}

if (loginThemeToggleBtn) {
  loginThemeToggleBtn.addEventListener('click', () => {
    const theme = htmlElement.getAttribute('data-theme');
    const newTheme = theme === 'light' ? 'dark' : 'light';
    
    htmlElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('rag-app-theme', newTheme); // Save global preference for login screen
    
    if (loginThemeIcon) {
      loginThemeIcon.innerHTML = newTheme === 'light' ? moonIcon : sunIcon;
    }
  });
}


// ==========================================
// 2. AUTHENTICATION & LOGIN LOGIC
// ==========================================
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('emailInput').value.trim();
  const password = document.getElementById('passwordInput').value.trim();
  const errorBox = document.getElementById('errorBox');
  const loginBtn = document.getElementById('loginBtn');

  // Reset UI
  errorBox.style.display = 'none';
  loginBtn.innerHTML = 'Authenticating...';
  loginBtn.disabled = true;

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed. Please verify your credentials.');
    }

    // ✅ SAVE DATA SECURELY TO LOCAL STORAGE
    localStorage.setItem('nexus_token', data.token);
    localStorage.setItem('nexus_role', data.role);
    localStorage.setItem('nexus_email', data.email);
    localStorage.setItem('pdf-rag-user-id', data.userId); 

    // ✅ SMART THEME SYNC: Save login page theme to user's profile on first login
    if (!localStorage.getItem(`nexus_theme_${data.userId}`)) {
        localStorage.setItem(`nexus_theme_${data.userId}`, htmlElement.getAttribute('data-theme'));
    }

    // ✅ ROLE-BASED REDIRECTION
    loginBtn.innerHTML = 'Access Granted';
    loginBtn.style.background = 'var(--status-success)';
    
    setTimeout(() => {
      // Using replace() instead of href so users can't click 'Back' to go to login page
      if (data.role === 'admin') {
        window.location.replace('/admin.html');
      } else {
        window.location.replace('/'); 
      }
    }, 800);

  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.style.display = 'block';
    loginBtn.innerHTML = 'Authenticate Securely';
    loginBtn.disabled = false;
  }
});