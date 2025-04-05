// 獲取 DOM 元素
const loginPage = document.getElementById('loginPage');
const mainPage = document.getElementById('mainPage');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');

// Google 登入
googleLoginBtn.addEventListener('click', async () => {
    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.setCustomParameters({
            prompt: 'select_account'
        });
        const result = await firebase.auth().signInWithPopup(provider);
        console.log('登入成功:', result.user);
    } catch (error) {
        console.error('登入失敗:', error);
        alert(`登入失敗: ${error.message}`);
    }
});

// 登出
logoutBtn.addEventListener('click', async () => {
    try {
        await firebase.auth().signOut();
        console.log('登出成功');
    } catch (error) {
        console.error('登出失敗:', error);
        alert(`登出失敗: ${error.message}`);
    }
});

// 監聽登入狀態
firebase.auth().onAuthStateChanged(async (user) => {
    console.log('登入狀態改變:', user);
    if (user) {
        // 使用者已登入
        loginPage.classList.add('hidden');
        mainPage.classList.remove('hidden');
        
        // 更新使用者資訊
        userAvatar.src = user.photoURL || 'assets/default-avatar.png';
        userName.textContent = user.displayName || '使用者';
        
        // 檢查是否為官方帳號
        const isOfficial = await barcodeService.isOfficialAccount();
        if (isOfficial) {
            userName.innerHTML = `${user.displayName || '使用者'} <span class="official-badge">官方帳號</span>`;
        }
        
        // 初始化資料（在 app.js 中定義）
        if (typeof initializeData === 'function') {
            initializeData();
        }
    } else {
        // 使用者未登入
        loginPage.classList.remove('hidden');
        mainPage.classList.add('hidden');
    }
}); 