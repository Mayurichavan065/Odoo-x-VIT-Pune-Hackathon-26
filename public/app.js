/* ═══════════════════════════════════════════════
   ReimburseFlow — Frontend Application
   SPA with router, auth, and all screens
   ═══════════════════════════════════════════════ */

const API = '';
let currentUser = null;
let authToken = localStorage.getItem('rf_token');

// ─── API Helper ───
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API}${path}`, { ...options, headers: { ...headers, ...options.headers } });
  if (res.status === 401 || res.status === 403) { logout(); return null; }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

async function apiUpload(path, formData) {
  const headers = {};
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: formData });
  return res.json();
}

// ─── Toast Notifications ───
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) { container = document.createElement('div'); container.className = 'toast-container'; document.body.appendChild(container); }
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(30px)'; setTimeout(() => toast.remove(), 300); }, 3500);
}

// ─── Format Helpers ───
function formatCurrency(amount, currency = 'USD') {
  const symbols = { USD: '$', EUR: '€', GBP: '£', INR: '₹', JPY: '¥', CAD: 'C$', AUD: 'A$', CHF: 'CHF', CNY: '¥', SGD: 'S$' };
  return `${symbols[currency] || '$'}${parseFloat(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitials(name) {
  return (name || '??').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function getStatusLabel(status) {
  const labels = { draft: 'Draft', pending: 'Pending', in_review: 'In Review', approved: 'Approved', rejected: 'Rejected', paid: 'Paid' };
  return labels[status] || status;
}

const categoryIcons = { Travel: '✈️', Meals: '🍽️', Supplies: '📦', Equipment: '💻', Accommodation: '🏨', Other: '📋' };

// ─── Router ───
let currentPage = 'dashboard';

function navigate(page) {
  currentPage = page;
  render();
}

// ─── Auth ───
function logout() {
  localStorage.removeItem('rf_token');
  authToken = null;
  currentUser = null;
  render();
}

async function checkAuth() {
  if (!authToken) return false;
  try {
    currentUser = await api('/api/auth/me');
    return !!currentUser;
  } catch { logout(); return false; }
}

// ─── Main Render ───
async function render() {
  const app = document.getElementById('app');
  if (!authToken || !currentUser) {
    app.innerHTML = renderAuthPage();
    bindAuthEvents();
    return;
  }
  app.innerHTML = `
    <div class="app-layout">
      ${renderSidebar()}
      <main class="main-content" id="mainContent"></main>
    </div>
  `;
  bindSidebarEvents();
  await renderPage();
}

async function renderPage() {
  const main = document.getElementById('mainContent');
  if (!main) return;
  main.innerHTML = '<div class="loading-page"><div class="spinner"></div><span>Loading...</span></div>';

  try {
    switch (currentPage) {
      case 'dashboard': main.innerHTML = await renderDashboard(); bindDashboardEvents(); break;
      case 'expenses': main.innerHTML = await renderExpenses(); bindExpenseEvents(); break;
      case 'new-expense': main.innerHTML = await renderNewExpense(); bindNewExpenseEvents(); break;
      case 'approvals': main.innerHTML = await renderApprovals(); bindApprovalEvents(); break;
      case 'users': main.innerHTML = await renderUsers(); bindUserEvents(); break;
      case 'rules': main.innerHTML = await renderRules(); bindRuleEvents(); break;
      case 'history': main.innerHTML = await renderHistory(); break;
      default: main.innerHTML = await renderDashboard(); bindDashboardEvents();
    }
  } catch (err) {
    console.error(err);
    main.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><div class="empty-state-text">Something went wrong</div><div class="empty-state-hint">${err.message}</div></div>`;
  }
}

// ═══════ AUTH PAGE ═══════
function renderAuthPage() {
  return `
    <div class="auth-container">
      <div class="auth-card" id="authCard">
        <div class="auth-logo">
          <div class="auth-logo-icon">💸</div>
          <span class="auth-logo-text">ReimburseFlow</span>
        </div>
        <div id="authContent">${renderLoginForm()}</div>
      </div>
    </div>
  `;
}

function renderLoginForm() {
  return `
    <h1 class="auth-title" id="authTitle">Welcome back</h1>
    <p class="auth-subtitle">Sign in to manage your expenses</p>
    <form id="loginForm">
      <div class="form-group">
        <label class="form-label" for="loginEmail">Email</label>
        <input class="form-input" type="email" id="loginEmail" placeholder="you@company.com" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="loginPassword">Password</label>
        <input class="form-input" type="password" id="loginPassword" placeholder="Enter your password" required>
      </div>
      <button class="btn btn-primary btn-block btn-lg" type="submit" id="loginBtn">Sign In</button>
    </form>
    <p class="text-center text-sm mt-2 text-muted">
      Don't have an account? <a href="#" id="showSignup" class="text-primary" style="text-decoration:none;font-weight:600;">Sign up</a>
    </p>
  `;
}

function renderSignupForm() {
  return `
    <h1 class="auth-title" id="authTitle">Create your account</h1>
    <p class="auth-subtitle">Get started with ReimburseFlow</p>
    <form id="signupForm">
      <div class="form-group">
        <label class="form-label" for="signupName">Full Name</label>
        <input class="form-input" type="text" id="signupName" placeholder="John Doe" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="signupEmail">Email</label>
        <input class="form-input" type="email" id="signupEmail" placeholder="you@company.com" required>
      </div>
      <div class="form-group">
        <label class="form-label" for="signupPassword">Password</label>
        <input class="form-input" type="password" id="signupPassword" placeholder="Min 6 characters" required minlength="6">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label" for="signupCompany">Company Name</label>
          <input class="form-input" type="text" id="signupCompany" placeholder="Acme Corp" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="signupRole">Role</label>
          <select class="form-select" id="signupRole">
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="employee" selected>Employee</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary btn-block btn-lg" type="submit" id="signupBtn">Create Account</button>
    </form>
    <p class="text-center text-sm mt-2 text-muted">
      Already have an account? <a href="#" id="showLogin" class="text-primary" style="text-decoration:none;font-weight:600;">Sign in</a>
    </p>
  `;
}

function bindAuthEvents() {
  const content = document.getElementById('authContent');
  if (!content) return;

  document.getElementById('showSignup')?.addEventListener('click', (e) => {
    e.preventDefault();
    content.innerHTML = renderSignupForm();
    bindAuthEvents();
  });

  document.getElementById('showLogin')?.addEventListener('click', (e) => {
    e.preventDefault();
    content.innerHTML = renderLoginForm();
    bindAuthEvents();
  });

  document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: document.getElementById('loginEmail').value, password: document.getElementById('loginPassword').value })
      });
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('rf_token', authToken);
      showToast(`Welcome back, ${currentUser.full_name}!`, 'success');
      currentPage = 'dashboard';
      render();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Sign In';
    }
  });

  document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('signupBtn');
    btn.disabled = true; btn.textContent = 'Creating account...';
    try {
      const data = await api('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify({
          full_name: document.getElementById('signupName').value,
          email: document.getElementById('signupEmail').value,
          password: document.getElementById('signupPassword').value,
          company_name: document.getElementById('signupCompany').value,
          role: document.getElementById('signupRole').value
        })
      });
      authToken = data.token;
      currentUser = data.user;
      localStorage.setItem('rf_token', authToken);
      showToast(`Welcome, ${currentUser.full_name}! Your company has been set up.`, 'success');
      currentPage = 'dashboard';
      render();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Create Account';
    }
  });
}

// ═══════ SIDEBAR ═══════
function renderSidebar() {
  const isAdmin = currentUser?.role === 'admin';
  const isManager = currentUser?.role === 'manager' || isAdmin;

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="sidebar-logo-icon">💸</div>
        <span class="sidebar-logo-text">ReimburseFlow</span>
      </div>
      <div class="sidebar-section">
        <div class="sidebar-section-title">Main</div>
        <nav class="sidebar-nav">
          <button class="sidebar-link ${currentPage === 'dashboard' ? 'active' : ''}" data-page="dashboard">
            <span class="sidebar-link-icon">📊</span> Dashboard
          </button>
          <button class="sidebar-link ${currentPage === 'expenses' ? 'active' : ''}" data-page="expenses">
            <span class="sidebar-link-icon">💰</span> My Expenses
          </button>
          <button class="sidebar-link ${currentPage === 'new-expense' ? 'active' : ''}" data-page="new-expense">
            <span class="sidebar-link-icon">➕</span> New Expense
          </button>
          ${isManager ? `
            <button class="sidebar-link ${currentPage === 'approvals' ? 'active' : ''}" data-page="approvals">
              <span class="sidebar-link-icon">✅</span> Approvals
              <span class="sidebar-link-badge" id="approvalBadge" style="display:none">0</span>
            </button>
          ` : ''}
        </nav>
      </div>
      ${isAdmin ? `
        <div class="sidebar-section">
          <div class="sidebar-section-title">Admin</div>
          <nav class="sidebar-nav">
            <button class="sidebar-link ${currentPage === 'users' ? 'active' : ''}" data-page="users">
              <span class="sidebar-link-icon">👥</span> Users
            </button>
            <button class="sidebar-link ${currentPage === 'rules' ? 'active' : ''}" data-page="rules">
              <span class="sidebar-link-icon">⚙️</span> Approval Rules
            </button>
          </nav>
        </div>
      ` : ''}
      <div class="sidebar-section">
        <div class="sidebar-section-title">Account</div>
        <nav class="sidebar-nav">
          <button class="sidebar-link ${currentPage === 'history' ? 'active' : ''}" data-page="history">
            <span class="sidebar-link-icon">📜</span> History
          </button>
        </nav>
      </div>
      <div class="sidebar-user">
        <div class="sidebar-avatar" style="background:${currentUser?.avatar_color || '#6366F1'}">${getInitials(currentUser?.full_name)}</div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name">${currentUser?.full_name || 'User'}</div>
          <div class="sidebar-user-role">${currentUser?.role || 'employee'} · ${currentUser?.company_name || ''}</div>
        </div>
        <button class="sidebar-logout" id="logoutBtn" title="Sign out">⏻</button>
      </div>
    </aside>
  `;
}

function bindSidebarEvents() {
  document.querySelectorAll('.sidebar-link[data-page]').forEach(link => {
    link.addEventListener('click', () => navigate(link.dataset.page));
  });
  document.getElementById('logoutBtn')?.addEventListener('click', logout);
  loadApprovalBadge();
}

async function loadApprovalBadge() {
  if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'manager')) return;
  try {
    const pending = await api('/api/approvals/pending');
    const badge = document.getElementById('approvalBadge');
    if (badge && pending.length > 0) { badge.textContent = pending.length; badge.style.display = 'inline'; }
  } catch {}
}

// ═══════ DASHBOARD ═══════
async function renderDashboard() {
  const stats = await api('/api/dashboard/stats');
  const isEmployee = currentUser?.role === 'employee';

  let statsCards;
  if (isEmployee) {
    statsCards = `
      <div class="stat-card stat-card--primary"><div class="stat-icon">💰</div>
        <div class="stat-value">${formatCurrency(stats.total_expenses)}</div>
        <div class="stat-label">Total Submitted</div></div>
      <div class="stat-card stat-card--warning"><div class="stat-icon">⏳</div>
        <div class="stat-value">${stats.pending_count}</div>
        <div class="stat-label">Pending</div></div>
      <div class="stat-card stat-card--success"><div class="stat-icon">✅</div>
        <div class="stat-value">${formatCurrency(stats.approved_amount)}</div>
        <div class="stat-label">Approved</div></div>
      <div class="stat-card stat-card--danger"><div class="stat-icon">❌</div>
        <div class="stat-value">${stats.rejected_count}</div>
        <div class="stat-label">Rejected</div></div>
    `;
  } else {
    statsCards = `
      <div class="stat-card stat-card--primary"><div class="stat-icon">💰</div>
        <div class="stat-value">${formatCurrency(stats.total_expenses)}</div>
        <div class="stat-label">Total Expenses</div></div>
      <div class="stat-card stat-card--warning"><div class="stat-icon">⏳</div>
        <div class="stat-value">${stats.pending_approvals || stats.pending_count}</div>
        <div class="stat-label">Pending Approvals</div></div>
      <div class="stat-card stat-card--success"><div class="stat-icon">✅</div>
        <div class="stat-value">${formatCurrency(stats.approved_amount)}</div>
        <div class="stat-label">Approved This Month</div></div>
      <div class="stat-card stat-card--danger"><div class="stat-icon">📉</div>
        <div class="stat-value">${stats.rejection_rate}%</div>
        <div class="stat-label">Rejection Rate</div></div>
    `;
  }

  let categoriesChart = '';
  if (stats.categories && stats.categories.length > 0) {
    const maxTotal = Math.max(...stats.categories.map(c => c.total));
    const barColors = ['#6366F1', '#10B981', '#F59E0B', '#EC4899', '#06B6D4', '#F97316'];
    categoriesChart = `
      <div class="card">
        <div class="card-header"><div class="card-title">Expenses by Category</div></div>
        ${stats.categories.map((c, i) => `
          <div class="chart-bar-container">
            <div class="chart-bar-label">
              <span>${categoryIcons[c.category] || '📋'} ${c.category}</span>
              <span class="font-bold">${formatCurrency(c.total)} (${c.count})</span>
            </div>
            <div class="chart-bar-track">
              <div class="chart-bar-fill" style="width:${(c.total / maxTotal * 100)}%;background:${barColors[i % barColors.length]}"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  const recentRows = (stats.recent || []).map(e => `
    <tr data-expense-id="${e.id}" class="expense-row">
      <td>
        <div class="flex-center gap-1">
          <div class="avatar avatar-sm" style="background:${e.submitter_color || '#6366F1'}">${getInitials(e.submitter_name || currentUser.full_name)}</div>
          <span>${e.submitter_name || currentUser.full_name}</span>
        </div>
      </td>
      <td class="font-bold">${formatCurrency(e.total_amount, e.currency)}</td>
      <td>${categoryIcons[e.category] || '📋'} ${e.category}</td>
      <td><span class="badge badge--${e.status}"><span class="badge--dot"></span> ${getStatusLabel(e.status)}</span></td>
      <td class="text-muted">${formatDate(e.created_at)}</td>
    </tr>
  `).join('');

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Welcome back, ${currentUser.full_name}</p>
      </div>
      <button class="btn btn-primary" onclick="navigate('new-expense')">➕ New Expense</button>
    </div>
    <div class="stats-grid">${statsCards}</div>
    <div class="chart-grid">
      <div class="table-container">
        <div class="table-header"><span class="table-title">Recent Expenses</span></div>
        ${recentRows ? `
          <table>
            <thead><tr><th>Employee</th><th>Amount</th><th>Category</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>${recentRows}</tbody>
          </table>
        ` : '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">No expenses yet</div></div>'}
      </div>
      ${categoriesChart}
    </div>
  `;
}

function bindDashboardEvents() {
  document.querySelectorAll('.expense-row').forEach(row => {
    row.addEventListener('click', () => showExpenseDetail(row.dataset.expenseId));
  });
}

// ═══════ EXPENSE DETAIL MODAL ═══════
async function showExpenseDetail(expenseId) {
  const expense = await api(`/api/expenses/${expenseId}`);
  if (!expense) return;

  const timeline = (expense.approval_steps || []).map(s => {
    const icons = { pending: '⏳', approved: '✅', rejected: '❌', skipped: '⏭️' };
    return `
      <div class="timeline-step">
        <div class="timeline-dot timeline-dot--${s.status}">${icons[s.status]}</div>
        <div class="timeline-content">
          <div class="timeline-title">${s.approver_name} <span class="badge badge--${s.status}" style="margin-left:0.5rem"><span class="badge--dot"></span> ${getStatusLabel(s.status)}</span></div>
          <div class="timeline-meta">Step ${s.step_order} ${s.decided_at ? '· ' + formatDate(s.decided_at) : ''}</div>
          ${s.comment ? `<div class="timeline-comment">"${s.comment}"</div>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const lineItems = (expense.line_items || []).map(l => `
    <tr><td>${l.description}</td><td>${l.category || '—'}</td><td class="font-bold">${formatCurrency(l.amount)}</td><td class="text-muted">${l.date || '—'}</td></tr>
  `).join('');

  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'expenseModal';
  modal.innerHTML = `
    <div class="modal" style="max-width:700px">
      <div class="modal-header">
        <div>
          <div class="modal-title">${expense.title}</div>
          <div class="text-sm text-muted mt-1">Submitted by ${expense.submitter_name} · ${formatDate(expense.submitted_at || expense.created_at)}</div>
        </div>
        <button class="modal-close" onclick="document.getElementById('expenseModal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="flex-between mb-2">
          <div>
            <span class="text-xs text-muted">TOTAL AMOUNT</span>
            <div style="font-size:1.5rem;font-weight:800;letter-spacing:-0.02em">${formatCurrency(expense.total_amount, expense.currency)}</div>
          </div>
          <span class="badge badge--${expense.status}" style="font-size:0.8rem;padding:0.35rem 0.85rem">
            <span class="badge--dot"></span> ${getStatusLabel(expense.status)}
          </span>
        </div>
        <div class="form-row mb-2">
          <div><span class="text-xs text-muted">CATEGORY</span><div>${categoryIcons[expense.category] || ''} ${expense.category}</div></div>
          <div><span class="text-xs text-muted">CURRENCY</span><div>${expense.currency}</div></div>
        </div>
        ${expense.description ? `<div class="mb-2"><span class="text-xs text-muted">DESCRIPTION</span><div class="text-sm">${expense.description}</div></div>` : ''}
        ${lineItems ? `
          <div class="mb-2">
            <span class="text-xs text-muted">LINE ITEMS</span>
            <table class="mt-1"><thead><tr><th>Description</th><th>Category</th><th>Amount</th><th>Date</th></tr></thead><tbody>${lineItems}</tbody></table>
          </div>
        ` : ''}
        ${timeline ? `<div><span class="text-xs text-muted">APPROVAL TIMELINE</span><div class="timeline mt-1">${timeline}</div></div>` : ''}
      </div>
    </div>
  `;
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ═══════ MY EXPENSES ═══════
async function renderExpenses() {
  const expenses = await api('/api/expenses');
  const rows = expenses.map(e => `
    <tr class="expense-row" data-expense-id="${e.id}">
      <td class="text-muted text-xs">${e.id.slice(0, 8)}</td>
      <td class="font-bold">${e.title}</td>
      <td class="font-bold">${formatCurrency(e.total_amount, e.currency)}</td>
      <td>${categoryIcons[e.category] || '📋'} ${e.category}</td>
      <td><span class="badge badge--${e.status}"><span class="badge--dot"></span> ${getStatusLabel(e.status)}</span></td>
      <td class="text-muted">${formatDate(e.created_at)}</td>
    </tr>
  `).join('');

  const totalSubmitted = expenses.reduce((s, e) => s + (e.total_amount || 0), 0);
  const pendingAmt = expenses.filter(e => ['pending', 'in_review'].includes(e.status)).reduce((s, e) => s + (e.total_amount || 0), 0);
  const approvedAmt = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + (e.total_amount || 0), 0);
  const rejectedAmt = expenses.filter(e => e.status === 'rejected').reduce((s, e) => s + (e.total_amount || 0), 0);

  return `
    <div class="page-header">
      <div><h1 class="page-title">My Expenses</h1><p class="page-subtitle">Track all your submitted expenses</p></div>
      <button class="btn btn-primary" onclick="navigate('new-expense')">➕ New Expense</button>
    </div>
    <div class="stats-grid">
      <div class="stat-card stat-card--primary"><div class="stat-icon">💰</div><div class="stat-value">${formatCurrency(totalSubmitted)}</div><div class="stat-label">Total Submitted</div></div>
      <div class="stat-card stat-card--warning"><div class="stat-icon">⏳</div><div class="stat-value">${formatCurrency(pendingAmt)}</div><div class="stat-label">Pending</div></div>
      <div class="stat-card stat-card--success"><div class="stat-icon">✅</div><div class="stat-value">${formatCurrency(approvedAmt)}</div><div class="stat-label">Approved</div></div>
      <div class="stat-card stat-card--danger"><div class="stat-icon">❌</div><div class="stat-value">${formatCurrency(rejectedAmt)}</div><div class="stat-label">Rejected</div></div>
    </div>
    <div class="table-container">
      <div class="table-header"><span class="table-title">All Expenses (${expenses.length})</span></div>
      ${expenses.length > 0 ? `
        <table>
          <thead><tr><th>ID</th><th>Title</th><th>Amount</th><th>Category</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      ` : '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">No expenses yet</div><div class="empty-state-hint">Submit your first expense to get started</div></div>'}
    </div>
  `;
}

function bindExpenseEvents() {
  document.querySelectorAll('.expense-row').forEach(row => {
    row.addEventListener('click', () => showExpenseDetail(row.dataset.expenseId));
  });
}

// ═══════ NEW EXPENSE ═══════
let lineItems = [{ description: '', amount: '', category: '', date: '' }];
let receiptFile = null;
let ocrData = null;

async function renderNewExpense() {
  const currencies = await api('/api/currency');
  lineItems = [{ description: '', amount: '', category: '', date: '' }];
  receiptFile = null;
  ocrData = null;

  return `
    <div class="page-header">
      <div><h1 class="page-title">New Expense</h1><p class="page-subtitle">Submit a new expense for approval</p></div>
    </div>
    <div class="card" style="max-width:800px">
      <form id="expenseForm">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="expTitle">Expense Title</label>
            <input class="form-input" type="text" id="expTitle" placeholder="Business Trip to NYC" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="expCategory">Category</label>
            <select class="form-select" id="expCategory">
              <option value="Travel">✈️ Travel</option>
              <option value="Meals">🍽️ Meals</option>
              <option value="Supplies">📦 Supplies</option>
              <option value="Equipment">💻 Equipment</option>
              <option value="Accommodation">🏨 Accommodation</option>
              <option value="Other">📋 Other</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="expCurrency">Currency</label>
            <select class="form-select" id="expCurrency">
              ${currencies.map(c => `<option value="${c.code}" ${c.code === 'USD' ? 'selected' : ''}>${c.symbol} ${c.code} — ${c.name}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Total Amount</label>
            <input class="form-input" type="text" id="expTotal" readonly style="font-weight:700;font-size:1.1rem" value="$0.00">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="expDesc">Description</label>
          <textarea class="form-textarea" id="expDesc" placeholder="Add any notes or description..."></textarea>
        </div>

        <!-- Receipt Upload -->
        <div class="form-group">
          <label class="form-label">Receipt (OCR Auto-fill)</label>
          <div class="upload-area" id="uploadArea">
            <div class="upload-icon">📤</div>
            <div class="upload-text">Drag & drop your receipt here, or click to browse</div>
            <div class="upload-hint">Supports JPG, PNG, PDF, WebP (max 5MB)</div>
            <input type="file" id="receiptInput" accept=".jpg,.jpeg,.png,.pdf,.webp" style="display:none">
          </div>
          <div id="uploadPreview"></div>
          <div id="ocrResult"></div>
        </div>

        <!-- Line Items -->
        <div class="form-group">
          <label class="form-label">Line Items</label>
          <div id="lineItemsContainer"></div>
          <button type="button" class="btn btn-secondary btn-sm mt-1" id="addLineItem">➕ Add Line Item</button>
        </div>

        <div style="display:flex;gap:1rem;justify-content:flex-end;margin-top:1.5rem">
          <button type="button" class="btn btn-secondary" onclick="navigate('expenses')">Cancel</button>
          <button type="submit" class="btn btn-primary btn-lg" id="submitExpenseBtn">Submit Expense</button>
        </div>
      </form>
    </div>
  `;
}

function renderLineItems() {
  const container = document.getElementById('lineItemsContainer');
  if (!container) return;
  container.innerHTML = lineItems.map((item, i) => `
    <div class="line-item">
      <input type="text" placeholder="Description" value="${item.description}" data-index="${i}" data-field="description">
      <input type="number" placeholder="Amount" step="0.01" value="${item.amount}" data-index="${i}" data-field="amount">
      <input type="date" value="${item.date}" data-index="${i}" data-field="date">
      ${lineItems.length > 1 ? `<button type="button" class="line-item-remove" data-remove="${i}">✕</button>` : '<div></div>'}
    </div>
  `).join('');

  container.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', () => {
      const idx = parseInt(input.dataset.index);
      lineItems[idx][input.dataset.field] = input.value;
      updateTotal();
    });
  });

  container.querySelectorAll('.line-item-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      lineItems.splice(parseInt(btn.dataset.remove), 1);
      renderLineItems();
    });
  });

  updateTotal();
}

function updateTotal() {
  const total = lineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
  const currencyEl = document.getElementById('expCurrency');
  const currency = currencyEl ? currencyEl.value : 'USD';
  document.getElementById('expTotal').value = formatCurrency(total, currency);
}

function bindNewExpenseEvents() {
  renderLineItems();

  document.getElementById('addLineItem')?.addEventListener('click', () => {
    lineItems.push({ description: '', amount: '', category: '', date: '' });
    renderLineItems();
  });

  // Upload logic
  const uploadArea = document.getElementById('uploadArea');
  const receiptInput = document.getElementById('receiptInput');

  uploadArea?.addEventListener('click', () => receiptInput.click());
  uploadArea?.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragging'); });
  uploadArea?.addEventListener('dragleave', () => uploadArea.classList.remove('dragging'));
  uploadArea?.addEventListener('drop', (e) => { e.preventDefault(); uploadArea.classList.remove('dragging'); handleFile(e.dataTransfer.files[0]); });
  receiptInput?.addEventListener('change', () => { if (receiptInput.files[0]) handleFile(receiptInput.files[0]); });

  document.getElementById('expCurrency')?.addEventListener('change', updateTotal);

  document.getElementById('expenseForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('submitExpenseBtn');
    if (lineItems.every(i => !i.description && !i.amount)) {
      showToast('Add at least one line item', 'error'); return;
    }
    btn.disabled = true; btn.textContent = 'Submitting...';
    try {
      await api('/api/expenses', {
        method: 'POST',
        body: JSON.stringify({
          title: document.getElementById('expTitle').value,
          description: document.getElementById('expDesc').value,
          category: document.getElementById('expCategory').value,
          currency: document.getElementById('expCurrency').value,
          line_items: lineItems.filter(i => i.description || i.amount),
          receipt_path: receiptFile,
          receipt_ocr_data: ocrData ? JSON.stringify(ocrData) : null
        })
      });
      showToast('Expense submitted successfully!', 'success');
      navigate('expenses');
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Submit Expense';
    }
  });
}

async function handleFile(file) {
  if (!file) return;
  const formData = new FormData();
  formData.append('receipt', file);

  document.getElementById('uploadPreview').innerHTML = `
    <div class="upload-preview">
      <span class="upload-preview-icon">📎</span>
      <span class="upload-preview-name">${file.name}</span>
      <button class="upload-preview-remove" id="removeReceipt">✕</button>
    </div>
  `;
  document.getElementById('removeReceipt')?.addEventListener('click', () => {
    receiptFile = null; ocrData = null;
    document.getElementById('uploadPreview').innerHTML = '';
    document.getElementById('ocrResult').innerHTML = '';
  });

  try {
    const result = await apiUpload('/api/ocr/upload', formData);
    receiptFile = result.file_path;
    ocrData = result.ocr_data;

    document.getElementById('ocrResult').innerHTML = `
      <div class="ocr-result">
        <div class="ocr-result-header">🤖 OCR Auto-detected (${Math.round(result.ocr_data.confidence * 100)}% confidence)</div>
        <div class="ocr-result-grid">
          <div><div class="ocr-field-label">Vendor</div><div class="ocr-field-value">${result.ocr_data.vendor}</div></div>
          <div><div class="ocr-field-label">Amount</div><div class="ocr-field-value">${formatCurrency(result.ocr_data.amount)}</div></div>
          <div><div class="ocr-field-label">Category</div><div class="ocr-field-value">${result.ocr_data.category}</div></div>
          <div><div class="ocr-field-label">Date</div><div class="ocr-field-value">${result.ocr_data.date}</div></div>
        </div>
        <button type="button" class="btn btn-secondary btn-sm mt-1" id="applyOCR">Apply OCR Data</button>
      </div>
    `;

    document.getElementById('applyOCR')?.addEventListener('click', () => {
      document.getElementById('expTitle').value = `${result.ocr_data.vendor} — ${result.ocr_data.description}`;
      document.getElementById('expCategory').value = result.ocr_data.category === 'Accommodation' ? 'Accommodation' :
        ['Travel', 'Meals', 'Supplies', 'Equipment'].includes(result.ocr_data.category) ? result.ocr_data.category : 'Other';
      lineItems = [{ description: result.ocr_data.description, amount: result.ocr_data.amount.toString(), category: result.ocr_data.category, date: result.ocr_data.date }];
      renderLineItems();
      showToast('OCR data applied!', 'success');
    });
  } catch (err) {
    showToast('OCR processing failed', 'error');
  }
}

// ═══════ APPROVALS ═══════
async function renderApprovals() {
  const pending = await api('/api/approvals/pending');

  const cards = pending.map(s => `
    <div class="card mb-2" style="cursor:pointer" data-approval-id="${s.id}" data-expense-id="${s.expense_id}">
      <div class="flex-between">
        <div class="flex-center gap-1">
          <div class="avatar avatar-md" style="background:${s.submitter_color || '#6366F1'}">${getInitials(s.submitter_name)}</div>
          <div>
            <div class="font-bold">${s.title}</div>
            <div class="text-sm text-muted">${s.submitter_name} · ${formatDate(s.submitted_at)}</div>
          </div>
        </div>
        <div class="text-right">
          <div style="font-size:1.25rem;font-weight:800">${formatCurrency(s.total_amount, s.currency)}</div>
          <div class="text-sm">${categoryIcons[s.category] || ''} ${s.category}</div>
        </div>
      </div>
      <div style="display:flex;gap:0.75rem;margin-top:1rem;justify-content:flex-end">
        <button class="btn btn-danger btn-sm reject-btn" data-step="${s.id}">❌ Reject</button>
        <button class="btn btn-success btn-sm approve-btn" data-step="${s.id}">✅ Approve</button>
      </div>
    </div>
  `).join('');

  return `
    <div class="page-header">
      <div><h1 class="page-title">Pending Approvals</h1><p class="page-subtitle">${pending.length} expense${pending.length !== 1 ? 's' : ''} awaiting your review</p></div>
    </div>
    ${pending.length > 0 ? cards : '<div class="empty-state"><div class="empty-state-icon">🎉</div><div class="empty-state-text">All caught up!</div><div class="empty-state-hint">No pending approvals at the moment</div></div>'}
  `;
}

function bindApprovalEvents() {
  document.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); showDecisionModal(btn.dataset.step, 'approved'); });
  });
  document.querySelectorAll('.reject-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); showDecisionModal(btn.dataset.step, 'rejected'); });
  });
  document.querySelectorAll('[data-expense-id]').forEach(card => {
    card.addEventListener('click', () => showExpenseDetail(card.dataset.expenseId));
  });
}

function showDecisionModal(stepId, decision) {
  const isApprove = decision === 'approved';
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'decisionModal';
  modal.innerHTML = `
    <div class="modal" style="max-width:450px">
      <div class="modal-header">
        <div class="modal-title">${isApprove ? '✅ Approve' : '❌ Reject'} Expense</div>
        <button class="modal-close" onclick="document.getElementById('decisionModal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label" for="decisionComment">Comment (optional)</label>
          <textarea class="form-textarea" id="decisionComment" placeholder="Add a comment for the submitter..."></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('decisionModal').remove()">Cancel</button>
        <button class="btn ${isApprove ? 'btn-success' : 'btn-danger'}" id="confirmDecision">${isApprove ? 'Approve' : 'Reject'}</button>
      </div>
    </div>
  `;
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);

  document.getElementById('confirmDecision')?.addEventListener('click', async () => {
    const btn = document.getElementById('confirmDecision');
    btn.disabled = true; btn.textContent = 'Processing...';
    try {
      await api(`/api/approvals/${stepId}/decide`, {
        method: 'POST',
        body: JSON.stringify({ decision, comment: document.getElementById('decisionComment').value })
      });
      modal.remove();
      showToast(`Expense ${isApprove ? 'approved' : 'rejected'} successfully!`, 'success');
      navigate('approvals');
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false; btn.textContent = isApprove ? 'Approve' : 'Reject';
    }
  });
}

// ═══════ USERS ═══════
async function renderUsers() {
  const users = await api('/api/users');
  const managers = await api('/api/users/managers');

  const cards = users.map(u => `
    <div class="user-card">
      <div class="avatar avatar-lg" style="background:${u.avatar_color || '#6366F1'}">${getInitials(u.full_name)}</div>
      <div class="user-card-info">
        <div class="user-card-name">${u.full_name}</div>
        <div class="user-card-email">${u.email}</div>
        <div class="flex-center gap-1 mt-1">
          <span class="badge badge--${u.role === 'admin' ? 'paid' : u.role === 'manager' ? 'in_review' : 'pending'}">
            ${u.role}
          </span>
          ${u.manager_name ? `<span class="text-xs text-muted">→ ${u.manager_name}</span>` : ''}
        </div>
      </div>
      <div class="user-card-actions">
        <select class="filter-select" data-user-id="${u.id}" data-action="role" style="font-size:0.75rem;padding:0.3rem 1.5rem 0.3rem 0.5rem">
          <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
          <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Manager</option>
          <option value="employee" ${u.role === 'employee' ? 'selected' : ''}>Employee</option>
        </select>
        <select class="filter-select" data-user-id="${u.id}" data-action="manager" style="font-size:0.75rem;padding:0.3rem 1.5rem 0.3rem 0.5rem">
          <option value="">No Manager</option>
          ${managers.filter(m => m.id !== u.id).map(m => `<option value="${m.id}" ${u.manager_id === m.id ? 'selected' : ''}>${m.full_name}</option>`).join('')}
        </select>
      </div>
    </div>
  `).join('');

  return `
    <div class="page-header">
      <div><h1 class="page-title">Users</h1><p class="page-subtitle">Manage team members, roles, and manager hierarchy</p></div>
    </div>
    <div class="user-grid">${cards}</div>
  `;
}

function bindUserEvents() {
  document.querySelectorAll('[data-action="role"]').forEach(select => {
    select.addEventListener('change', async () => {
      try {
        await api(`/api/users/${select.dataset.userId}/role`, { method: 'PUT', body: JSON.stringify({ role: select.value }) });
        showToast('Role updated', 'success');
      } catch (err) { showToast(err.message, 'error'); }
    });
  });

  document.querySelectorAll('[data-action="manager"]').forEach(select => {
    select.addEventListener('change', async () => {
      try {
        await api(`/api/users/${select.dataset.userId}/manager`, { method: 'PUT', body: JSON.stringify({ manager_id: select.value || null }) });
        showToast('Manager assigned', 'success');
      } catch (err) { showToast(err.message, 'error'); }
    });
  });
}

// ═══════ APPROVAL RULES ═══════
async function renderRules() {
  const rules = await api('/api/rules');

  const ruleCards = rules.map(r => {
    const icons = { auto_approve: '🤖', percentage: '📊', hybrid: '🔀' };
    const colors = { auto_approve: 'rgba(16,185,129,0.15)', percentage: 'rgba(99,102,241,0.15)', hybrid: 'rgba(245,158,11,0.15)' };
    let details = '';
    if (r.auto_approve_below) details += `Auto-approve below ${formatCurrency(r.auto_approve_below)} `;
    if (r.percentage_threshold) details += `${r.percentage_threshold}% threshold `;
    if (r.approver_name) details += `Assigned to ${r.approver_name}`;

    return `
      <div class="rule-card">
        <div class="rule-icon" style="background:${colors[r.rule_type]}">${icons[r.rule_type] || '⚙️'}</div>
        <div class="rule-info">
          <div class="rule-name">${r.name}</div>
          <div class="rule-type">${r.rule_type.replace('_', ' ')} ${details ? '· ' + details : ''}</div>
        </div>
        <button class="rule-toggle ${r.is_active ? 'active' : ''}" data-rule-id="${r.id}" data-active="${r.is_active}"></button>
        <button class="btn btn-secondary btn-sm" style="color:var(--danger)" data-delete-rule="${r.id}">🗑</button>
      </div>
    `;
  }).join('');

  return `
    <div class="page-header">
      <div><h1 class="page-title">Approval Rules</h1><p class="page-subtitle">Configure automatic approval conditions</p></div>
      <button class="btn btn-primary" id="addRuleBtn">➕ New Rule</button>
    </div>
    ${ruleCards || '<div class="empty-state"><div class="empty-state-icon">⚙️</div><div class="empty-state-text">No rules configured</div><div class="empty-state-hint">Add rules to automate approval workflows</div></div>'}
  `;
}

function bindRuleEvents() {
  document.querySelectorAll('.rule-toggle').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ruleId = btn.dataset.ruleId;
      const isActive = btn.dataset.active === '1';
      try {
        const rules = await api('/api/rules');
        const rule = rules.find(r => r.id === ruleId);
        if (rule) {
          await api(`/api/rules/${ruleId}`, { method: 'PUT', body: JSON.stringify({ ...rule, is_active: isActive ? 0 : 1 }) });
          showToast(`Rule ${isActive ? 'disabled' : 'enabled'}`, 'success');
          navigate('rules');
        }
      } catch (err) { showToast(err.message, 'error'); }
    });
  });

  document.querySelectorAll('[data-delete-rule]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this rule?')) return;
      try {
        await api(`/api/rules/${btn.dataset.deleteRule}`, { method: 'DELETE' });
        showToast('Rule deleted', 'success');
        navigate('rules');
      } catch (err) { showToast(err.message, 'error'); }
    });
  });

  document.getElementById('addRuleBtn')?.addEventListener('click', showNewRuleModal);
}

function showNewRuleModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'ruleModal';
  modal.innerHTML = `
    <div class="modal" style="max-width:500px">
      <div class="modal-header">
        <div class="modal-title">New Approval Rule</div>
        <button class="modal-close" onclick="document.getElementById('ruleModal').remove()">&times;</button>
      </div>
      <div class="modal-body">
        <div class="form-group">
          <label class="form-label" for="ruleName">Rule Name</label>
          <input class="form-input" type="text" id="ruleName" placeholder="Auto-approve under $100" required>
        </div>
        <div class="form-group">
          <label class="form-label" for="ruleType">Rule Type</label>
          <select class="form-select" id="ruleType">
            <option value="auto_approve">🤖 Auto Approve (below threshold)</option>
            <option value="percentage">📊 Percentage Approval</option>
            <option value="hybrid">🔀 Hybrid</option>
          </select>
        </div>
        <div class="form-group" id="autoApproveField">
          <label class="form-label" for="autoApproveBelow">Auto-approve below amount ($)</label>
          <input class="form-input" type="number" id="autoApproveBelow" placeholder="100" step="0.01">
        </div>
        <div class="form-group" id="percentageField" style="display:none">
          <label class="form-label" for="percentageThreshold">Approval percentage threshold (%)</label>
          <input class="form-input" type="number" id="percentageThreshold" placeholder="75" min="1" max="100">
        </div>
        <div class="form-group">
          <label class="form-label" for="rulePriority">Priority (lower = first)</label>
          <input class="form-input" type="number" id="rulePriority" value="0">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="document.getElementById('ruleModal').remove()">Cancel</button>
        <button class="btn btn-primary" id="saveRule">Create Rule</button>
      </div>
    </div>
  `;
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);

  document.getElementById('ruleType')?.addEventListener('change', (e) => {
    const type = e.target.value;
    document.getElementById('autoApproveField').style.display = (type === 'auto_approve' || type === 'hybrid') ? 'block' : 'none';
    document.getElementById('percentageField').style.display = (type === 'percentage' || type === 'hybrid') ? 'block' : 'none';
  });

  document.getElementById('saveRule')?.addEventListener('click', async () => {
    const btn = document.getElementById('saveRule');
    btn.disabled = true; btn.textContent = 'Creating...';
    try {
      await api('/api/rules', {
        method: 'POST',
        body: JSON.stringify({
          name: document.getElementById('ruleName').value,
          rule_type: document.getElementById('ruleType').value,
          auto_approve_below: parseFloat(document.getElementById('autoApproveBelow').value) || null,
          percentage_threshold: parseFloat(document.getElementById('percentageThreshold').value) || null,
          priority: parseInt(document.getElementById('rulePriority').value) || 0
        })
      });
      modal.remove();
      showToast('Rule created!', 'success');
      navigate('rules');
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false; btn.textContent = 'Create Rule';
    }
  });
}

// ═══════ HISTORY ═══════
async function renderHistory() {
  const isManager = currentUser.role === 'admin' || currentUser.role === 'manager';
  let content = '';

  if (isManager) {
    const history = await api('/api/approvals/history');
    const rows = history.map(h => `
      <tr>
        <td class="font-bold">${h.title}</td>
        <td>${h.submitter_name}</td>
        <td class="font-bold">${formatCurrency(h.total_amount, h.currency)}</td>
        <td>${categoryIcons[h.category] || ''} ${h.category}</td>
        <td><span class="badge badge--${h.status}"><span class="badge--dot"></span> ${getStatusLabel(h.status)}</span></td>
        <td class="text-muted">${h.comment || '—'}</td>
        <td class="text-muted">${formatDate(h.decided_at)}</td>
      </tr>
    `).join('');

    content = `
      <div class="table-container">
        <div class="table-header"><span class="table-title">My Approval History (${history.length})</span></div>
        ${rows ? `
          <table>
            <thead><tr><th>Expense</th><th>Submitter</th><th>Amount</th><th>Category</th><th>Decision</th><th>Comment</th><th>Date</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        ` : '<div class="empty-state"><div class="empty-state-icon">📜</div><div class="empty-state-text">No approval history</div></div>'}
      </div>
    `;
  }

  const expenses = await api('/api/expenses');
  const rows = expenses.map(e => `
    <tr class="expense-row" data-expense-id="${e.id}">
      <td class="font-bold">${e.title}</td>
      <td class="font-bold">${formatCurrency(e.total_amount, e.currency)}</td>
      <td>${categoryIcons[e.category] || ''} ${e.category}</td>
      <td><span class="badge badge--${e.status}"><span class="badge--dot"></span> ${getStatusLabel(e.status)}</span></td>
      <td class="text-muted">${formatDate(e.created_at)}</td>
    </tr>
  `).join('');

  return `
    <div class="page-header">
      <div><h1 class="page-title">History</h1><p class="page-subtitle">Complete expense and approval history</p></div>
    </div>
    ${content}
    <div class="table-container mt-2">
      <div class="table-header"><span class="table-title">My Expense History (${expenses.length})</span></div>
      ${rows ? `
        <table>
          <thead><tr><th>Expense</th><th>Amount</th><th>Category</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      ` : '<div class="empty-state"><div class="empty-state-icon">📭</div><div class="empty-state-text">No expense history</div></div>'}
    </div>
  `;
}

// ═══════ INIT ═══════
(async function init() {
  const app = document.getElementById('app');
  app.innerHTML = '<div class="loading-page"><div class="spinner"></div><span>Loading ReimburseFlow...</span></div>';

  if (authToken) {
    const authed = await checkAuth();
    if (authed) {
      render();
      return;
    }
  }
  render();
})();
