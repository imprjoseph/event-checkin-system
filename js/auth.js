/**
 * ============================================
 * 活動報到系統 - 前端認證模組 v3
 * auth.js
 * ============================================
 * 雙層角色：admin（後台管理員）/ staff（工作人員）
 * Token 存於 sessionStorage（關閉分頁即清除）
 * 自動每 30 分鐘刷新 Token TTL
 */

const Auth = (() => {
  const TOKEN_KEY = 'checkin_token';
  const USER_KEY  = 'checkin_user';
  let _refreshTimer = null;

  /* ── 基礎讀取 ── */
  function getToken()  { return sessionStorage.getItem(TOKEN_KEY); }
  function getUser()   {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }
  function isLoggedIn(){ return !!(getToken() && getUser()); }
  function can(perm)   { return !!(getUser()?.permissions?.[perm]); }
  function isAdmin()   { return getUser()?.role === 'admin'; }
  function isStaff()   { return getUser()?.role === 'staff'; }

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

  /* ── 底層 Fetch（複用 api.js 的 CONFIG）── */
  function _get(action, params) {
    const p = new URLSearchParams({ action, ...params });
    return fetch(`${APP_CONFIG.API_URL}?${p}`).then(r => r.json());
  }
  function _post(action, body) {
    return fetch(APP_CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    }).then(r => r.json());
  }

  return {
    getToken, getUser, isLoggedIn,
    can, isAdmin, isStaff,
    login, logout, clearSession,
    authGet, authPost,
  };
})();

window.Auth = Auth;
