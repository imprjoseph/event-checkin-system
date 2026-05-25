/**
 * Service Worker - 活動報到系統
 * sw.js
 * 提供基本離線快取（靜態資源）
 */

const CACHE_NAME = 'event-checkin-v1';
const STATIC_ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/api.js',
  './js/scanner.js',
  './js/search.js',
  './js/dashboard.js',
  './js/app.js',
];

// 安裝：快取靜態資源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 啟動：清除舊快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 攔截請求
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API 請求不快取
  if (url.hostname.includes('script.google.com')) {
    return;
  }

  // 靜態資源：Cache First
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request);
    })
  );
});
