/**
 * ============================================
 * 活動報到系統 - API 通訊層
 * api.js
 * ============================================
 */

const API = (() => {
  const cfg = window.APP_CONFIG;
  const cache = new Map();

  // ===== 通用 Fetch 包裝（含逾時＋重試）=====
  async function fetchWithRetry(url, options = {}, retries = cfg.API.retryCount) {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), cfg.API.timeout);

    try {
      if (!cfg.API_URL || cfg.API_URL.includes('YOUR_DEPLOYMENT_ID_HERE')) {
        return { success: false, message: '尚未設定 Google Apps Script Web App URL，請先修改 js/config.js 的 API_URL' };
      }

      const res = await fetch(url, { redirect: 'follow', ...options, signal: controller.signal });
      clearTimeout(tid);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch (err) {
        console.error('GAS response is not JSON:', text);
        return { success: false, message: '後端回傳格式錯誤，請確認 Apps Script 是否已重新部署為新版' };
      }
    } catch (err) {
      clearTimeout(tid);
      if (retries > 0 && err.name !== 'AbortError') {
        await new Promise(r => setTimeout(r, cfg.API.retryDelay));
        return fetchWithRetry(url, options, retries - 1);
      }
      throw err;
    }
  }

  // ===== GET 請求 =====
  async function get(action, params = {}, useCache = false) {
    const p = new URLSearchParams({ action, ...params });
    const url = `${cfg.API_URL}?${p.toString()}`;

    // 快取檢查
    if (useCache && cache.has(url)) {
      const { data, ts, ttl } = cache.get(url);
      if (Date.now() - ts < ttl) return data;
    }

    const data = await fetchWithRetry(url);

    if (useCache) {
      const ttl = action === 'dashboard' ? cfg.CACHE.dashboardTTL : cfg.CACHE.searchTTL;
      cache.set(url, { data, ts: Date.now(), ttl });
    }

    return data;
  }

  // ===== POST 請求 =====
  async function post(action, body = {}) {
    // 清除相關快取
    for (const [key] of cache) {
      if (key.includes('dashboard') || key.includes('search')) {
        cache.delete(key);
      }
    }

    return fetchWithRetry(cfg.API_URL, {
      method:   'POST',
      redirect: 'follow',
      body:     JSON.stringify({ action, ...body }),
      // ⚠️ 不加 Content-Type：GAS 不支援 preflight，加了會 CORS 失敗
    });
  }

  // ===== 公開 API =====

  /**
   * 驗證 QRCode 並取得來賓資料
   * @param {string} qrData - QR掃描原始字串
   */
  async function verifyQR(qrData) {
    return get('verifyQR', { qrData: encodeURIComponent(qrData) });
  }

  /**
   * 搜尋來賓
   * @param {string} keyword - 搜尋關鍵字
   * @param {string} field - 搜尋欄位 (all|name|mobile|email|id)
   */
  async function searchGuest(keyword, field = 'all') {
    if (!keyword || keyword.trim().length < 1) return { success: false, data: [] };
    return get('search', { keyword: encodeURIComponent(keyword.trim()), field }, true);
  }

  /**
   * 完成報到
   * @param {string} guestId - 報到序號
   * @param {string} staffName - 工作人員姓名
   * @param {string} method - 報到方式 (qr|manual)
   */
  async function checkIn(guestId, staffName, method = 'qr') {
    return post('checkIn', {
      guestId,
      staffName,
      method,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 取得 Dashboard 統計
   */
  async function getDashboard() {
    return get('dashboard', {}, true);
  }

  /**
   * 取得報到紀錄（今日）
   */
  async function getCheckinLog() {
    return get('checkinLog', {});
  }

  /**
   * 清除快取
   */
  function clearCache() {
    cache.clear();
  }

  return { verifyQR, searchGuest, checkIn, getDashboard, getCheckinLog, clearCache };
})();

window.API = API;
