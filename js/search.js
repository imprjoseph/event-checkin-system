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
  const guestMap = new Map();

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

    guestMap.clear();
    guests.forEach(g => { if (g && g.guestId) guestMap.set(String(g.guestId), g); });

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
              ${renderSearchPickupBadges(g)}
            </div>
          </div>
          <div class="person-action">
            <button class="btn-qr-serial" onclick="Search.openGuestQr('${escAttr(g.guestId || '')}')">QR／序號</button>
            ${isChecked
              ? `<button class="btn-already" title="已報到時間：${escHtml(g.checkinTime||'')}">已報到</button>`
              : `<button class="btn-manual-checkin" onclick="Search.openCheckinConfirm('${escAttr(g.guestId || '')}','${escAttr(g.name || '')}')">報到</button>`
            }
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = html;
  }


  function renderSearchPickupBadges(g) {
    const pickup = getEventPickupOptions();
    const badges = [];
    if (pickup.lunch) badges.push(`<span class="badge-pickup">中餐：${escHtml(g.lunchStatus || '未領取')}</span>`);
    if (pickup.gift) badges.push(`<span class="badge-pickup">伴手禮：${escHtml(g.giftStatus || '未領取')}</span>`);
    return badges.join('');
  }

  // ===== 打開確認對話框 =====
  function openCheckinConfirm(guestId, name) {
    pendingCheckinId = guestId;
    pendingCheckinName = name;

    document.getElementById('dialogIcon').textContent = '👤';
    document.getElementById('dialogTitle').textContent = '確認報到';
    document.getElementById('dialogMsg').textContent = `確定要完成 ${name} 的報到嗎？`;
    const opts = document.getElementById('dialogPickupOptions');
    if (opts) {
      opts.classList.remove('hidden');
      opts.innerHTML = renderPickupOptionInputs('manual', '同步紀錄');
    }
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
      const options = {
        lunch: !!document.getElementById('manualLunch')?.checked,
        gift: !!document.getElementById('manualGift')?.checked,
      };
      const result = await API.checkIn(pendingCheckinId, staffName, 'manual', options);

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


  // ===== 顯示與會者 QR Code / 序號 =====
  function openGuestQr(guestId) {
    const g = guestMap.get(String(guestId || ''));
    if (!g) {
      showToast('找不到此與會者資料，請重新搜尋', 'error');
      return;
    }

    const modal = document.getElementById('guestQrModal');
    const img = document.getElementById('guestQrImage');
    const nameEl = document.getElementById('guestQrName');
    const serialEl = document.getElementById('guestSerialCode');

    const qrContent = JSON.stringify({
      id: g.guestId || '',
      name: g.name || '',
      mobile: g.mobile || ''
    });
    const fallbackQrUrl = 'https://quickchart.io/qr?text=' + encodeURIComponent(qrContent) + '&size=240&format=png&margin=1';

    if (nameEl) nameEl.textContent = [g.name, g.company].filter(Boolean).join('｜') || '與會者';
    if (serialEl) serialEl.textContent = g.guestId || '—';
    if (img) img.src = g.qrUrl || fallbackQrUrl;
    if (modal) modal.classList.remove('hidden');
  }

  function copyGuestSerial() {
    const serial = document.getElementById('guestSerialCode')?.textContent || '';
    if (!serial || serial === '—') return;
    navigator.clipboard?.writeText(serial)
      .then(() => showToast('已複製序號：' + serial, 'success'))
      .catch(() => showToast('請手動複製序號：' + serial, 'info'));
  }

  function closeGuestQrModal() {
    document.getElementById('guestQrModal')?.classList.add('hidden');
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

  function escAttr(str) { return escHtml(str); }

  return { debounce, clearSearch, setField, openCheckinConfirm, doManualCheckin, openGuestQr, copyGuestSerial, closeGuestQrModal };
})();

window.Search = Search;

// 全域函式
function debounceSearch(val) { Search.debounce(val); }
function clearSearch() { Search.clearSearch(); }
function setSearchField(el, field) { Search.setField(el, field); }
function closeGuestQrModal() { Search.closeGuestQrModal(); }
function copyGuestSerial() { Search.copyGuestSerial(); }
