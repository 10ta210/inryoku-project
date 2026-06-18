/**
 * sw.js — inryokü Service Worker
 *
 * 2026-05-30 司「直しても変わらない/壊れる」の真犯人を修正:
 *   旧 sw (inryoku-v9) は HTML/JS/CSS を stale-while-revalidate でキャッシュ即返し
 *   していたため、?v= を更新しても古いファイルが配信され続けた。
 *   さらに GLB が swr の網から漏れて 504 offline になっていた。
 *   → network-first に全面変更。起動時に旧キャッシュを全削除。
 *     これでブラウザは常に最新を取得し、キャッシュ汚染が二度と起きない。
 *     (ネットワーク不通時のみ cache fallback でオフライン最低限維持)
 *
 *   旧実装は sw.js.bak-20260530 に保持。
 */
const CACHE = 'inryoku-v10-netfirst';

self.addEventListener('install', () => {
  // 即座に新 SW を有効化 (waiting をスキップ)
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // 旧キャッシュ (inryoku-v9 等) を全削除 = 古い JS/CSS/GLB を一掃
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  // 常にネットワーク優先。成功したら cache に控え (オフライン保険)。
  // ネットワーク不通時のみ cache fallback。
  e.respondWith((async () => {
    try {
      const net = await fetch(req);
      if (net && net.status === 200 && req.method === 'GET' &&
          new URL(req.url).origin === location.origin) {
        const cache = await caches.open(CACHE);
        cache.put(req, net.clone());
      }
      return net;
    } catch (err) {
      const cached = await caches.match(req);
      return cached || new Response('offline', { status: 504 });
    }
  })());
});
