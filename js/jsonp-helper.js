/**
 * jsonp-helper.js
 * Google Apps Script ContentService 無法替 GitHub Pages 補 CORS header，
 * 因此前端改用 JSONP 讀取回應。
 */
window.GASJsonp = (() => {
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

      window[callbackName] = data => cleanup(null, data);

      const p = new URLSearchParams();
      p.set('action', action);
      p.set('callback', callbackName);

      Object.entries(params || {}).forEach(([key, value]) => {
        if (value === undefined || value === null) return;
        p.set(key, String(value));
      });

      script.onerror = () => cleanup(new Error('API 載入失敗，請確認 Apps Script Web App URL 與權限'));
      script.src = `${window.APP_CONFIG.API_URL}?${p.toString()}`;
      document.body.appendChild(script);
    });
  }

  return { request };
})();
