/**
 * ============================================
 * 活動報到系統 - 系統設定檔
 * config.js
 * ============================================
 * 部署前請修改以下設定值
 */

const CONFIG = {
  // ===== 必填：Google Apps Script Web App URL =====
  // 部署 GAS 後取得，格式：https://script.google.com/macros/s/XXXXX/exec
  API_URL: 'https://script.google.com/macros/s/AKfycbxOTko-ZG9xpe4IA3vW7mT8Ex3Ps72eFk-Sb315cAer5KgzKeCUKoSsl0Wg2L4ZwRah/exec',

  // ===== 活動基本資料 =====
  EVENT: {
    name: '2026 醫療創新論壇',          // 活動名稱（顯示於標題）
    shortName: 'MED2026',               // 活動代號（用於序號前綴）
    date: '2026-03-15',                 // 活動日期
    venue: '台北國際會議中心',            // 場地
    sessions: ['上午場', '下午場', '全天'],  // 場次選項
  },

  // ===== 工作人員密碼 =====
  // 建議部署後立即更改，可設多組密碼（陣列）
  STAFF_PASSWORD: ['event2026', 'staff2026'],

  // ===== 快取設定 =====
  CACHE: {
    searchTTL: 30000,     // 搜尋快取時間（ms）
    dashboardTTL: 15000,  // 統計快取時間（ms）
  },

  // ===== API 設定 =====
  API: {
    timeout: 15000,       // API 逾時（ms）
    retryCount: 2,        // 失敗重試次數
    retryDelay: 1000,     // 重試間隔（ms）
  },

  // ===== Dashboard 自動更新 =====
  DASHBOARD_REFRESH_INTERVAL: 30000, // 30秒自動更新

  // ===== QRCode 格式說明 =====
  // QR內容為 JSON 字串: {"id":"MED2026-0001","name":"王小明","mobile":"0912345678"}
  QR_FIELDS: {
    id: 'id',
    name: 'name',
    mobile: 'mobile',
  },
};

// ===== 不需修改以下內容 =====
window.APP_CONFIG = CONFIG;
