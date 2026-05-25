/**
 * ============================================
 * 活動報到系統 - 主控制器
 * app.js
 * ============================================
 */

// ===== 應用程式初始化 =====
document.addEventListener('DOMContentLoaded', () => {
  // 設定活動資訊
  const ev = APP_CONFIG.EVENT;
  document.title = ev.name + ' 報到系統';
  document.getElementById('eventTitle').textContent = ev.name;
  document.getElementById('eventSubtitle').textContent = `${ev.shortName} · ${ev.date}`;

  // 檢查登入狀態
  const staffName = sessionStorage.getItem('staffName');
  const isLoggedIn = sessionStorage.getItem('isLoggedIn');

  if (isLoggedIn === 'true' && staffName) {
    showApp(staffName);
  }

  // Enter 鍵登入
  document.getElementById('staffPassword').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
});

// ===== 登入處理 =====
function handleLogin() {
  const staffName = document.getElementById('staffName').value.trim();
  const password = document.getElementById('staffPassword').value;
  const errorEl = document.getElementById('loginError');

  if (!staffName) {
    errorEl.textContent = '請輸入工作人員姓名';
    document.getElementById('staffName').focus();
    return;
  }

  const validPasswords = APP_CONFIG.STAFF_PASSWORD;
  const isValid = Array.isArray(validPasswords)
    ? validPasswords.includes(password)
    : password === validPasswords;

  if (!isValid) {
    errorEl.textContent = '密碼錯誤，請重新輸入';
    document.getElementById('staffPassword').value = '';
    document.getElementById('staffPassword').focus();
    return;
  }

  sessionStorage.setItem('staffName', staffName);
  sessionStorage.setItem('isLoggedIn', 'true');
  showApp(staffName);
}

// ===== 登出處理 =====
function handleLogout() {
  if (!confirm('確定要登出嗎？')) return;
  sessionStorage.removeItem('staffName');
  sessionStorage.removeItem('isLoggedIn');
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

  // 設定人員資訊
  document.getElementById('headerStaffName').textContent = `👤 ${staffName}`;
  document.getElementById('headerEventName').textContent = APP_CONFIG.EVENT.name;

  // 初始化 Scanner
  Scanner.init();

  // 載入 Dashboard
  Dashboard.load();
  Dashboard.startAutoRefresh();
}

// ===== Tab 切換 =====
function switchTab(tabName) {
  // 停止舊 Tab 的活動
  const prevScanner = document.querySelector('#tab-scan.active');
  if (prevScanner && tabName !== 'scan') {
    Scanner.stop();
  }

  // 切換 Tab
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  // Tab 進入動作
  if (tabName === 'dashboard') {
    API.clearCache();
    Dashboard.load();
  } else if (tabName === 'log') {
    Dashboard.loadLog();
  }
}

// ===== 對話框控制 =====
let dialogConfirmCallback = null;

function openDialog(icon, title, msg, confirmText, callback, isDanger = false) {
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
  if (dialogConfirmCallback) {
    dialogConfirmCallback();
  } else {
    // 手動搜尋的報到確認
    Search.doManualCheckin();
  }
}

// ===== Toast 通知 =====
let toastTimer = null;

function showToast(msg, type = 'info', duration = 2500) {
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

  // 閃爍動畫
  el.style.transform = 'scale(1.3)';
  el.style.color = 'var(--accent)';
  setTimeout(() => {
    el.style.transform = '';
  }, 300);
}

window.updateHeaderCount = updateHeaderCount;

// ===== 本地報到紀錄（即時反映不需 API）=====
function addLocalLog(data) {
  Dashboard.addLocalEntry(data);
}

window.addLocalLog = addLocalLog;

// ===== PWA Service Worker 註冊 =====
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Service Worker 可選，失敗不影響功能
    });
  });
}

// ===== 防止頁面縮放（行動裝置報到操作優化）=====
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

// ===== 點擊 overlay 關閉對話框 =====
document.getElementById('confirmDialog').addEventListener('click', function(e) {
  if (e.target === this) closeDialog();
});
