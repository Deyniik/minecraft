// common.js - общие функции для всего сайта

// Firebase конфигурация
const firebaseConfig = {
    apiKey: "AIzaSyBk4nxZ1ldNQUCxsbgaeYTkm9stq0o9o2Q",
    authDomain: "deygram-e4814.firebaseapp.com",
    projectId: "deygram-e4814",
    storageBucket: "deygram-e4814.firebasestorage.app",
    messagingSenderId: "591207353726",
    appId: "1:591207353726:web:d20f5e648d3daf86fcb72f"
};

// Инициализация Firebase если не инициализирована
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// Глобальные переменные
window.currentUser = null;
window.savedProjects = new Set();
window.cachedTranslations = new Map();

// ========== УВЕДОМЛЕНИЯ (TOAST) ==========
window.showToast = function(message, type = 'success') {
    // Удаляем старый тост если есть
    const existingToast = document.querySelector('.custom-toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
};

// Добавляем стили для тостов динамически
const toastStyles = document.createElement('style');
toastStyles.textContent = `
    .custom-toast {
        position: fixed;
        bottom: 20px;
        right: 20px;
        background-color: var(--bg-raised);
        border-left: 4px solid var(--text-brand);
        border-radius: 8px;
        padding: 12px 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        font-size: 14px;
        max-width: 350px;
    }
    .custom-toast.show {
        transform: translateX(0);
    }
    .custom-toast.success {
        border-left-color: #2bde73;
    }
    .custom-toast.error {
        border-left-color: #ff4444;
    }
    .custom-toast.info {
        border-left-color: var(--text-brand);
    }
    .toast-content {
        display: flex;
        align-items: center;
        gap: 10px;
        color: var(--text-primary);
    }
    .toast-content i {
        font-size: 18px;
    }
    .custom-toast.success i {
        color: #2bde73;
    }
    .custom-toast.error i {
        color: #ff4444;
    }
    .custom-toast.info i {
        color: var(--text-brand);
    }
`;
document.head.appendChild(toastStyles);

// ========== ФОРМАТИРОВАНИЕ ==========
window.formatNumber = function(num) {
    if (!num) return '0';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
    if (num >= 1_000) return (num / 1_000).toFixed(1) + 'k';
    return num.toString();
};

window.formatRelativeDate = function(dateString) {
    if (!dateString) return 'неизвестно';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 7) return `${diffDays} ${['день', 'дня', 'дней'][getWordIndex(diffDays)]} назад`;
    if (diffDays < 30) return `${Math.floor(diffDays/7)} ${['неделю', 'недели', 'недель'][getWordIndex(Math.floor(diffDays/7))]} назад`;
    if (diffDays < 365) return `${Math.floor(diffDays/30)} ${['месяц', 'месяца', 'месяцев'][getWordIndex(Math.floor(diffDays/30))]} назад`;
    return `${Math.floor(diffDays/365)} ${['год', 'года', 'лет'][getWordIndex(Math.floor(diffDays/365))]} назад`;
};

function getWordIndex(n) { 
    return (n%10==1 && n%100!=11) ? 0 : (n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20)) ? 1 : 2; 
}

window.escapeHtml = function(unsafe) {
    if (!unsafe) return '';
    return String(unsafe).replace(/[&<>"]/g, function(m) {
        if (m === '&') return '&amp;'; 
        if (m === '<') return '&lt;'; 
        if (m === '>') return '&gt;'; 
        if (m === '"') return '&quot;';
        return m;
    });
};

// ========== ПЕРЕВОД ==========
window.translateText = async function(text) {
    if (!text || text.length < 20) return text;
    if (window.cachedTranslations.has(text)) return window.cachedTranslations.get(text);
    try {
        const response = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&q=' + encodeURIComponent(text));
        const data = await response.json();
        const translated = data[0][0][0];
        window.cachedTranslations.set(text, translated);
        return translated;
    } catch (error) {
        return text;
    }
};

// ========== СОХРАНЕННЫЕ ПРОЕКТЫ ==========
window.loadSavedProjects = async function() {
    if (!window.currentUser) return;
    try {
        const savedRef = db.collection('saved').doc(window.currentUser.uid);
        const doc = await savedRef.get();
        if (doc.exists) {
            window.savedProjects = new Set(doc.data().projects || []);
        }
    } catch (error) {
        console.error('Ошибка загрузки сохраненных:', error);
    }
};

window.saveProject = async function(projectId, projectData) {
    if (!window.currentUser) {
        window.showToast('Войдите, чтобы сохранять проекты', 'error');
        return false;
    }
    
    try {
        const savedRef = db.collection('saved').doc(window.currentUser.uid);
        window.savedProjects.add(projectId);
        
        const projectsData = await getProjectsData();
        projectsData[projectId] = projectData;
        
        await savedRef.set({
            projects: Array.from(window.savedProjects),
            projectsData: projectsData
        }, { merge: true });
        
        window.showToast('Проект сохранен!', 'success');
        return true;
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        window.showToast('Ошибка при сохранении', 'error');
        window.savedProjects.delete(projectId);
        return false;
    }
};

window.unsaveProject = async function(projectId) {
    if (!window.currentUser) return false;
    
    try {
        const savedRef = db.collection('saved').doc(window.currentUser.uid);
        window.savedProjects.delete(projectId);
        
        await savedRef.set({
            projects: Array.from(window.savedProjects)
        }, { merge: true });
        
        window.showToast('Проект удален из сохраненных', 'info');
        return true;
    } catch (error) {
        console.error('Ошибка удаления:', error);
        window.showToast('Ошибка при удалении', 'error');
        window.savedProjects.add(projectId);
        return false;
    }
};

window.isSaved = function(projectId) {
    return window.savedProjects.has(projectId);
};

async function getProjectsData() {
    const savedRef = db.collection('saved').doc(window.currentUser.uid);
    const doc = await savedRef.get();
    return doc.exists ? doc.data().projectsData || {} : {};
}

// ========== БОКОВАЯ ПАНЕЛЬ ==========
window.loadSidebar = function() {
    const sidebarHtml = `
        <div class="sidebar-logo" onclick="window.location.href='/minecraft/'">Deynik <span>Minecraft</span></div>
        
        <div class="sidebar-category">
            <div class="sidebar-category-title">Главное</div>
            <div class="sidebar-menu">
                <button class="sidebar-item" onclick="window.location.href='/minecraft/'">
                    <svg viewBox="0 0 24 24"><path d="M3 10.5L12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 19.5v-9z"/><path d="M9 21v-6h6v6"/></svg>
                    Рекомендации
                </button>
                <button class="sidebar-item" onclick="window.location.href='/minecraft/search.html'">
                    <svg viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    Поиск
                </button>
                <button class="sidebar-item" id="savedBtnSidebar">
                    <svg viewBox="0 0 24 24"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    Сохраненные
                </button>
                <button class="sidebar-item" id="messengerBtnSidebar">
                    <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                    Мессенджер
                </button>
            </div>
        </div>

        <div class="sidebar-category">
            <div class="sidebar-category-title">Контент</div>
            <div class="sidebar-menu">
                <button class="sidebar-item" onclick="window.location.href='/minecraft/mod.html'">
                    <svg viewBox="0 0 24 24"><path d="M20 7h-4.5L15 4H9L8.5 7H4v2h16V7z"/><rect x="4" y="9" width="16" height="10" rx="1"/><circle cx="8" cy="13" r="1"/><circle cx="16" cy="13" r="1"/></svg>
                    Моды
                </button>
                <button class="sidebar-item" onclick="window.location.href='/minecraft/shader.html'">
                    <svg viewBox="0 0 24 24"><path d="M12 3v1M5 8h1M18 8h1M8 21h8M12 8v8"/><circle cx="12" cy="15" r="3"/><path d="M8 11L5 8M16 11l3-3"/></svg>
                    Шейдеры
                </button>
                <button class="sidebar-item" onclick="window.location.href='/minecraft/resourcepack.html'">
                    <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
                    Ресурспаки
                </button>
                <button class="sidebar-item" onclick="window.location.href='/minecraft/modpack.html'">
                    <svg viewBox="0 0 24 24"><path d="M4 4h16v2H4z"/><rect x="4" y="8" width="16" height="12" rx="1"/><path d="M10 12l2 2 4-4"/></svg>
                    Сборки
                </button>
                <button class="sidebar-item" onclick="window.location.href='/minecraft/plugin.html'">
                    <svg viewBox="0 0 24 24"><path d="M20 12v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4"/><rect x="4" y="4" width="16" height="8" rx="1"/><circle cx="12" cy="12" r="2"/></svg>
                    Плагины
                </button>
                <button class="sidebar-item" onclick="window.location.href='/minecraft/datapack.html'">
                    <svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><path d="M8 8h8v8H8z"/><path d="M12 12l2-2-2-2"/></svg>
                    Датапаки
                </button>
            </div>
        </div>

        <div class="user-section" id="userSection">
            <div id="userInfo" style="display: none;">
                <div class="user-info">
                    <div class="user-avatar" id="userAvatar"></div>
                    <div class="user-details">
                        <div class="user-name" id="userName"></div>
                        <div class="user-nick" id="userNick"></div>
                    </div>
                </div>
            </div>
            <button class="google-btn" id="googleSignInBtn">
                <svg viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Войти через Google
            </button>
        </div>
    `;
    
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) {
        sidebar.innerHTML = sidebarHtml;
        
        // Привязываем обработчики после вставки
        const savedBtn = document.getElementById('savedBtnSidebar');
        const messengerBtn = document.getElementById('messengerBtnSidebar');
        const googleSignInBtn = document.getElementById('googleSignInBtn');
        
        if (savedBtn) {
            savedBtn.addEventListener('click', () => {
                if (!window.currentUser) {
                    window.showToast('Войдите, чтобы увидеть сохраненные проекты', 'error');
                    return;
                }
                window.location.href = '/minecraft/saved.html';
            });
        }
        
        if (messengerBtn) {
            messengerBtn.addEventListener('click', () => {
                if (!window.currentUser) {
                    window.showToast('Войдите, чтобы использовать мессенджер', 'error');
                    return;
                }
                window.location.href = '/minecraft/messenger.html';
            });
        }
        
        if (googleSignInBtn) {
            googleSignInBtn.addEventListener('click', () => {
                const provider = new firebase.auth.GoogleAuthProvider();
                auth.signInWithPopup(provider);
            });
        }
    }
};

// ========== АУТЕНТИФИКАЦИЯ ==========
auth.onAuthStateChanged(async (user) => {
    if (user) {
        window.currentUser = user;
        const userInfo = document.getElementById('userInfo');
        const googleSignInBtn = document.getElementById('googleSignInBtn');
        const userName = document.getElementById('userName');
        const userNick = document.getElementById('userNick');
        const userAvatar = document.getElementById('userAvatar');
        
        if (userInfo) userInfo.style.display = 'block';
        if (googleSignInBtn) googleSignInBtn.style.display = 'none';
        if (userName) userName.textContent = user.displayName || 'Пользователь';
        if (userNick) userNick.textContent = `@${user.email.split('@')[0]}`;
        if (userAvatar) {
            userAvatar.textContent = (user.displayName || 'U')[0].toUpperCase();
        }
        
        await window.loadSavedProjects();
        
        // Запускаем проверку онлайн статуса
        setupOnlineStatus();
    } else {
        window.currentUser = null;
        const userInfo = document.getElementById('userInfo');
        const googleSignInBtn = document.getElementById('googleSignInBtn');
        if (userInfo) userInfo.style.display = 'none';
        if (googleSignInBtn) googleSignInBtn.style.display = 'flex';
        window.savedProjects.clear();
    }
});

// ========== ОНЛАЙН СТАТУС ==========
let heartbeatInterval = null;

function setupOnlineStatus() {
    if (!window.currentUser) return;
    
    const userRef = db.collection('onlineUsers').doc(window.currentUser.uid);
    
    const setOnline = () => {
        userRef.set({
            online: true,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp(),
            uid: window.currentUser.uid
        });
    };
    
    setOnline();
    
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(setOnline, 30000);
    
    window.addEventListener('beforeunload', () => {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        userRef.update({ 
            online: false,
            lastSeen: firebase.firestore.FieldValue.serverTimestamp() 
        });
    });
}

// ========== СКЕЛЕТОН ДЛЯ ЗАГРУЗКИ ==========
window.showSkeleton = function(container, count = 3) {
    let skeletonHtml = '';
    for (let i = 0; i < count; i++) {
        skeletonHtml += `
            <div class="skeleton-card">
                <div class="skeleton-header">
                    <div class="skeleton-icon"></div>
                    <div class="skeleton-info">
                        <div class="skeleton-title"></div>
                        <div class="skeleton-author"></div>
                    </div>
                </div>
                <div class="skeleton-media"></div>
                <div class="skeleton-body">
                    <div class="skeleton-text"></div>
                    <div class="skeleton-text short"></div>
                </div>
            </div>
        `;
    }
    
    const skeletonStyles = document.createElement('style');
    skeletonStyles.textContent = `
        .skeleton-card {
            background-color: var(--bg-raised);
            border-radius: 1rem;
            border: 1px solid var(--border-subtle);
            overflow: hidden;
            animation: pulse 1.5s ease-in-out infinite;
        }
        .skeleton-header {
            display: flex;
            gap: 0.75rem;
            padding: 0.75rem 1rem;
            border-bottom: 1px solid var(--border-subtle);
        }
        .skeleton-icon {
            width: 44px;
            height: 44px;
            border-radius: 50%;
            background-color: var(--bg-button);
        }
        .skeleton-info {
            flex: 1;
        }
        .skeleton-title {
            height: 18px;
            width: 70%;
            background-color: var(--bg-button);
            border-radius: 4px;
            margin-bottom: 8px;
        }
        .skeleton-author {
            height: 14px;
            width: 50%;
            background-color: var(--bg-button);
            border-radius: 4px;
        }
        .skeleton-media {
            height: 200px;
            background-color: var(--bg-button);
        }
        .skeleton-body {
            padding: 1rem;
        }
        .skeleton-text {
            height: 14px;
            background-color: var(--bg-button);
            border-radius: 4px;
            margin-bottom: 8px;
        }
        .skeleton-text.short {
            width: 60%;
        }
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
    `;
    document.head.appendChild(skeletonStyles);
    
    container.innerHTML = skeletonHtml;
};

window.hideSkeleton = function(container) {
    container.innerHTML = '';
};
