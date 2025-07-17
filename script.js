document.addEventListener('DOMContentLoaded', () => {
    const eventList = document.getElementById('event-list');
    const newEventNameInput = document.getElementById('new-event-name');
    const newEventDateInput = document.getElementById('new-event-date');
    const addEventButton = document.getElementById('add-event-button');
    const recurrenceRadios = document.querySelectorAll('input[name="recurrence-type"]');
    const weeklyDaysContainer = document.getElementById('weekly-days');
    const weeklyDayCheckboxes = document.querySelectorAll('input[name="weekly-day"]');

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
                if (!db.objectStoreNames.contains(STORE_EVENTS)) {
                    const eventStore = db.createObjectStore(STORE_EVENTS, { keyPath: 'id', autoIncrement: true });
                    // 繰り返し設定のマイグレーション（初回作成時のみ）
                    eventStore.transaction.oncomplete = () => {
                        // 既存のイベントにrecurrenceフィールドを追加するロジックが必要な場合ここに書く
                        // 今回は新規作成なので不要
                    };
                }
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

    // 日付フォーマットヘルパー (YYYY-MM-DD)
    function formatDate(date) {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 曜日を文字列に変換 (SU, MO, TU...)
    function getDayOfWeekString(date) {
        const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
        return days[new Date(date).getDay()];
    }

    // 全ての予定と持ち物を表示 (日付グループ化と繰り返し対応)
    async function displayAllEventsAndItems() {
        eventList.innerHTML = '';
        const allEvents = await getAllData(STORE_EVENTS);
        const allItems = await getAllData(STORE_ITEMS);

        const today = new Date();
        today.setHours(0, 0, 0, 0); // 時刻をリセット

        const futureEventsAndOccurrences = [];
        const MAX_FUTURE_DAYS = 30; // 今後表示する最大日数

        allEvents.forEach(event => {
            if (event.recurrence && event.recurrence.type !== 'none') {
                // 繰り返しイベントの発生日を生成
                for (let i = 0; i < MAX_FUTURE_DAYS; i++) {
                    const occurrenceDate = new Date(today);
                    occurrenceDate.setDate(today.getDate() + i);
                    
                    let shouldAdd = false;
                    if (event.recurrence.type === 'daily') {
                        shouldAdd = true;
                    } else if (event.recurrence.type === 'weekly') {
                        const dayOfWeekStr = getDayOfWeekString(occurrenceDate);
                        if (event.recurrence.daysOfWeek && event.recurrence.daysOfWeek.includes(dayOfWeekStr)) {
                            shouldAdd = true;
                        }
                    }

                    if (shouldAdd) {
                        futureEventsAndOccurrences.push({
                            ...event,
                            displayDate: formatDate(occurrenceDate), // この発生日の日付
                            isOccurrence: true // 繰り返し発生したものであることを示す
                        });
                    }
                }
            } else {
                // 単発イベント
                const eventDate = new Date(event.date);
                eventDate.setHours(0, 0, 0, 0);
                if (eventDate >= today) { // 今日以降の単発イベントのみ表示
                    futureEventsAndOccurrences.push({
                        ...event,
                        displayDate: event.date, // 元の日付
                        isOccurrence: false
                    });
                }
            }
        });

        // 日付でソート
        futureEventsAndOccurrences.sort((a, b) => new Date(a.displayDate) - new Date(b.displayDate));

        const groupedEvents = {};
        futureEventsAndOccurrences.forEach(event => {
            const dateKey = event.displayDate;
            if (!groupedEvents[dateKey]) {
                groupedEvents[dateKey] = [];
            }
            groupedEvents[dateKey].push(event);
        });

        // 日付ごとに表示
        for (const dateKey of Object.keys(groupedEvents).sort()) { // 日付キーでソート
            const dateHeader = document.createElement('h3');
            dateHeader.className = 'date-group-header';
            dateHeader.textContent = dateKey; // 例: 2023-10-27
            eventList.appendChild(dateHeader);

            groupedEvents[dateKey].forEach(event => {
                const eventContainer = document.createElement('li');
                eventContainer.className = 'event-item-container';
                // 繰り返し発生したイベントも、元のイベントIDを持つ
                eventContainer.dataset.id = event.id; 

                const eventHeader = document.createElement('div');
                eventHeader.className = 'event-header';

                const eventTitleDisplay = document.createElement('span');
                eventTitleDisplay.className = 'event-title-display';
                eventTitleDisplay.textContent = event.name;
                eventTitleDisplay.dataset.id = event.id;
                eventTitleDisplay.dataset.type = 'event-name';

                const eventDateDisplay = document.createElement('span');
                eventDateDisplay.className = 'event-date-display';
                // 繰り返しイベントの場合、元の登録日付ではなく、発生日付を表示
                if (event.recurrence && event.recurrence.type !== 'none') {
                     eventDateDisplay.textContent = `(繰り返し)`; // 繰り返しであることを示す
                } else if (event.date) {
                    eventDateDisplay.textContent = `(${event.date})`;
                }
                eventDateDisplay.dataset.id = event.id;
                eventDateDisplay.dataset.type = 'event-date';

                const deleteEventButton = document.createElement('button');
                deleteEventButton.className = 'delete-button';
                deleteEventButton.textContent = '予定削除';
                deleteEventButton.dataset.id = event.id;
                deleteEventButton.dataset.type = 'event-delete';

                eventHeader.appendChild(eventTitleDisplay);
                eventHeader.appendChild(eventDateDisplay); // 日付表示は常に
                eventHeader.appendChild(deleteEventButton);
                eventContainer.appendChild(eventHeader);

                // 持ち物リスト
                const itemListSub = document.createElement('ul');
                itemListSub.className = 'item-list-sub';
                
                const eventItems = allItems.filter(item => item.eventId === event.id);
                eventItems.forEach(item => {
                    const itemLi = document.createElement('li');
                    itemLi.dataset.id = item.id;
                    itemLi.innerHTML = `
                        <input type="checkbox" ${item.checked ? 'checked' : ''} data-type="item-checkbox">
                        <span class="item-name-display" data-id="${item.id}" data-type="item-name">${item.name}</span>
                        <button class="delete-button" data-id="${item.id}" data-type="item-delete">削除</button>
                    `;
                    itemListSub.appendChild(itemLi);
                });
                eventContainer.appendChild(itemListSub);

                // 持ち物追加フォーム
                const addItemContainer = document.createElement('div');
                addItemContainer.className = 'add-container';
                addItemContainer.innerHTML = `
                    <input type="text" class="new-item-input" placeholder="新しい持ち物名">
                    <button class="add-item-button" data-event-id="${event.id}">追加</button>
                `;
                eventContainer.appendChild(addItemContainer);

                eventList.appendChild(eventContainer);
            });
        }
    }

    // 繰り返しラジオボタンの変更監視
    recurrenceRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (document.querySelector('input[name="recurrence-type"]:checked').value === 'weekly') {
                weeklyDaysContainer.classList.remove('hidden');
            } else {
                weeklyDaysContainer.classList.add('hidden');
            }
        });
    });

    // イベント追加ボタン
    addEventButton.addEventListener('click', async () => {
        const name = newEventNameInput.value.trim();
        const date = newEventDateInput.value; // YYYY-MM-DD 形式
        const recurrenceType = document.querySelector('input[name="recurrence-type"]:checked').value;
        let recurrence = { type: recurrenceType };

        if (recurrenceType === 'weekly') {
            const selectedDays = Array.from(weeklyDayCheckboxes)
                                    .filter(cb => cb.checked)
                                    .map(cb => cb.value);
            if (selectedDays.length === 0) {
                alert('毎週繰り返しの場合は、曜日を一つ以上選択してください。');
                return;
            }
            recurrence.daysOfWeek = selectedDays;
        }

        if (name) {
            // 単発イベントで日付が未入力の場合、今日の日付をデフォルトにする
            const finalDate = date || (recurrenceType === 'none' ? formatDate(new Date()) : '');

            await addData(STORE_EVENTS, { name, date: finalDate, recurrence });
            newEventNameInput.value = '';
            newEventDateInput.value = '';
            document.querySelector('input[name="recurrence-type"][value="none"]').checked = true; // デフォルトに戻す
            weeklyDaysContainer.classList.add('hidden'); // 曜日選択を隠す
            weeklyDayCheckboxes.forEach(cb => cb.checked = false); // 曜日選択をリセット
            displayAllEventsAndItems();
        }
    });

    // イベントリスナーの委譲 (動的に生成される要素に対応)
    eventList.addEventListener('click', async (e) => {
        // 予定削除ボタン
        if (e.target.dataset.type === 'event-delete') {
            const eventId = parseInt(e.target.dataset.id);
            if (confirm('この予定と関連する持ち物を全て削除しますか？')) {
                await deleteData(STORE_EVENTS, eventId);
                const itemsToDelete = (await getAllData(STORE_ITEMS)).filter(item => item.eventId === eventId);
                for (const item of itemsToDelete) {
                    await deleteData(STORE_ITEMS, item.id);
                }
                displayAllEventsAndItems();
            }
        }
        // 持ち物追加ボタン
        else if (e.target.classList.contains('add-item-button')) {
            const eventId = parseInt(e.target.dataset.eventId);
            const newItemInput = e.target.previousElementSibling; // input要素
            const name = newItemInput.value.trim();
            if (name) {
                await addData(STORE_ITEMS, { eventId: eventId, name, checked: false });
                newItemInput.value = '';
                displayAllEventsAndItems(); // 全体を再描画
            }
        }
        // 持ち物チェックボックス
        else if (e.target.dataset.type === 'item-checkbox') {
            const itemId = parseInt(e.target.closest('li').dataset.id);
            const item = (await getAllData(STORE_ITEMS)).find(i => i.id === itemId);
            if (item) {
                item.checked = e.target.checked;
                await updateData(STORE_ITEMS, item);
            }
        }
        // 持ち物削除ボタン
        else if (e.target.dataset.type === 'item-delete') {
            const itemId = parseInt(e.target.dataset.id);
            if (confirm('この持ち物を削除しますか？')) {
                await deleteData(STORE_ITEMS, itemId);
                displayAllEventsAndItems(); // 全体を再描画
            }
        }
    });

    // 編集機能のイベントリスナー (予定名、日付、持ち物名)
    eventList.addEventListener('dblclick', async (e) => { // ダブルクリックで編集開始
        const target = e.target;
        const dataType = target.dataset.type;
        
        if (dataType === 'event-name' || dataType === 'event-date' || dataType === 'item-name') {
            const originalValue = target.textContent.replace('(', '').replace(')', '').trim(); // 日付の括弧を削除
            const id = parseInt(target.dataset.id);
            let inputElement;

            if (dataType === 'event-date') {
                // 繰り返しイベントの日付は編集不可 (元のイベントの日付は編集可能)
                const eventData = (await getAllData(STORE_EVENTS)).find(e => e.id === id);
                if (eventData && eventData.recurrence && eventData.recurrence.type !== 'none') {
                    alert('繰り返し設定された予定の日付は直接編集できません。予定の繰り返し設定を変更してください。');
                    return;
                }
                inputElement = document.createElement('input');
                inputElement.type = 'date';
                inputElement.className = 'edit-date-input'; // 日付専用のCSSクラス
                inputElement.value = originalValue; // YYYY-MM-DD 形式
            } else {
                inputElement = document.createElement('input');
                inputElement.type = 'text';
                inputElement.className = 'edit-input';
                inputElement.value = originalValue;
            }

            target.replaceWith(inputElement);
            inputElement.focus();

            const saveChanges = async () => {
                const newValue = inputElement.value.trim();
                if (newValue !== originalValue) {
                    let data;
                    if (dataType === 'event-name') {
                        data = (await getAllData(STORE_EVENTS)).find(e => e.id === id);
                        if (data) {
                            data.name = newValue;
                            await updateData(STORE_EVENTS, data);
                        }
                    } else if (dataType === 'event-date') {
                        data = (await getAllData(STORE_EVENTS)).find(e => e.id === id);
                        if (data) {
                            data.date = newValue; // 日付はそのまま保存
                            await updateData(STORE_EVENTS, data);
                        }
                    } else { // item-name
                        data = (await getAllData(STORE_ITEMS)).find(i => i.id === id);
                        if (data) {
                            data.name = newValue;
                            await updateData(STORE_ITEMS, data);
                        }
                    }
                }
                displayAllEventsAndItems(); // 再描画して変更を反映
            };

            inputElement.addEventListener('blur', saveChanges); // フォーカスが外れたら保存
            inputElement.addEventListener('keypress', (event) => {
                if (event.key === 'Enter') {
                    inputElement.blur(); // Enterキーで保存
                }
            });
        }
    });


    // アプリ初期化
    openDB().then(() => {
        displayAllEventsAndItems();
    });

    // Service Workerの登録 (変更なし)
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