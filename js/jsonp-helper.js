/**
 * jsonp-helper.js
 * Google Apps Script ContentService 無法替 GitHub Pages 補 CORS header，
 * 因此前端改用 JSONP 讀取回應。
 */
(function () {
  if (window.GASJsonp && typeof window.GASJsonp.request === 'function') return;

  let seq = 0;

  function request(action, params = {}, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const callbackName = '__gas_jsonp_cb_' + Date.now() + '_' + (++seq);
      const script = document.createElement('script');
      const timer = setTimeout(() => cleanup(new Error('API 連線逾時')), timeout);

      function cleanup(err, data) {
        clearTimeout(timer);
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        if (script.parentNode) script.parentNode.removeChild(script);
        if (err) reject(err);
        else resolve(data);
      }

      window[callbackName] = function (data) {
        cleanup(null, data);
      };

      const p = new URLSearchParams();
      p.set('action', action);
      p.set('callback', callbackName);

      Object.entries(params || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        p.set(key, String(value));
      });

      const baseUrl = (window.APP_CONFIG && window.APP_CONFIG.API_URL) || '';
      if (!baseUrl) {
        cleanup(new Error('尚未設定 Google Apps Script Web App URL'));
        return;
      }

      script.onerror = function () {
        cleanup(new Error('API 載入失敗，請確認 Apps Script Web App URL、部署版本與權限'));
      };

      script.src = baseUrl + '?' + p.toString();
      document.body.appendChild(script);
    });
  }

  window.GASJsonp = { request };
})();
