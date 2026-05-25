/**
 * ============================================
 * 活動報到系統 - 手動搜尋模組
 * search.js
 * ============================================
 */

const Search = (() => {
  let searchTimer = null;
  let currentField = 'all';
  let pendingCheckinId = null;
  let pendingCheckinName = null;

  // ===== 防抖搜尋 =====
  function debounce(keyword) {
    clearTimeout(searchTimer);
    if (!keyword || keyword.trim().length === 0) {
      showEmpty();
      return;
    }
    // 顯示搜尋中狀態
    if (keyword.trim().length >= 1) {
      document.getElementById('searchResults').innerHTML = `
        <div class="search-empty" style="padding:20px">
          <div class="loading-spinner">搜尋中...</div>
        </div>
      `;
    }
    searchTimer = setTimeout(() => doSearch(keyword.trim()), 400);
  }

  // ===== 執行搜尋 =====
  async function doSearch(keyword) {
    try {
      const result = await API.searchGuest(keyword, currentField);
      if (result.success) {
        renderResults(result.data || []);
      } else {
        showEmpty(result.message);
      }
    } catch (err) {
      document.getElementById('searchResults').innerHTML = `
        <div class="search-empty">
          <div class="empty-icon">⚠</div>
          <p style="color:var(--danger)">搜尋失敗，請稍後再試</p>
        </div>
      `;
    }
  }

  // ===== 渲染搜尋結果 =====
  function renderResults(guests) {
    const container = document.getElementById('searchResults');
    if (!guests || guests.length === 0) {
      showEmpty('查無符合的來賓資料');
      return;
    }

    const html = guests.map(g => {
      const isChecked = g.checkinStatus === '已報到';
      const nameChar = g.name ? g.name.charAt(0) : '?';

      return `
        <div class="person-card ${isChecked ? 'checked' : 'not-checked'}">
          <div class="person-avatar ${isChecked ? 'checked' : 'not-checked'}">${nameChar}</div>
          <div class="person-details">
            <div class="person-name">${escHtml(g.name || '—')}</div>
            <div class="person-company">${escHtml([g.company, g.title].filter(Boolean).join(' · ') || '—')}</div>
            <div class="person-meta">
              <span class="badge-session">${escHtml(g.session || '—')}</span>
              <span class="badge-id">${escHtml(g.guestId || '')}</span>
              ${isChecked ? `<span class="badge-checked">✓ ${escHtml(g.checkinTime || '已報到')}</span>` : ''}
            </div>
          </div>
          <div class="person-action">
            ${isChecked
              ? `<button class="btn-already" title="已報到時間：${escHtml(g.checkinTime||'')}">已報到</button>`
              : `<button class="btn-manual-checkin" onclick="Search.openCheckinConfirm('${g.guestId}','${escHtml(g.name)}')">報到</button>`
            }
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }

  // ===== 打開確認對話框 =====
  function openCheckinConfirm(guestId, name) {
    pendingCheckinId = guestId;
    pendingCheckinName = name;

    document.getElementById('dialogIcon').textContent = '👤';
    document.getElementById('dialogTitle').textContent = '確認報到';
    document.getElementById('dialogMsg').textContent = `確定要完成 ${name} 的報到嗎？`;
    document.getElementById('btnConfirm').textContent = '✓ 確認報到';
    document.getElementById('btnConfirm').className = 'btn-confirm';
    document.getElementById('confirmDialog').classList.remove('hidden');
  }

  // ===== 執行手動報到 =====
  async function doManualCheckin() {
    if (!pendingCheckinId) return;

    const staffName = sessionStorage.getItem('staffName') || '工作人員';
    const btn = document.getElementById('btnConfirm');
    btn.textContent = '報到中...';
    btn.disabled = true;

    try {
      const result = await API.checkIn(pendingCheckinId, staffName, 'manual');

      closeDialog();

      if (result.success) {
        showToast(`✓ ${pendingCheckinName} 報到成功`, 'success');
        updateHeaderCount(1);
        addLocalLog(result.data || { name: pendingCheckinName });

        // 重新搜尋刷新結果
        const kw = document.getElementById('searchInput').value;
        if (kw) doSearch(kw.trim());
      } else {
        showToast(result.message || '報到失敗', 'error');
      }
    } catch (err) {
      closeDialog();
      showToast('網路錯誤，請重試', 'error');
    } finally {
      pendingCheckinId = null;
      pendingCheckinName = null;
    }
  }

  // ===== 清空搜尋 =====
  function clearSearch() {
    document.getElementById('searchInput').value = '';
    showEmpty();
  }

  // ===== 設定搜尋欄位 =====
  function setField(el, field) {
    currentField = field;
    document.querySelectorAll('.search-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    // 重新搜尋
    const kw = document.getElementById('searchInput').value;
    if (kw) debounce(kw);
  }

  // ===== 顯示空狀態 =====
  function showEmpty(msg = '輸入關鍵字開始搜尋') {
    document.getElementById('searchResults').innerHTML = `
      <div class="search-empty">
        <div class="empty-icon">◎</div>
        <p>${msg}</p>
      </div>
    `;
  }

  // ===== HTML 轉義 =====
  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  return { debounce, clearSearch, setField, openCheckinConfirm, doManualCheckin };
})();

window.Search = Search;

// 全域函式
function debounceSearch(val) { Search.debounce(val); }
function clearSearch() { Search.clearSearch(); }
function setSearchField(el, field) { Search.setField(el, field); }
