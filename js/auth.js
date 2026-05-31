/**
 * auth.js v5 — 全部走 GET，根本解決 GAS CORS 問題
 * 原理：body 資料用 ?data=JSON 方式夾帶於 GET 請求
 *       GAS doGet 天生允許 CORS，doPost 不行
 */
const Auth = (() => {
  const TOKEN_KEY = 'checkin_token';
  const USER_KEY  = 'checkin_user';
  let _refreshTimer = null;

  function getToken()   { return sessionStorage.getItem(TOKEN_KEY); }
  function getUser()    {
    try { return JSON.parse(sessionStorage.getItem(USER_KEY) || 'null'); }
    catch { return null; }
  }
  function isLoggedIn() { return !!(getToken() && getUser()); }
  function can(perm)    { return !!(getUser()?.permissions?.[perm]); }
  function isAdmin()    { return getUser()?.role === 'admin'; }
  function isStaff()    { return getUser()?.role === 'staff'; }

  async function login(username, password) {
    const result = await _send('login', { username, password });
    if (result.success) {
      sessionStorage.setItem(TOKEN_KEY, result.data.token);
      sessionStorage.setItem(USER_KEY, JSON.stringify(result.data.user));
      _startRefresh(result.data.expiresIn);
    }
    return result;
  }

  async function logout() {
    const token = getToken();
    if (token) { try { await _send('logout', { token }); } catch(e) {} }
    clearSession();
    _stopRefresh();
  }

  function clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  }

  function _startRefresh(expiresIn) {
    _stopRefresh();
    const interval = Math.max((expiresIn - 600) * 1000, 30 * 60 * 1000);
    _refreshTimer = setInterval(async () => {
      const token = getToken();
      if (!token) { _stopRefresh(); return; }
      try {
        const r = await _send('refreshToken', { token });
        if (!r.success) {
          clearSession(); _stopRefresh();
          if (window.showToast) showToast('登入已逾時，請重新登入', 'warning');
          setTimeout(() => window.location.reload(), 2000);
        }
      } catch(e) {}
    }, interval);
  }
  function _stopRefresh() {
    if (_refreshTimer) clearInterval(_refreshTimer);
    _refreshTimer = null;
  }

  async function authGet(action, params) {
    const token = getToken();
    if (!token) throw new Error('未登入');
    return _send(action, { ...(params || {}), token });
  }
  async function authPost(action, body) {
    const token = getToken();
    if (!token) throw new Error('未登入');
    return _send(action, { ...(body || {}), token });
  }

  // ── 核心：全部用 GET，body 放在 data= 參數 ──
  function _send(action, body) {
    const url = APP_CONFIG.API_URL +
      '?action=' + encodeURIComponent(action) +
      '&data='   + encodeURIComponent(JSON.stringify(body || {}));
    return fetch(url, { method:'GET', redirect:'follow' })
      .then(r => r.json());
  }

  return {
    getToken, getUser, isLoggedIn,
    can, isAdmin, isStaff,
    login, logout, clearSession,
    authGet, authPost,
  };
})();

window.Auth = Auth;
