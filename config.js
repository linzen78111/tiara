// Firebase 配置
const firebaseConfig = {
    apiKey: "AIzaSyAw6yraVBiMPyF9ab4VtgMTaQfqEYhbtTE",
    authDomain: "chaoshangtiaoma.firebaseapp.com",
    projectId: "chaoshangtiaoma",
    storageBucket: "chaoshangtiaoma.firebasestorage.app",
    messagingSenderId: "995621789085",
    appId: "1:995621789085:web:8e893bb24c37e37f922374",
    measurementId: "G-Y5B9YRTKV1"
};

// 初始化 Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// 啟用 Firestore 快取
firebase.firestore().enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('快取啟用失敗：多個分頁開啟');
        } else if (err.code == 'unimplemented') {
            console.log('瀏覽器不支援快取');
        }
    });

// 初始化 Firestore
const db = firebase.firestore();

// 初始化 Auth
const auth = firebase.auth();

// 設定 Auth 語言
auth.useDeviceLanguage();

// 初始化 Analytics
firebase.analytics(); 