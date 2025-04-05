// 獲取 DOM 元素
const toggleSidebarBtn = document.getElementById('toggleSidebar');
const sidebar = document.querySelector('.sidebar');
const mainContent = document.querySelector('.main-content');
const searchInput = document.getElementById('searchInput');
const storeFilter = document.getElementById('storeFilter');
const barcodeList = document.getElementById('barcodeList');
const navItems = document.querySelectorAll('.nav-item');

// 上傳相關元素
const uploadButton = document.getElementById('uploadButton');
const uploadModal = document.getElementById('uploadModal');
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const previewArea = document.querySelector('.upload-preview');
const previewTable = document.querySelector('.preview-table');
const btnUpload = document.querySelector('.btn-upload');

// 條碼資料類別
class BarcodeData {
    constructor(data) {
        this.code = data.code || '';
        this.createdAt = data.createdAt || Date.now();
        this.description = data.description || '';
        this.fromOfficial = data.fromOfficial || false;
        this.id = data.id || 0;
        this.lastSyncTime = data.lastSyncTime || Date.now();
        this.last_updated = data.last_updated ? new Date(data.last_updated) : new Date();
        this.name = data.name || '';
        this.price = data.price || 0;
        this.store = data.store || '';
        this.syncStatus = data.syncStatus || 0;
        this.type = data.type || 'EAN-13';
        this.updatedAt = data.updatedAt || Date.now();
        this.user_id = data.user_id || '';
    }

    toFirestore() {
        return {
            code: this.code,
            createdAt: this.createdAt,
            description: this.description,
            fromOfficial: this.fromOfficial,
            id: this.id,
            lastSyncTime: this.lastSyncTime,
            last_updated: firebase.firestore.Timestamp.fromDate(this.last_updated),
            name: this.name,
            price: this.price,
            store: this.store,
            syncStatus: this.syncStatus,
            type: this.type,
            updatedAt: this.updatedAt,
            user_id: this.user_id
        };
    }

    static fromFirestore(doc) {
        const data = doc.data();
        return new BarcodeData({
            ...data,
            last_updated: data.last_updated?.toDate()
        });
    }
}

// 條碼服務
const barcodeService = {
    db: firebase.firestore(),
    
    // 檢查是否為官方帳號
    async isOfficialAccount() {
        const user = firebase.auth().currentUser;
        if (!user) return false;
        
        // 指定官方帳號的 email
        const officialEmail = 'apple0902303636@gmail.com';
        return user.email === officialEmail;
    },
    
    // 載入條碼資料
    async loadBarcodes() {
        try {
            const user = firebase.auth().currentUser;
            if (!user) throw new Error('請先登入');
            
            const barcodes = [];
            
            // 查詢官方 711 商店的條碼資料
            console.log('載入官方資料...');
            const officialSnapshot = await this.db
                .collection('official')
                .doc('data')
                .collection('stores')
                .doc('711')
                .collection('barcodes')
                .get();
            
            officialSnapshot.forEach(doc => {
                const data = doc.data();
                barcodes.push({
                    id: doc.id,
                    ...data,
                    fromOfficial: true
                });
            });
            
            console.log('載入的官方條碼資料數量:', officialSnapshot.size);
            
            // 查詢個人的 711 商店條碼資料
            console.log('載入個人資料...');
            const userSnapshot = await this.db
                .collection('users')
                .doc(user.uid)
                .collection('stores')
                .doc('711')
                .collection('barcodes')
                .get();
            
            userSnapshot.forEach(doc => {
                const data = doc.data();
                barcodes.push({
                    id: doc.id,
                    ...data,
                    fromOfficial: false
                });
            });
            
            console.log('載入的個人條碼資料數量:', userSnapshot.size);
            console.log('總共載入資料數量:', barcodes.length);
            
            return barcodes;
        } catch (error) {
            console.error('載入條碼資料時發生錯誤:', error);
            throw error;
        }
    },
    
    // 儲存條碼資料
    async saveBarcode(barcodeData) {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('請先登入');
        
        const isOfficial = await this.isOfficialAccount();
        const store = barcodeData.store;
        
        // 根據是否為官方帳號決定儲存路徑
        let docRef;
        if (isOfficial) {
            docRef = this.db
                .collection('official')
                .doc('data')
                .collection('stores')
                .doc(store)
                .collection('barcodes')
                .doc(barcodeData.code);
                
            barcodeData.fromOfficial = true;
        } else {
            docRef = this.db
                .collection('users')
                .doc(user.uid)
                .collection('stores')
                .doc(store)
                .collection('barcodes')
                .doc(barcodeData.code);
                
            barcodeData.fromOfficial = false;
            barcodeData.user_id = user.uid;
        }
        
        // 添加時間戳和其他必要欄位
        barcodeData.createdAt = barcodeData.createdAt || firebase.firestore.Timestamp.now();
        barcodeData.updatedAt = firebase.firestore.Timestamp.now();
        
        await docRef.set(barcodeData, { merge: true });
    },
    
    // 批量上傳條碼資料
    async bulkUploadBarcodes(data) {
        try {
            const user = firebase.auth().currentUser;
            if (!user) throw new Error('請先登入');
            
            const isOfficial = await this.isOfficialAccount();
            const batch = this.db.batch();
            const timestamp = firebase.firestore.Timestamp.now();
            
            // 將條碼資料按商店分組
            const storeGroups = {};
            data.forEach(barcode => {
                if (!storeGroups[barcode.store]) {
                    storeGroups[barcode.store] = [];
                }
                storeGroups[barcode.store].push(barcode);
            });
            
            // 批次處理每個商店的條碼
            for (const [store, storeBarcodes] of Object.entries(storeGroups)) {
                for (const barcode of storeBarcodes) {
                    // 根據用戶身份決定存儲路徑
                    let docRef;
                    if (isOfficial) {
                        docRef = this.db
                            .collection('official')
                            .doc('data')
                            .collection('stores')
                            .doc(store)
                            .collection('barcodes')
                            .doc(barcode.code);
                    } else {
                        docRef = this.db
                            .collection('users')
                            .doc(user.uid)
                            .collection('stores')
                            .doc(store)
                            .collection('barcodes')
                            .doc(barcode.code);
                    }
                    
                    const barcodeData = {
                        ...barcode,
                        fromOfficial: isOfficial,
                        createdAt: timestamp,
                        updatedAt: timestamp,
                        user_id: user.uid
                    };
                    
                    batch.set(docRef, barcodeData, { merge: true });
                }
            }
            
            await batch.commit();
        } catch (error) {
            console.error('批量上傳失敗:', error);
            throw error;
        }
    },
    
    // 獲取條碼資料
    async getBarcode(code, store) {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('請先登入');
        
        // 先查詢官方資料
        const officialDoc = await this.db.doc(`official/data/stores/${store}/barcodes/${code}`).get();
        if (officialDoc.exists) {
            return new BarcodeData(officialDoc.data());
        }
        
        // 再查詢使用者資料
        const userDoc = await this.db.doc(`users/${user.uid}/stores/${store}/barcodes/${code}`).get();
        if (userDoc.exists) {
            return new BarcodeData(userDoc.data());
        }
        
        return null;
    },
    
    // 刪除條碼資料
    async deleteBarcode(code, store) {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('請先登入');
        
        const isOfficial = await this.isOfficialAccount();
        if (isOfficial) {
            await this.db.doc(`official/data/stores/${store}/barcodes/${code}`).delete();
        } else {
            await this.db.doc(`users/${user.uid}/stores/${store}/barcodes/${code}`).delete();
        }
    }
};

// 載入條碼資料
async function loadBarcodes() {
    try {
        console.log('開始執行 loadBarcodes 函數');
        const searchText = searchInput.value.toLowerCase();
        const store = storeFilter.value;
        const currentPage = document.querySelector('.nav-item.active').dataset.page;
        
        console.log('搜尋條件:', { searchText, store, currentPage });
        const barcodes = await barcodeService.loadBarcodes(store);
        
        // 根據當前頁面過濾資料
        let filteredBarcodes = barcodes.filter(barcode => {
            // 根據頁面類型過濾
            if (currentPage === 'official' && !barcode.fromOfficial) return false;
            if (currentPage === 'personal' && barcode.fromOfficial) return false;
            
            // 搜尋文字過濾
            if (!searchText) return true;
            
            // 將所有可搜尋的欄位轉為小寫，避免 null 或 undefined
            const name = (barcode.name || '').toLowerCase();
            const code = (barcode.code || '').toLowerCase();
            const description = (barcode.description || '').toLowerCase();
            const store = (barcode.store || '').toLowerCase();
            
            // 檢查是否符合搜尋條件
            return name.includes(searchText) || 
                   code.includes(searchText) || 
                   description.includes(searchText) ||
                   store.includes(searchText);
        });
        
        console.log('過濾後資料數量:', filteredBarcodes.length);
        displayBarcodes(filteredBarcodes);
    } catch (error) {
        console.error('載入條碼資料失敗:', error);
        alert('載入條碼資料失敗，請稍後再試');
    }
}

// 顯示條碼資料
function displayBarcodes(barcodes) {
    barcodeList.innerHTML = '';
    
    if (barcodes.length === 0) {
        barcodeList.innerHTML = '<div class="no-data">沒有找到相關資料</div>';
        return;
    }
    
    barcodes.forEach(barcode => {
        const item = document.createElement('div');
        item.className = 'barcode-item';
        
        // 如果描述中包含搜尋文字，則顯示部分描述
        const searchText = searchInput.value.toLowerCase();
        let descriptionPreview = '';
        
        if (searchText && barcode.description) {
            const description = barcode.description.toLowerCase();
            const index = description.indexOf(searchText);
            if (index !== -1) {
                // 擷取搜尋文字前後的一些內容
                const start = Math.max(0, index - 20);
                const end = Math.min(description.length, index + searchText.length + 20);
                descriptionPreview = `
                    <p class="description-preview">
                        ${start > 0 ? '...' : ''}
                        ${barcode.description.substring(start, end)}
                        ${end < description.length ? '...' : ''}
                    </p>
                `;
            }
        }
        
        item.innerHTML = `
            <h3>${barcode.name || '未命名商品'}</h3>
            <p>條碼: ${barcode.code || '無'}</p>
            <p>價格: $${barcode.price || 0}</p>
            <p>商店: ${barcode.store || '未知'}</p>
            ${descriptionPreview}
            ${barcode.fromOfficial ? '<span class="official-badge">官方資料</span>' : '<span class="personal-badge">個人資料</span>'}
        `;
        
        item.addEventListener('click', () => showBarcodeDetails(barcode));
        barcodeList.appendChild(item);
    });
}

// 顯示條碼詳細資訊
function showBarcodeDetails(barcode) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    const content = document.createElement('div');
    content.className = 'modal-content';
    
    // 格式化時間戳記
    const createdAt = barcode.createdAt ? new Date(barcode.createdAt.seconds * 1000).toLocaleString('zh-TW') : '無';
    const updatedAt = barcode.updatedAt ? new Date(barcode.updatedAt.seconds * 1000).toLocaleString('zh-TW') : '無';
    
    content.innerHTML = `
        <h2>${barcode.name || '未命名商品'}</h2>
        <div class="barcode-details">
            <div class="barcode-image-container">
                <svg id="barcode"></svg>
            </div>
            <p><strong>條碼:</strong> ${barcode.code || '無'}</p>
            <p><strong>價格:</strong> $${barcode.price || 0}</p>
            <p><strong>商店:</strong> ${barcode.store || '未知'}</p>
            <p><strong>描述:</strong> ${barcode.description || '無'}</p>
            <p><strong>建立時間:</strong> ${createdAt}</p>
            <p><strong>更新時間:</strong> ${updatedAt}</p>
        </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // 生成條碼
    try {
        if (barcode.code) {
            // 根據條碼長度決定格式
            let format;
            const code = barcode.code.replace(/\D/g, ''); // 移除非數字字符
            
            switch (code.length) {
                case 8:
                    format = "EAN8";
                    break;
                case 13:
                    format = "EAN13";
                    break;
                case 14:
                    format = "ITF14";
                    break;
                default:
                    format = "CODE128";
            }
            
            JsBarcode("#barcode", code, {
                format: format,
                width: 2,
                height: 100,
                displayValue: true,
                fontSize: 16,
                margin: 10,
                background: "#ffffff",
                lineColor: "#000000"
            });
        }
    } catch (error) {
        console.error('生成條碼失敗:', error);
        console.error('條碼資料:', barcode.code);
        const barcodeContainer = content.querySelector('.barcode-image-container');
        barcodeContainer.innerHTML = `
            <p class="error">無法生成條碼</p>
            <p class="error-details">錯誤原因：${error.message}</p>
        `;
    }
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// 事件監聽
toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
});

searchInput.addEventListener('input', () => {
    loadBarcodes();
});

storeFilter.addEventListener('change', () => {
    loadBarcodes();
});

// 掃描相關變數
let html5QrcodeScanner = null;
const scanPage = document.getElementById('scanPage');
const scanResult = document.getElementById('scanResult');
const barcodeForm = document.getElementById('barcodeForm');
const codeInput = document.getElementById('code');
const nameInput = document.getElementById('name');
const priceInput = document.getElementById('price');
const storeInput = document.getElementById('store');
const descriptionInput = document.getElementById('description');

// 初始化掃描器
function initializeScanner() {
    html5QrcodeScanner = new Html5QrcodeScanner(
        "reader", 
        { 
            fps: 10,
            qrbox: {width: 250, height: 250},
            aspectRatio: 1.0
        }
    );
    
    html5QrcodeScanner.render(onScanSuccess, onScanFailure);
}

// 掃描成功處理
function onScanSuccess(decodedText, decodedResult) {
    console.log('條碼掃描成功:', decodedText);
    html5QrcodeScanner.pause();
    
    // 填入表單
    codeInput.value = decodedText;
    scanResult.classList.remove('hidden');
    
    // 查詢是否已有此條碼資料
    barcodeService.getBarcode(decodedText, storeInput.value)
        .then(existingBarcode => {
            if (existingBarcode) {
                nameInput.value = existingBarcode.name || '';
                priceInput.value = existingBarcode.price || '';
                descriptionInput.value = existingBarcode.description || '';
            }
        })
        .catch(error => {
            console.error('查詢條碼資料失敗:', error);
        });
}

// 掃描失敗處理
function onScanFailure(error) {
    // console.warn('條碼掃描失敗:', error);
}

// 表單提交處理
barcodeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const barcodeData = {
            code: codeInput.value,
            name: nameInput.value,
            price: Number(priceInput.value),
            store: storeInput.value,
            description: descriptionInput.value,
            type: 'EAN13', // 預設使用 EAN13
            createdAt: firebase.firestore.Timestamp.now(),
            updatedAt: firebase.firestore.Timestamp.now()
        };
        
        await barcodeService.saveBarcode(barcodeData);
        alert('儲存成功！');
        
        // 重置表單
        barcodeForm.reset();
        scanResult.classList.add('hidden');
        
        // 重新開始掃描
        html5QrcodeScanner.resume();
    } catch (error) {
        console.error('儲存條碼資料失敗:', error);
        alert('儲存失敗：' + error.message);
    }
});

// 取消按鈕處理
document.querySelector('.btn-cancel').addEventListener('click', () => {
    scanPage.classList.add('hidden');
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
        html5QrcodeScanner = null;
    }
});

// 重新掃描按鈕處理
document.querySelector('.btn-rescan').addEventListener('click', () => {
    scanResult.classList.add('hidden');
    barcodeForm.reset();
    html5QrcodeScanner.resume();
});

// 修改導航項目點擊事件
navItems.forEach(item => {
    item.addEventListener('click', () => {
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        const page = item.dataset.page;
        if (page === 'scan') {
            scanPage.classList.remove('hidden');
            if (!html5QrcodeScanner) {
                initializeScanner();
            }
        } else if (page === 'upload') {
            uploadModal.classList.remove('hidden');
        } else {
            scanPage.classList.add('hidden');
            uploadModal.classList.add('hidden');
            if (html5QrcodeScanner) {
                html5QrcodeScanner.clear();
                html5QrcodeScanner = null;
            }
            loadBarcodes();
        }
    });
});

// 檢查是否為官方帳號並顯示上傳按鈕
async function checkAndShowUploadButton() {
    uploadButton.classList.remove('hidden');
}

// 初始化拖放區域
function initializeDropZone() {
    dropZone.addEventListener('click', () => fileInput.click());
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });
}

// 處理上傳的檔案
async function handleFile(file) {
    if (!file.name.match(/\.(csv|xlsx)$/i)) {
        alert('請上傳 CSV 或 Excel 檔案');
        return;
    }
    
    try {
        const data = await readFile(file);
        showPreview(data);
        btnUpload.disabled = false;
    } catch (error) {
        console.error('讀取檔案失敗:', error);
        alert('讀取檔案失敗：' + error.message);
    }
}

// 讀取檔案內容
function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                let data;
                if (file.name.endsWith('.csv')) {
                    data = parseCSV(e.target.result);
                } else {
                    // 使用 XLSX 處理 Excel 檔案
                    const workbook = XLSX.read(e.target.result, { type: 'binary' });
                    data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
                }
                resolve(data);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('檔案讀取失敗'));
        
        if (file.name.endsWith('.csv')) {
            reader.readAsText(file);
        } else {
            reader.readAsBinaryString(file);
        }
    });
}

// 解析 CSV 檔案
function parseCSV(csv) {
    const lines = csv.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        
        const values = lines[i].split(',').map(v => v.trim());
        const row = {};
        
        headers.forEach((header, index) => {
            row[header] = values[index];
        });
        
        data.push(row);
    }
    
    return data;
}

// 顯示預覽
function showPreview(data) {
    if (!data.length) {
        alert('檔案中沒有資料');
        return;
    }
    
    const headers = Object.keys(data[0]);
    let html = '<table><thead><tr>';
    
    // 表頭
    headers.forEach(header => {
        html += `<th>${header}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // 資料行（最多顯示 5 筆）
    data.slice(0, 5).forEach(row => {
        html += '<tr>';
        headers.forEach(header => {
            html += `<td>${row[header] || ''}</td>`;
        });
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    
    previewTable.innerHTML = html;
    previewArea.classList.remove('hidden');
}

// 上傳按鈕點擊處理
btnUpload.addEventListener('click', async () => {
    try {
        const data = await readFile(fileInput.files[0]);
        await barcodeService.bulkUploadBarcodes(data);
        alert('上傳成功！');
        uploadModal.classList.add('hidden');
        loadBarcodes(); // 重新載入資料
    } catch (error) {
        console.error('上傳失敗:', error);
        alert('上傳失敗：' + error.message);
    }
});

// 取消按鈕點擊處理
document.querySelector('.btn-cancel').addEventListener('click', () => {
    uploadModal.classList.add('hidden');
});

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    initializeDropZone();
    checkAndShowUploadButton();
});

// 初始化資料
async function initializeData() {
    try {
        // 預設顯示官方資料頁面
        const officialTab = document.querySelector('[data-page="official"]');
        if (officialTab) {
            officialTab.classList.add('active');
        }
        await loadBarcodes();
    } catch (error) {
        console.error('初始化失敗:', error);
        alert('資料載入失敗，請重新整理頁面');
    }
}

// 本地儲存的條碼資料
let localBarcodes = [];

// 處理條碼表單提交
document.getElementById('barcodeForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const formData = {
        name: document.getElementById('name').value,
        code: document.getElementById('code').value,
        price: parseFloat(document.getElementById('price').value),
        store: document.getElementById('store').value,
        description: document.getElementById('description').value,
        createdAt: new Date(),
        updatedAt: new Date()
    };

    // 儲存到本地陣列
    localBarcodes.push(formData);
    updateLocalBarcodeList();

    // 重置表單
    this.reset();
    document.getElementById('scanResult').classList.add('hidden');
    startScanning();
});

// 更新本地條碼列表顯示
function updateLocalBarcodeList() {
    const container = document.querySelector('.barcode-items');
    const count = document.getElementById('localBarcodeCount');
    
    // 更新計數
    count.textContent = localBarcodes.length;
    
    // 清空並重新填充列表
    container.innerHTML = '';
    localBarcodes.forEach((barcode, index) => {
        const item = document.createElement('div');
        item.className = 'barcode-item';
        item.innerHTML = `
            <div class="barcode-info">
                <strong>${barcode.name}</strong>
                <span>${barcode.code}</span>
                <span>${barcode.store}</span>
                <span>$${barcode.price}</span>
            </div>
            <button class="btn-delete" data-index="${index}">❌</button>
        `;
        container.appendChild(item);
    });

    // 為刪除按鈕添加事件監聽
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            localBarcodes.splice(index, 1);
            updateLocalBarcodeList();
        });
    });
}

// 處理上傳按鈕點擊
document.getElementById('uploadButton').addEventListener('click', function() {
    if (localBarcodes.length === 0) {
        alert('沒有可上傳的條碼資料！');
        return;
    }
    document.getElementById('uploadModal').classList.remove('hidden');
});

// 處理確認上傳
document.querySelector('#uploadModal .btn-upload').addEventListener('click', async function() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) throw new Error('請先登入');
        
        const isOfficial = await barcodeService.isOfficialAccount();
        const batch = db.batch();
        const timestamp = firebase.firestore.Timestamp.now();
        
        // 將條碼資料按商店分組並上傳
        for (const barcode of localBarcodes) {
            let docRef;
            if (isOfficial) {
                docRef = db
                    .collection('official')
                    .doc('data')
                    .collection('stores')
                    .doc(barcode.store)
                    .collection('barcodes')
                    .doc(barcode.code);
            } else {
                docRef = db
                    .collection('users')
                    .doc(user.uid)
                    .collection('stores')
                    .doc(barcode.store)
                    .collection('barcodes')
                    .doc(barcode.code);
            }
            
            const barcodeData = {
                ...barcode,
                fromOfficial: isOfficial,
                createdAt: timestamp,
                updatedAt: timestamp,
                user_id: user.uid
            };
            
            batch.set(docRef, barcodeData, { merge: true });
        }
        
        await batch.commit();
        
        // 清空本地儲存
        localBarcodes = [];
        updateLocalBarcodeList();
        
        // 關閉對話框
        document.getElementById('uploadModal').classList.add('hidden');
        
        alert('上傳成功！');
    } catch (error) {
        console.error('上傳失敗:', error);
        alert('上傳失敗：' + error.message);
    }
});

// 處理取消上傳
document.querySelector('#uploadModal .btn-cancel').addEventListener('click', function() {
    document.getElementById('uploadModal').classList.add('hidden');
});

// 處理返回按鈕點擊
document.querySelector('.btn-back').addEventListener('click', () => {
    // 隱藏掃描頁面
    scanPage.classList.add('hidden');
    
    // 停止掃描器
    if (html5QrcodeScanner) {
        html5QrcodeScanner.clear();
        html5QrcodeScanner = null;
    }
    
    // 重置表單
    barcodeForm.reset();
    scanResult.classList.add('hidden');
    
    // 移除導航項目的 active 狀態
    navItems.forEach(item => item.classList.remove('active'));
    // 設置官方資料頁面為活動狀態
    document.querySelector('[data-page="official"]').classList.add('active');
    
    // 重新載入條碼列表
    loadBarcodes();
}); 