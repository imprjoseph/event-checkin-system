/**
 * ============================================
 * 活動報到系統 - 前端認證模組 v4
 * auth.js
 * ============================================
 * GAS 相容重點：
 *   POST 不加 Content-Type header
 *   一定要加 redirect:'follow' 處理 302
 */

const Auth = (() => {
  const TOKEN_KEY = 'checkin_token';
  const USER_KEY  = 'checkin_user';
  let _refreshTimer = null;

  /* ── 基礎讀取 ── */
  function getToken()   { return sessionStorage.getItem(TOKEN_KEY); }
  function getUser()    {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }
  function isLoggedIn() { return !!(getToken() && getUser()); }
  function can(perm)    { return !!(getUser()?.permissions?.[perm]); }
  function isAdmin()    { return getUser()?.role === 'admin'; }
  function isStaff()    { return getUser()?.role === 'staff'; }

  /* ── 登入 ── */
  async function login(username, password) {
    const result = await _post('login', { username, password });
    if (result.success) {
      sessionStorage.setItem(TOKEN_KEY, result.data.token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(result.data.user));
      _startRefresh(result.data.expiresIn);
    }
    return result;
  }

  /* ── 登出 ── */
  async function logout() {
    const token = getToken();
    if (token) { try { await _post('logout', { token }); } catch {} }
    clearSession();
    _stopRefresh();
  }

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  /* ── Token 自動刷新（到期前 10 分鐘）── */
  function _startRefresh(expiresIn) {
    _stopRefresh();
    const interval = Math.max((expiresIn - 600) * 1000, 30 * 60 * 1000);
    _refreshTimer = setInterval(async () => {
      const token = getToken();
      if (!token) { _stopRefresh(); return; }
      try {
        const r = await _get('refreshToken', { token });
        if (!r.success) {
          clearSession(); _stopRefresh();
          if (window.showToast) showToast('登入已逾時，請重新登入', 'warning');
          setTimeout(() => window.location.reload(), 2000);
        }
      } catch {}
    }, interval);
  }
  function _stopRefresh() {
    if (_refreshTimer) clearInterval(_refreshTimer);
    _refreshTimer = null;
  }

  /* ── 帶 Token 的請求 ── */
  async function authGet(action, params) {
    const token = getToken();
    if (!token) throw new Error('未登入');
    return _get(action, { ...(params || {}), token });
  }
  async function authPost(action, body) {
    const token = getToken();
    if (!token) throw new Error('未登入');
    return _post(action, { ...(body || {}), token });
  }

  /* ── JSONP（避開 GitHub Pages → GAS 的 CORS 限制）── */
  async function _get(action, params) {
    if (!APP_CONFIG.API_URL || APP_CONFIG.API_URL.includes('YOUR_DEPLOYMENT_ID_HERE')) {
      return { success: false, message: '尚未設定 Google Apps Script Web App URL，請先修改 js/config.js 的 API_URL' };
    }

    try {
      return await GASJsonp.request(action, params || {}, APP_CONFIG.API.timeout);
    } catch (err) {
      console.error('GAS JSONP GET failed:', err);
      return { success: false, message: err.message || '無法連到 Google Apps Script' };
    }
  }

  /* ── POST 動作也改由 JSONP GET 傳送，避免 CORS 擋住回應 ── */
  async function _post(action, body) {
    if (!APP_CONFIG.API_URL || APP_CONFIG.API_URL.includes('YOUR_DEPLOYMENT_ID_HERE')) {
      return { success: false, message: '尚未設定 Google Apps Script Web App URL，請先修改 js/config.js 的 API_URL' };
    }

    try {
      return await GASJsonp.request(action, body || {}, APP_CONFIG.API.timeout);
    } catch (err) {
      console.error('GAS JSONP POST failed:', err);
      return { success: false, message: err.message || '無法連到 Google Apps Script' };
    }
  }

  return {
    getToken, getUser, isLoggedIn,
    can, isAdmin, isStaff,
    login, logout, clearSession,
    authGet, authPost,
  };
})();

window.Auth = Auth;
