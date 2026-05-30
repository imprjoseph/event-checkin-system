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
      errorEl.textContent = mapLoginError(result.message);
      document.getElementById('staffPassword').value = '';
    }
  } catch (err) {
    console.error('login failed:', err);
    errorEl.textContent = mapLoginError(err?.message || '網路連線失敗');
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
  const opts = document.getElementById('dialogPickupOptions');
  if (opts) { opts.classList.add('hidden'); opts.innerHTML = ''; }
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

// ============================================
// 活動名稱編輯功能
// ============================================

const EVENT_NAME_KEY = 'checkin_event_name';
const EVENT_PICKUP_KEY = 'checkin_event_pickup_options';

/** 初始化：從 localStorage 讀取自訂活動名稱 */
function initEventName() {
  const saved = localStorage.getItem(EVENT_NAME_KEY);
  if (saved && saved.trim()) {
    setEventNameDisplay(saved.trim());
  }
}

/** 更新所有顯示活動名稱的位置 */
function setEventNameDisplay(name) {
  document.getElementById('eventTitle').textContent = name;
  document.getElementById('headerEventName').textContent = name;
  document.title = name + ' 報到系統';
}

/** 開啟編輯對話框 */
function openEventEditor() {
  const current = document.getElementById('eventTitle').textContent;
  const input = document.getElementById('newEventName');
  input.value = current === '活動報到系統' ? '' : current;

  const pickup = getEventPickupOptions();
  const lunchEl = document.getElementById('eventOptionLunch');
  const giftEl = document.getElementById('eventOptionGift');
  if (lunchEl) lunchEl.checked = !!pickup.lunch;
  if (giftEl) giftEl.checked = !!pickup.gift;

  document.getElementById('eventEditorModal').classList.remove('hidden');
  setTimeout(() => input.focus(), 80);
  input.addEventListener('keydown', function handler(e) {
    if (e.key === 'Enter') { saveEventName(); input.removeEventListener('keydown', handler); }
    if (e.key === 'Escape') { closeEventEditor(); input.removeEventListener('keydown', handler); }
  });
}

/** 關閉編輯對話框 */
function closeEventEditor() {
  document.getElementById('eventEditorModal').classList.add('hidden');
}

/** 儲存活動名稱 */
function saveEventName() {
  const input = document.getElementById('newEventName');
  const name  = input.value.trim();
  if (!name) {
    input.style.borderColor = 'var(--danger)';
    setTimeout(() => input.style.borderColor = '', 1500);
    return;
  }
  localStorage.setItem(EVENT_NAME_KEY, name);
  localStorage.setItem(EVENT_PICKUP_KEY, JSON.stringify({
    lunch: !!document.getElementById('eventOptionLunch')?.checked,
    gift: !!document.getElementById('eventOptionGift')?.checked,
  }));
  setEventNameDisplay(name);
  closeEventEditor();
  showToast('✅ 活動設定已更新', 'success');
}

/** 讀取 event 紀錄項目設定 */
function getEventPickupOptions() {
  const defaults = (window.APP_CONFIG && APP_CONFIG.EVENT && APP_CONFIG.EVENT.pickupOptions) || { lunch: true, gift: true };
  try {
    const saved = JSON.parse(localStorage.getItem(EVENT_PICKUP_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      return {
        lunch: saved.lunch !== false,
        gift: saved.gift !== false,
      };
    }
  } catch (err) {
    // ignore invalid localStorage
  }
  return {
    lunch: defaults.lunch !== false,
    gift: defaults.gift !== false,
  };
}

/** 產生中餐／伴手禮勾選 HTML */
function renderPickupOptionInputs(prefix, labelPrefix = '') {
  const pickup = getEventPickupOptions();
  const items = [];
  if (pickup.lunch) items.push(`<label><input type="checkbox" id="${prefix}Lunch" checked> ${labelPrefix}中餐</label>`);
  if (pickup.gift) items.push(`<label><input type="checkbox" id="${prefix}Gift" checked> ${labelPrefix}伴手禮</label>`);
  return items.join('');
}

/** 產生中餐／伴手禮狀態文字 */
function renderPickupStatusLine(data = {}) {
  const pickup = getEventPickupOptions();
  const items = [];
  if (pickup.lunch) items.push(`中餐：${data.lunch || data.lunchStatus || '未領取'}`);
  if (pickup.gift) items.push(`伴手禮：${data.gift || data.giftStatus || '未領取'}`);
  return items.length ? items.join('　') : '';
}

window.getEventPickupOptions = getEventPickupOptions;
window.renderPickupOptionInputs = renderPickupOptionInputs;
window.renderPickupStatusLine = renderPickupStatusLine;

// DOMContentLoaded 時補充初始化
document.addEventListener('DOMContentLoaded', () => {
  initEventName();
});

// ============================================
// 錯誤訊息對照（API 錯誤 → 中文說明）
// ============================================
function mapLoginError(apiMsg) {
  if (!apiMsg) return '帳號或密碼錯誤，請重新輸入';

  const msg = String(apiMsg);

  if (msg.includes('帳號或密碼錯誤')) {
    // 嘗試提取剩餘次數
    const match = msg.match(/還有\s*(\d+)\s*次/);
    if (match) return `密碼錯誤，還有 ${match[1]} 次機會`;
    return '密碼錯誤，請重新輸入';
  }
  if (msg.includes('鎖定') || msg.includes('429')) {
    const min = msg.match(/(\d+)\s*分鐘/);
    return min
      ? `⚠️ 登入失敗次數過多，帳號已鎖定 ${min[1]} 分鐘，請稍後再試`
      : '⚠️ 帳號已暫時鎖定，請稍後再試或聯繫管理員';
  }
  if (msg.includes('停用') || msg.includes('disabled')) {
    return '此帳號已停用，請聯繫管理員';
  }
  if (msg.includes('尚未初始化')) {
    return '帳號系統尚未設定，請聯繫管理員';
  }
  if (msg.includes('網路') || msg.includes('fetch')) {
    return '網路連線失敗，請確認網路後重試';
  }
  return msg;
}
window.mapLoginError = mapLoginError;
