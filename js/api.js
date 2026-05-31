/**
 * api.js v5 — 全部走 GET，解決 GAS CORS 問題
 */
const API = (() => {
  const cfg   = window.APP_CONFIG;
  const cache = new Map();

  // ── 帶 timeout 的 fetch ──
  async function _fetch(url, retries) {
    retries = retries !== undefined ? retries : cfg.API.retryCount;
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), cfg.API.timeout);
    try {
      const res = await fetch(url, { method:'GET', redirect:'follow', signal: controller.signal });
      clearTimeout(tid);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch(err) {
      clearTimeout(tid);
      if (retries > 0 && err.name !== 'AbortError') {
        await new Promise(r => setTimeout(r, cfg.API.retryDelay));
        return _fetch(url, retries - 1);
      }
      throw err;
    }
  }

  // ── GET 請求 ──
  async function get(action, params, useCache) {
    const url = cfg.API_URL +
      '?action=' + encodeURIComponent(action) +
      '&' + new URLSearchParams(params || {}).toString();

    if (useCache && cache.has(url)) {
      const { data, ts, ttl } = cache.get(url);
      if (Date.now() - ts < ttl) return data;
    }
    const data = await _fetch(url);
    if (useCache) {
      const ttl = action === 'dashboard' ? cfg.CACHE.dashboardTTL : cfg.CACHE.searchTTL;
      cache.set(url, { data, ts: Date.now(), ttl });
    }
    return data;
  }

  // ── POST → 改走 GET（body 放在 data= 參數）──
  async function post(action, body) {
    // 清除相關快取
    for (const [key] of cache) {
      if (key.includes('dashboard') || key.includes('search')) cache.delete(key);
    }
    const url = cfg.API_URL +
      '?action=' + encodeURIComponent(action) +
      '&data='   + encodeURIComponent(JSON.stringify(body || {}));
    return _fetch(url);
  }

  // ── 公開 API ──
  async function verifyQR(qrData) {
    return get('verifyQR', { qrData: encodeURIComponent(qrData) });
  }
  async function searchGuest(keyword, field) {
    if (!keyword || !keyword.trim()) return { success:false, data:[] };
    return get('search', { keyword: encodeURIComponent(keyword.trim()), field: field||'all' }, true);
  }
  async function checkIn(guestId, staffName, method) {
    return post('checkIn', {
      guestId, staffName, method: method||'qr',
      timestamp: new Date().toISOString(),
    });
  }
  async function getDashboard() {
    return get('dashboard', {}, true);
  }
  async function getCheckinLog() {
    return get('checkinLog', {});
  }
  function clearCache() { cache.clear(); }

  return { get, post, verifyQR, searchGuest, checkIn, getDashboard, getCheckinLog, clearCache };
})();

window.API = API;
