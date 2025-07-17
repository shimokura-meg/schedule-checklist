const CACHE_NAME = 'my-checklist-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    // アイコンもキャッシュする
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
];

// インストールイベント: キャッシュにファイルを保存
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
    );
});

// フェッチイベント: キャッシュからリソースを提供、なければネットワークから取得
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // キャッシュにリソースがあればそれを使用
                if (response) {
                    return response;
                }
                // キャッシュになければネットワークから取得
                return fetch(event.request).catch(() => {
                    // オフラインでキャッシュにもない場合のフォールバック（例: オフラインページ）
                    // 今回はシンプルな実装のため、エラーを返すだけ
                    console.log('Network request failed and no cache match.');
                });
            })
    );
});

// アクティベートイベント: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        // ホワイトリストにないキャッシュを削除
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

// プッシュ通知イベント (通知機能の拡張時に使用)
self.addEventListener('push', (event) => {
    const data = event.data.json();
    console.log('Push received:', data);

    const title = data.title || '通知';
    const options = {
        body: data.body || '新しい通知があります。',
        icon: data.icon || '/icons/icon-192x192.png',
        badge: data.badge || '/icons/icon-192x192.png' // Android用
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// 通知クリックイベント (通知機能の拡張時に使用)
self.addEventListener('notificationclick', (event) => {
    event.notification.close(); // 通知を閉じる
    event.waitUntil(
        clients.openWindow('/') // アプリのURLを開く
    );
});