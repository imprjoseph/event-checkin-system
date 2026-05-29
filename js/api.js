/**
 * ============================================
 * 活動報到系統 - API 通訊層
 * api.js
 * ============================================
 * GitHub Pages 呼叫 Google Apps Script 時，fetch 會被 CORS 擋住。
 * 因此前端統一改用 JSONP 方式呼叫 GAS。
 */

const API = (() => {
  const cfg = window.APP_CONFIG;
  const cache = new Map();

  async function request(action, params = {}, useCache = false) {
    if (!cfg.API_URL || cfg.API_URL.includes('YOUR_DEPLOYMENT_ID_HERE')) {
      return { success: false, message: '尚未設定 Google Apps Script Web App URL，請先修改 js/config.js 的 API_URL' };
    }

    const cacheKey = action + ':' + JSON.stringify(params || {});

    if (useCache && cache.has(cacheKey)) {
      const { data, ts, ttl } = cache.get(cacheKey);
      if (Date.now() - ts < ttl) return data;
    }

    try {
      const data = await GASJsonp.request(action, params || {}, cfg.API.timeout);

      if (useCache) {
        const ttl = action === 'dashboard' ? cfg.CACHE.dashboardTTL : cfg.CACHE.searchTTL;
        cache.set(cacheKey, { data, ts: Date.now(), ttl });
      }

      return data;
    } catch (err) {
      console.error('GAS JSONP request failed:', err);
      return { success: false, message: err.message || '無法連到 Google Apps Script，請確認 API_URL、部署版本與存取權限。' };
    }
  }

  async function verifyQR(qrData) {
    return request('verifyQR', { qrData });
  }

  async function searchGuest(keyword, field = 'all') {
    if (!keyword || keyword.trim().length < 1) return { success: false, data: [] };
    return request('search', { keyword: keyword.trim(), field }, true);
  }

  async function checkIn(guestId, staffName, method = 'qr') {
    const token = window.Auth?.getToken?.() || '';
    for (const [key] of cache) {
      if (key.includes('dashboard') || key.includes('search')) cache.delete(key);
    }
    return request('checkIn', {
      token,
      guestId,
      staffName,
      method,
      timestamp: new Date().toISOString(),
    });
  }

  async function getDashboard() {
    const token = window.Auth?.getToken?.() || '';
    return request('dashboard', { token }, true);
  }

  async function getCheckinLog() {
    const token = window.Auth?.getToken?.() || '';
    return request('checkinLog', { token });
  }

  function clearCache() {
    cache.clear();
  }

  return { verifyQR, searchGuest, checkIn, getDashboard, getCheckinLog, clearCache };
})();

window.API = API;
