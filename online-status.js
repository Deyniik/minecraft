// online-status.js - подключите этот файл на ВСЕХ страницах сайта
(function() {
    const firebaseConfig = {
        apiKey: "AIzaSyBk4nxZ1ldNQUCxsbgaeYTkm9stq0o9o2Q",
        authDomain: "deygram-e4814.firebaseapp.com",
        projectId: "deygram-e4814",
        storageBucket: "deygram-e4814.firebasestorage.app",
        messagingSenderId: "591207353726",
        appId: "1:591207353726:web:d20f5e648d3daf86fcb72f"
    };

    // Проверяем, не инициализировано ли уже
    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }
    
    const auth = firebase.auth();
    const db = firebase.firestore();
    
    let heartbeatInterval = null;
    let currentUser = null;
    
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            setupOnlineStatus();
        } else {
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
            }
        }
    });
    
    function setupOnlineStatus() {
        if (!currentUser) return;
        
        const userRef = db.collection('onlineUsers').doc(currentUser.uid);
        
        const setOnline = () => {
            userRef.set({
                online: true,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
                uid: currentUser.uid
            });
        };
        
        setOnline();
        
        heartbeatInterval = setInterval(setOnline, 30000);
        
        window.addEventListener('beforeunload', () => {
            userRef.update({ 
                online: false,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp() 
            });
            if (heartbeatInterval) {
                clearInterval(heartbeatInterval);
            }
        });
    }
})();
