/**
 * ============================================
 * 活動報到系統 - Dashboard 統計模組
 * dashboard.js
 * ============================================
 */

const Dashboard = (() => {
  let refreshTimer = null;

  // ===== 載入 Dashboard 資料 =====
  async function load() {
    try {
      const result = await API.getDashboard();
      if (result.success) {
        render(result.data);
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    }

    // 同時載入報到紀錄
    loadLog();
  }

  // ===== 渲染統計數字 =====
  function render(data) {
    const { total = 0, checked = 0, pending = 0, rate = 0, sessions = [], identities = [], timeline = [] } = data;

    // 主要數字（帶動畫）
    animateNumber('statTotal', total);
    animateNumber('statChecked', checked);
    animateNumber('statPending', pending);
    document.getElementById('statRate').textContent = `${rate}%`;

    // 進度條
    document.getElementById('progressText').textContent = `${checked} / ${total}`;
    setTimeout(() => {
      document.getElementById('progressBar').style.width = `${rate}%`;
    }, 100);

    // 更新 header 計數
    document.getElementById('headerCount').textContent = checked;

    // 場次統計
    renderSessionList(sessions, checked);

    // 身分別統計
    renderIdentityList(identities);

    // 時段圖表
    renderTimeline(timeline);
  }

  // ===== 數字動畫 =====
  function animateNumber(id, target) {
    const el = document.getElementById(id);
    const start = parseInt(el.textContent) || 0;
    const duration = 600;
    const startTime = Date.now();

    const update = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (target - start) * eased);
      el.textContent = current;
      if (progress < 1) requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  }

  // ===== 場次統計 =====
  function renderSessionList(sessions, totalChecked) {
    const container = document.getElementById('sessionList');
    if (!sessions || sessions.length === 0) {
      container.innerHTML = '<div class="loading-spinner">暫無場次資料</div>';
      return;
    }

    const maxCount = Math.max(...sessions.map(s => s.total || 0), 1);

    container.innerHTML = sessions.map(s => {
      const pct = Math.round((s.checked / (s.total || 1)) * 100);
      const barWidth = Math.round((s.total / maxCount) * 100);
      return `
        <div class="session-row">
          <span class="session-name">${s.name}</span>
          <div class="session-bar-wrap">
            <div class="session-bar-fill" style="width:0%" data-width="${barWidth}%"></div>
          </div>
          <span class="session-count">${s.checked}/${s.total} (${pct}%)</span>
        </div>
      `;
    }).join('');

    // 動畫啟動
    setTimeout(() => {
      container.querySelectorAll('.session-bar-fill').forEach(bar => {
        bar.style.width = bar.dataset.width;
      });
    }, 100);
  }

  // ===== 身分別統計 =====
  function renderIdentityList(identities) {
    const container = document.getElementById('identityList');
    if (!identities || identities.length === 0) {
      container.innerHTML = '<div class="loading-spinner">暫無資料</div>';
      return;
    }

    const maxCount = Math.max(...identities.map(i => i.total || 0), 1);

    container.innerHTML = identities.map(i => {
      const pct = Math.round((i.checked / (i.total || 1)) * 100);
      const barWidth = Math.round((i.total / maxCount) * 100);
      return `
        <div class="session-row">
          <span class="session-name">${i.name}</span>
          <div class="session-bar-wrap">
            <div class="session-bar-fill" style="width:0%;background:var(--info)" data-width="${barWidth}%"></div>
          </div>
          <span class="session-count">${i.checked}/${i.total} (${pct}%)</span>
        </div>
      `;
    }).join('');

    setTimeout(() => {
      container.querySelectorAll('.session-bar-fill').forEach(bar => {
        bar.style.width = bar.dataset.width;
      });
    }, 100);
  }

  // ===== 時段報到圖表（簡易 Bar）=====
  function renderTimeline(timeline) {
    const container = document.getElementById('timelineChart');
    if (!timeline || timeline.length === 0) {
      container.innerHTML = '<div class="loading-spinner" style="width:100%;text-align:center">暫無時段資料</div>';
      return;
    }

    const maxVal = Math.max(...timeline.map(t => t.count || 0), 1);

    container.innerHTML = timeline.map(t => {
      const heightPct = Math.round((t.count / maxVal) * 100);
      return `
        <div class="timeline-bar" style="height:${heightPct}%" data-height="${heightPct}%">
          <div class="bar-tip">${t.hour}時 · ${t.count}人</div>
        </div>
      `;
    }).join('');
  }

  // ===== 載入報到紀錄 =====
  async function loadLog() {
    try {
      const result = await API.getCheckinLog();
      if (result.success) {
        renderLog(result.data || []);
      }
    } catch (err) {
      console.error('Log load error:', err);
    }
  }

  // ===== 渲染報到紀錄 =====
  function renderLog(logs) {
    const container = document.getElementById('logList');
    document.getElementById('logCount').textContent = `${logs.length} 筆`;

    if (!logs || logs.length === 0) {
      container.innerHTML = `
        <div class="search-empty">
          <div class="empty-icon">≡</div>
          <p>尚無報到紀錄</p>
        </div>
      `;
      return;
    }

    container.innerHTML = logs.slice().reverse().map(l => `
      <div class="log-item">
        <div class="log-dot"></div>
        <span class="log-name">${l.name || '—'}</span>
        <span style="font-size:0.72rem;color:var(--text-muted)">${l.company || ''}</span>
        <span class="log-time">${formatTime(l.checkinTime)}</span>
      </div>
    `).join('');
  }

  // ===== 本地新增紀錄（即時反映）=====
  function addLocalEntry(data) {
    const container = document.getElementById('logList');
    const emptyEl = container.querySelector('.search-empty');
    if (emptyEl) container.innerHTML = '';

    const item = document.createElement('div');
    item.className = 'log-item';
    item.style.animation = 'slideUp 0.3s ease';
    item.innerHTML = `
      <div class="log-dot" style="background:var(--accent)"></div>
      <span class="log-name">${data.name || '—'}</span>
      <span style="font-size:0.72rem;color:var(--text-muted)">${data.company || ''}</span>
      <span class="log-time">${formatTime(new Date().toISOString())}</span>
    `;
    container.insertBefore(item, container.firstChild);

    // 更新計數
    const countEl = document.getElementById('logCount');
    const current = parseInt(countEl.textContent) || 0;
    countEl.textContent = `${current + 1} 筆`;
  }

  // ===== 格式化時間 =====
  function formatTime(isoOrStr) {
    if (!isoOrStr) return '—';
    try {
      const d = new Date(isoOrStr);
      if (isNaN(d)) return isoOrStr;
      return d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return isoOrStr;
    }
  }

  // ===== 設定自動刷新 =====
  function startAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
    refreshTimer = setInterval(() => {
      const activeTab = document.querySelector('.tab-content.active');
      if (activeTab && activeTab.id === 'tab-dashboard') {
        API.clearCache();
        load();
      }
    }, window.APP_CONFIG.DASHBOARD_REFRESH_INTERVAL);
  }

  function stopAutoRefresh() {
    if (refreshTimer) clearInterval(refreshTimer);
  }

  return { load, loadLog, addLocalEntry, startAutoRefresh, stopAutoRefresh };
})();

window.Dashboard = Dashboard;

// 全域函式
function loadDashboard() {
  API.clearCache();
  Dashboard.load();
}
