/**
 * ============================================
 * 活動報到系統 - QR掃碼模組
 * scanner.js
 * ============================================
 */

const Scanner = (() => {
  let html5Qr = null;
  let isScanning = false;
  let lastScannedId = '';
  let lastScanTime = 0;
  const SCAN_COOLDOWN = 3000; // 同一個 QR 3秒內不重複處理

  // ===== 初始化掃描器 =====
  function init() {
    html5Qr = new Html5Qrcode('qr-reader', { verbose: false });
  }

  // ===== 啟動掃描 =====
  async function start() {
    if (isScanning) return;
    if (!html5Qr) init();

    // 隱藏舊結果
    document.getElementById('scanResult').classList.add('hidden');

    const config = {
      fps: 15,
      qrbox: { width: 240, height: 240 },
      aspectRatio: 1.0,
      disableFlip: false,
      rememberLastUsedCamera: true,
    };

    try {
      await html5Qr.start(
        { facingMode: 'environment' },
        config,
        onScanSuccess,
        onScanError
      );

      isScanning = true;
      document.getElementById('btnStartScan').classList.add('hidden');
      document.getElementById('btnStopScan').classList.remove('hidden');
      showToast('掃描器已啟動', 'success');
    } catch (err) {
      console.error('Scanner start error:', err);
      // 若後鏡頭失敗，嘗試任意鏡頭
      try {
        await html5Qr.start(
          { facingMode: 'user' },
          config,
          onScanSuccess,
          onScanError
        );
        isScanning = true;
        document.getElementById('btnStartScan').classList.add('hidden');
        document.getElementById('btnStopScan').classList.remove('hidden');
      } catch (err2) {
        showToast('無法存取相機，請檢查授權設定', 'error');
      }
    }
  }

  // ===== 停止掃描 =====
  async function stop() {
    if (!isScanning || !html5Qr) return;
    try {
      await html5Qr.stop();
      isScanning = false;
      document.getElementById('btnStartScan').classList.remove('hidden');
      document.getElementById('btnStopScan').classList.add('hidden');
    } catch (err) {
      console.error('Scanner stop error:', err);
    }
  }

  // ===== 掃描成功回呼 =====
  async function onScanSuccess(decodedText) {
    const now = Date.now();

    // 防重複掃描（同一 QR 3秒內只處理一次）
    if (decodedText === lastScannedId && now - lastScanTime < SCAN_COOLDOWN) return;

    lastScannedId = decodedText;
    lastScanTime = now;

    // 震動回饋（若裝置支援）
    if (navigator.vibrate) navigator.vibrate([100]);

    // 暫停掃描，等候處理結果
    await stop();

    // 顯示載入中
    showResultLoading();

    try {
      // 解析 QR 內容
      let qrObj = null;
      try {
        qrObj = JSON.parse(decodedText);
      } catch {
        // 可能是純序號
        qrObj = { id: decodedText };
      }

      // 呼叫 API 驗證
      const result = await API.verifyQR(decodedText);

      if (result.success) {
        displayGuestResult(result.data, decodedText);
      } else {
        showResultError(result.message || '查無此來賓資料');
        // 錯誤後 2 秒自動重啟掃描
        setTimeout(() => start(), 2000);
      }
    } catch (err) {
      console.error('QR verify error:', err);
      showResultError('系統連線錯誤，請稍後再試');
      setTimeout(() => start(), 2000);
    }
  }

  // ===== 掃描錯誤（持續掃描中的錯誤可忽略）=====
  function onScanError(error) {
    // 正常掃描過程中的錯誤不需顯示
  }

  // ===== 顯示載入中狀態 =====
  function showResultLoading() {
    const card = document.getElementById('scanResult');
    card.classList.remove('hidden');
    document.getElementById('resultStatusBar').className = 'result-status-bar';
    document.getElementById('resultAvatar').textContent = '⏳';
    document.getElementById('resultName').textContent = '查詢中...';
    document.getElementById('resultCompany').textContent = '';
    document.getElementById('resultTitle').textContent = '';
    document.getElementById('resultSession').textContent = '';
    document.getElementById('resultId').textContent = '';
    document.getElementById('resultStatusMsg').textContent = '';
    document.getElementById('resultActions').innerHTML = '';
  }

  // ===== 顯示錯誤狀態 =====
  function showResultError(msg) {
    const card = document.getElementById('scanResult');
    card.classList.remove('hidden');
    document.getElementById('resultStatusBar').className = 'result-status-bar danger';
    document.getElementById('resultAvatar').textContent = '✕';
    document.getElementById('resultName').textContent = '驗證失敗';
    document.getElementById('resultCompany').textContent = msg;
    document.getElementById('resultTitle').textContent = '';
    document.getElementById('resultSession').textContent = '';
    document.getElementById('resultId').textContent = '';
    document.getElementById('resultStatusMsg').innerHTML = `<span style="color:var(--danger)">⚠ ${msg}</span>`;
    document.getElementById('resultActions').innerHTML = `
      <button class="btn-secondary" style="flex:1" onclick="startScanner()">↩ 重新掃描</button>
    `;
  }

  // ===== 顯示來賓資料 =====
  function displayGuestResult(guest, rawQR) {
    const card = document.getElementById('scanResult');
    card.classList.remove('hidden');

    const isChecked = guest.checkinStatus === '已報到';
    const nameChar = guest.name ? guest.name.charAt(0) : '?';

    // 狀態列顏色
    const bar = document.getElementById('resultStatusBar');
    bar.className = 'result-status-bar ' + (isChecked ? 'warning' : 'success');

    // 頭像
    const avatar = document.getElementById('resultAvatar');
    avatar.textContent = nameChar;
    avatar.style.background = isChecked ? 'var(--warning-dim)' : 'var(--accent-dim)';
    avatar.style.color = isChecked ? 'var(--warning)' : 'var(--accent)';

    // 資訊
    document.getElementById('resultName').textContent = guest.name || '—';
    document.getElementById('resultCompany').textContent = [guest.company, guest.title].filter(Boolean).join(' · ') || '—';
    document.getElementById('resultTitle').textContent = guest.identity || '';
    document.getElementById('resultSession').textContent = guest.session || '場次未定';
    document.getElementById('resultId').textContent = guest.guestId || '';

    // 狀態訊息
    const statusEl = document.getElementById('resultStatusMsg');
    if (isChecked) {
      statusEl.innerHTML = `<span style="color:var(--warning)">⚠ 已於 ${guest.checkinTime || '—'} 報到（${guest.checkinStaff || '—'}）</span>
        <div class="pickup-status-line">中餐：${pickupLabel(guest.lunchStatus)}　伴手禮：${pickupLabel(guest.giftStatus)}</div>`;
    } else {
      statusEl.innerHTML = `<span style="color:var(--accent)">✓ 尚未報到，可完成報到</span>
        <div class="pickup-status-line">可於報到時同步紀錄中餐與伴手禮</div>`;
    }

    // 操作按鈕
    const actions = document.getElementById('resultActions');
    if (isChecked) {
      actions.innerHTML = `
        <button class="btn-already-checked">✓ 已完成報到</button>
        <button class="btn-secondary" style="flex:1" onclick="startScanner()">↩ 繼續掃描</button>
      `;
    } else {
      actions.innerHTML = `
        <div class="pickup-options">
          <label><input type="checkbox" id="scanLunch" checked> 中餐</label>
          <label><input type="checkbox" id="scanGift" checked> 伴手禮</label>
        </div>
        <button class="btn-checkin" onclick="Scanner.doCheckIn('${guest.guestId}')">
          ✓ 完成報到
        </button>
        <button class="btn-secondary" onclick="startScanner()">↩ 繼續掃描</button>
      `;
    }
  }

  function pickupLabel(status) {
    return status === '已領取' ? '已領取' : '未領取';
  }

  // ===== 執行報到 =====
  async function doCheckIn(guestId, rawQR) {
    const staffName = sessionStorage.getItem('staffName') || '工作人員';

    // 禁用按鈕防止重複點擊
    const btn = document.querySelector('.btn-checkin');
    if (btn) { btn.disabled = true; btn.textContent = '報到中...'; }

    try {
      const options = {
        lunch: !!document.getElementById('scanLunch')?.checked,
        gift: !!document.getElementById('scanGift')?.checked,
      };
      const result = await API.checkIn(guestId, staffName, 'qr', options);

      if (result.success) {
        // 更新狀態列
        document.getElementById('resultStatusBar').className = 'result-status-bar success';

        // 更新狀態訊息
        const now = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
        document.getElementById('resultStatusMsg').innerHTML =
          `<span style="color:var(--accent)">✓ 報到完成！${now} by ${staffName}</span>
          <div class="pickup-status-line">中餐：${options.lunch ? '已領取' : '未領取'}　伴手禮：${options.gift ? '已領取' : '未領取'}</div>`;

        // 更新按鈕
        document.getElementById('resultActions').innerHTML = `
          <button class="btn-already-checked" style="flex:1">✓ 報到完成</button>
          <button class="btn-secondary" style="flex:1" onclick="startScanner()">↩ 繼續掃描</button>
        `;

        // 更新 header 計數
        updateHeaderCount(1);

        // 加入本地紀錄
        addLocalLog(result.data || { name: guestId });

        // 震動成功回饋
        if (navigator.vibrate) navigator.vibrate([50, 30, 50]);

        showToast(`✓ ${result.data?.name || guestId} 報到成功`, 'success');
      } else {
        showToast(result.message || '報到失敗', 'error');
        if (btn) { btn.disabled = false; btn.textContent = '✓ 完成報到'; }
      }
    } catch (err) {
      console.error('CheckIn error:', err);
      showToast('網路錯誤，請重試', 'error');
      if (btn) { btn.disabled = false; btn.textContent = '✓ 完成報到'; }
    }
  }

  return { init, start, stop, doCheckIn };
})();

window.Scanner = Scanner;

// 全域函式（供 HTML onclick 使用）
function startScanner() { Scanner.start(); }
function stopScanner() { Scanner.stop(); }
