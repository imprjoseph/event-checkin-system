/**
 * ============================================
 * 活動報到系統 - 主控制器 (v2 - Token Auth)
 * app.js
 * ============================================
 */

// ===== 應用程式初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  const ev = APP_CONFIG.EVENT;
  document.title = ev.name + ' 報到系統';
  document.getElementById('eventTitle').textContent = ev.name;
  document.getElementById('eventSubtitle').textContent = `${ev.shortName} · ${ev.date}`;

  // 已有有效 Token → 直接進入
  if (Auth.isLoggedIn() && Auth.can('canCheckIn')) {
    showApp(Auth.getUser().displayName);
    return;
  }
  Auth.clearSession();

  document.getElementById('staffPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
});

// ===== 登入處理（Token 認證）=====
async function handleLogin() {
  const username = document.getElementById('staffName').value.trim();
  const password = document.getElementById('staffPassword').value;
  const errorEl  = document.getElementById('loginError');
  errorEl.textContent = '';

  if (!username) { errorEl.textContent = '請輸入帳號'; return; }
  if (!password) { errorEl.textContent = '請輸入密碼'; return; }

  const btn = document.querySelector('.btn-login');
  btn.style.opacity = '.6';
  btn.style.pointerEvents = 'none';

  try {
    const result = await Auth.login(username, password);
    if (result.success) {
      if (!Auth.can('canCheckIn')) {
        errorEl.textContent = '此帳號無報到權限，請聯繫管理員';
        Auth.clearSession();
        return;
      }
      showApp(result.data.user.displayName);
    } else {
      errorEl.textContent = result.message || '帳號或密碼錯誤';
      document.getElementById('staffPassword').value = '';
    }
  } catch {
    errorEl.textContent = '網路連線失敗，請稍後再試';
  } finally {
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
  }
}

// ===== 登出處理 =====
async function handleLogout() {
  if (!confirm('確定要登出嗎？')) return;
  await Auth.logout();
  Scanner.stop();
  Dashboard.stopAutoRefresh();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loginOverlay').classList.remove('hidden');
  document.getElementById('staffName').value = '';
  document.getElementById('staffPassword').value = '';
  document.getElementById('loginError').textContent = '';
}

// ===== 顯示主應用程式 =====
function showApp(staffName) {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  const user = Auth.getUser();
  const roleLabel = user?.role === 'superadmin' ? '⭐' :
                    user?.role === 'admin'       ? '🔑' : '👤';
  document.getElementById('headerStaffName').textContent = `${roleLabel} ${staffName}`;
  document.getElementById('headerEventName').textContent = APP_CONFIG.EVENT.name;

  // 管理員顯示後台入口連結
  if (Auth.can('canManageAccounts')) {
    const headerRight = document.querySelector('.header-right');
    if (!document.getElementById('adminLink')) {
      const adminLink = document.createElement('a');
      adminLink.id = 'adminLink';
      adminLink.href = './admin.html';
      adminLink.style.cssText = 'font-size:.7rem;color:var(--accent);text-decoration:none;padding:4px 8px;border:1px solid var(--accent-border);border-radius:6px;white-space:nowrap;';
      adminLink.textContent = '管理後台';
      headerRight.insertBefore(adminLink, headerRight.querySelector('.btn-logout'));
    }
  }

  // staff 隱藏紀錄 tab（無權限）
  if (!Auth.can('canViewAllLogs')) {
    const logTab = document.querySelector('[data-tab="log"]');
    if (logTab) logTab.style.display = 'none';
  }

  // 初始化掃描器
  Scanner.init();

  // 載入 Dashboard
  Dashboard.load();
  Dashboard.startAutoRefresh();
}

// ===== Tab 切換 =====
function switchTab(tabName) {
  const prevScanner = document.querySelector('#tab-scan.active');
  if (prevScanner && tabName !== 'scan') Scanner.stop();

  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  if (tabName === 'dashboard') { API.clearCache(); Dashboard.load(); }
  else if (tabName === 'log')  { Dashboard.loadLog(); }
}

// ===== 對話框控制 =====
let dialogConfirmCallback = null;

function openDialog(icon, title, msg, confirmText, callback, isDanger) {
  document.getElementById('dialogIcon').textContent = icon;
  document.getElementById('dialogTitle').textContent = title;
  document.getElementById('dialogMsg').textContent = msg;
  const btn = document.getElementById('btnConfirm');
  btn.textContent = confirmText;
  btn.className = 'btn-confirm' + (isDanger ? ' danger' : '');
  btn.disabled = false;
  dialogConfirmCallback = callback;
  document.getElementById('confirmDialog').classList.remove('hidden');
}

function closeDialog() {
  document.getElementById('confirmDialog').classList.add('hidden');
  dialogConfirmCallback = null;
}

function confirmAction() {
  if (dialogConfirmCallback) dialogConfirmCallback();
  else Search.doManualCheckin();
}

// ===== Toast 通知 =====
let toastTimer = null;
function showToast(msg, type, duration) {
  type = type || 'info';
  duration = duration || 2500;
  const el = document.getElementById('toast');
  if (toastTimer) clearTimeout(toastTimer);
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  toastTimer = setTimeout(() => el.classList.add('hidden'), duration);
}
window.showToast = showToast;

// ===== Header 計數更新 =====
function updateHeaderCount(delta) {
  const el = document.getElementById('headerCount');
  const current = parseInt(el.textContent) || 0;
  el.textContent = current + delta;
  el.style.transform = 'scale(1.3)';
  setTimeout(() => { el.style.transform = ''; }, 300);
}
window.updateHeaderCount = updateHeaderCount;

// ===== 本地報到紀錄 =====
function addLocalLog(data) { Dashboard.addLocalEntry(data); }
window.addLocalLog = addLocalLog;

// ===== PWA =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

document.getElementById('confirmDialog').addEventListener('click', function(e) {
  if (e.target === this) closeDialog();
});
