document.addEventListener('DOMContentLoaded', () => {
    const eventListSection = document.getElementById('event-list-section');
    const itemListSection = document.getElementById('item-list-section');
    const eventList = document.getElementById('event-list');
    const newItemNameInput = document.getElementById('new-item-name');
    const addItemButton = document.getElementById('add-item-button');
    const newEventNameInput = document.getElementById('new-event-name');
    const newEventDateInput = document.getElementById('new-event-date');
    const addEventButton = document.getElementById('add-event-button');
    const currentEventTitle = document.getElementById('current-event-title');
    const itemList = document.getElementById('item-list');
    const backToEventsButton = document.getElementById('back-to-events');

    let currentEventId = null; // 現在表示中のイベントID

    // IndexedDBの設定
    const DB_NAME = 'checklistDB';
    const DB_VERSION = 1;
    const STORE_EVENTS = 'events';
    const STORE_ITEMS = 'items';
    let db;

    // IndexedDBを開く
    function openDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                db = event.target.result;
                // イベントストア作成
                if (!db.objectStoreNames.contains(STORE_EVENTS)) {
                    db.createObjectStore(STORE_EVENTS, { keyPath: 'id', autoIncrement: true });
                }
                // アイテムストア作成
                if (!db.objectStoreNames.contains(STORE_ITEMS)) {
                    db.createObjectStore(STORE_ITEMS, { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                console.log('IndexedDB opened successfully');
                resolve(db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
    }

    // データストアからデータを取得
    function getStore(storeName, mode) {
        const transaction = db.transaction(storeName, mode);
        return transaction.objectStore(storeName);
    }

    // イベントの表示
    async function displayEvents() {
        eventList.innerHTML = '';
        const events = await getAllData(STORE_EVENTS);
        events.forEach(event => {
            const li = document.createElement('li');
            li.className = 'event-item';
            li.dataset.id = event.id;
            li.innerHTML = `
                <div class="event-info">
                    <span>${event.name}</span>
                    ${event.date ? `<div class="date">${event.date}</div>` : ''}
                </div>
                <button class="delete-button" data-type="event">削除</button>
            `;
            eventList.appendChild(li);
        });
    }

    // アイテムの表示
    async function displayItems(eventId) {
        itemList.innerHTML = '';
        const items = await getAllData(STORE_ITEMS);
        const filteredItems = items.filter(item => item.eventId === eventId);
        filteredItems.forEach(item => {
            const li = document.createElement('li');
            li.dataset.id = item.id;
            li.innerHTML = `
                <input type="checkbox" ${item.checked ? 'checked' : ''} data-type="item-checkbox">
                <span class="item-name">${item.name}</span>
                <button class="delete-button" data-type="item">削除</button>
            `;
            itemList.appendChild(li);
        });
    }

    // 全てのデータを取得
    function getAllData(storeName) {
        return new Promise((resolve, reject) => {
            const store = getStore(storeName, 'readonly');
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // データの追加
    function addData(storeName, data) {
        return new Promise((resolve, reject) => {
            const store = getStore(storeName, 'readwrite');
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // データの更新
    function updateData(storeName, data) {
        return new Promise((resolve, reject) => {
            const store = getStore(storeName, 'readwrite');
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // データの削除
    function deleteData(storeName, id) {
        return new Promise((resolve, reject) => {
            const store = getStore(storeName, 'readwrite');
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // イベント追加ボタン
    addEventButton.addEventListener('click', async () => {
        const name = newEventNameInput.value.trim();
        const date = newEventDateInput.value;
        if (name) {
            await addData(STORE_EVENTS, { name, date });
            newEventNameInput.value = '';
            newEventDateInput.value = '';
            displayEvents();
        }
    });

    // 予定リストのクリックイベント（イベント選択または削除）
    eventList.addEventListener('click', async (e) => {
        if (e.target.classList.contains('delete-button') && e.target.dataset.type === 'event') {
            const eventId = parseInt(e.target.closest('li').dataset.id);
            if (confirm('この予定と関連する持ち物を全て削除しますか？')) {
                await deleteData(STORE_EVENTS, eventId);
                // 関連するアイテムも削除
                const itemsToDelete = (await getAllData(STORE_ITEMS)).filter(item => item.eventId === eventId);
                for (const item of itemsToDelete) {
                    await deleteData(STORE_ITEMS, item.id);
                }
                displayEvents();
            }
        } else if (e.target.closest('li.event-item')) {
            const eventItem = e.target.closest('li.event-item');
            currentEventId = parseInt(eventItem.dataset.id);
            const eventName = eventItem.querySelector('.event-info span').textContent;
            currentEventTitle.textContent = eventName;
            eventListSection.classList.add('hidden');
            itemListSection.classList.remove('hidden');
            displayItems(currentEventId);
        }
    });

    // アイテム追加ボタン
    addItemButton.addEventListener('click', async () => {
        const name = newItemNameInput.value.trim();
        if (name && currentEventId !== null) {
            await addData(STORE_ITEMS, { eventId: currentEventId, name, checked: false });
            newItemNameInput.value = '';
            displayItems(currentEventId);
        }
    });

    // アイテムリストのクリックイベント（チェックボックスまたは削除）
    itemList.addEventListener('click', async (e) => {
        if (e.target.dataset.type === 'item-checkbox') {
            const itemId = parseInt(e.target.closest('li').dataset.id);
            const item = (await getAllData(STORE_ITEMS)).find(i => i.id === itemId);
            if (item) {
                item.checked = e.target.checked;
                await updateData(STORE_ITEMS, item);
            }
        } else if (e.target.classList.contains('delete-button') && e.target.dataset.type === 'item') {
            const itemId = parseInt(e.target.closest('li').dataset.id);
            if (confirm('この持ち物を削除しますか？')) {
                await deleteData(STORE_ITEMS, itemId);
                displayItems(currentEventId);
            }
        }
    });

    // 予定一覧に戻るボタン
    backToEventsButton.addEventListener('click', () => {
        itemListSection.classList.add('hidden');
        eventListSection.classList.remove('hidden');
        currentEventId = null;
    });

    // アプリ初期化
    openDB().then(() => {
        displayEvents();
    });

    // Service Workerの登録
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then(registration => {
                    console.log('Service Worker registered:', registration);
                })
                .catch(error => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }
});