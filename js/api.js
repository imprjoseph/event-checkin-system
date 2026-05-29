/* JSONP fallback：避免 jsonp-helper.js 沒載入時出現 GASJsonp is not defined */
(function () {
  if (window.GASJsonp && typeof window.GASJsonp.request === 'function') return;

  let seq = 0;

  window.GASJsonp = {
    request(action, params = {}, timeout = 15000) {
      return new Promise((resolve, reject) => {
        const callbackName = '__gas_jsonp_cb_' + Date.now() + '_' + (++seq);
        const script = document.createElement('script');
        const timer = setTimeout(() => cleanup(new Error('API 連線逾時')), timeout);

        function cleanup(err, data) {
          clearTimeout(timer);
          try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
          if (script.parentNode) script.parentNode.removeChild(script);
          if (err) reject(err); else resolve(data);
        }

        window[callbackName] = data => cleanup(null, data);
        const p = new URLSearchParams();
        p.set('action', action);
        p.set('callback', callbackName);
        Object.entries(params || {}).forEach(([key, value]) => {
          if (value === undefined || value === null) return;
          p.set(key, String(value));
        });

        const baseUrl = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || '';
        if (!baseUrl) return cleanup(new Error('尚未設定 Google Apps Script Web App URL'));
        script.onerror = () => cleanup(new Error('API 載入失敗，請確認 Apps Script Web App URL、部署版本與權限'));
        script.src = baseUrl + '?' + p.toString();
        document.body.appendChild(script);
      });
    }
  };
})();

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
      const data = await window.GASJsonp.request(action, params || {}, cfg.API.timeout);

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
