class AuthManager {
    constructor() {
        this.SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
        this.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhbmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
        this.supabase = null;
        this.init();
    }

    async init() {
        // Ждем загрузки Supabase
        if (typeof window.supabase === 'undefined') {
            console.error("Supabase не загружен!");
            return;
        }

        try {
            // Явно включаем detectSessionInUrl и persistSession
            this.supabase = window.supabase.createClient(
                this.SUPABASE_URL,
                this.SUPABASE_ANON_KEY,
                {
                    auth: {
                        detectSessionInUrl: true,
                        persistSession: true
                    }
                }
            );

            // Обработчик изменений статуса авторизации — вешаем раньше, чтобы отловить INITIAL_SESSION/SIGNED_IN
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('Auth state changed:', event, session);
                this.updateUI();
            });

            this.setupEventListeners();

            // Если в URL есть параметры OAuth (hash или query), попробуем извлечь сессию
            if (window.location.hash.includes('access_token') || window.location.hash.includes('refresh_token') || window.location.search.includes('code')) {
                try {
                    console.log('Похоже на OAuth-редирект — пытаемся получить сессию из URL...');
                    // supabase-js v2: парсит и сохраняет сессию
                    await this.supabase.auth.getSessionFromUrl({ storeSession: true }).catch(err => {
                        console.warn('getSessionFromUrl error (не критично):', err);
                    });
                    // Удалим параметры из URL (по желанию) чтобы избежать повторной обработки
                    try {
                        history.replaceState(null, '', window.location.pathname + window.location.search);
                    } catch (e) {}
                } catch (e) {
                    console.warn('Ошибка при обработке URL сессии:', e);
                }
            }

            await this.checkAuth();
        } catch (error) {
            console.error('Ошибка инициализации Supabase:', error);
        }
    }

    setupEventListeners() {
        // Discord login
        this.on('#discordSignIn', 'click', (e) => {
            e.preventDefault();
            this.signInWithDiscord();
        });

        // Новый обработчик только для кнопки входа
        this.on('#userSection', 'click', (e) => {
            if (e.target.closest('.login-btn')) {
                this.showModal('#authPage');
            }
        });

        // Close modals
        this.on('.close-auth', 'click', () => this.hideModal('#authPage'));
        this.on('.close-ip-modal', 'click', () => this.hideModal('#ipModal'));

        // Close modals by clicking outside
        this.on('#authPage', 'click', (e) => {
            if (e.target === e.currentTarget) this.hideModal('#authPage');
        });
        this.on('#ipModal', 'click', (e) => {
            if (e.target === e.currentTarget) this.hideModal('#ipModal');
        });

        // Server join buttons
        this.on('.server-join-btn', 'click', () => this.handleServerJoin());

        // IP copy buttons
        this.on('.ip-btn', 'click', (e) => this.copyIP(e.currentTarget));
    }

    // Вспомогательная функция для обработчиков событий
    on(selector, event, handler) {
        document.querySelectorAll(selector).forEach(element => {
            element.addEventListener(event, handler);
        });
    }

    showModal(selector) {
        const modal = document.querySelector(selector);
        if (modal) modal.style.display = 'flex';
    }

    hideModal(selector) {
        const modal = document.querySelector(selector);
        if (modal) modal.style.display = 'none';
    }

    async signInWithDiscord() {
        try {
            console.log('Начало авторизации через Discord...');
            
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: { 
                    // Лучше использовать точный redirect, который вы зарегистрировали в Supabase/Discord
                    redirectTo: window.location.origin + window.location.pathname,
                    scopes: 'identify email'
                }
            });

            if (error) {
                console.error('Ошибка OAuth:', error);
                alert('Ошибка при входе через Discord: ' + error.message);
                return;
            }

            console.log('OAuth данные:', data);

        } catch (error) {
            console.error('Ошибка авторизации:', error);
            alert('Произошла ошибка при авторизации');
        }
    }

    async signOut() {
        if (confirm('Выйти из аккаунта?')) {
            try {
                const { error } = await this.supabase.auth.signOut();
                if (error) throw error;
                this.updateUI();
                this.hideModal('#authPage');
                this.hideModal('#ipModal');
            } catch (error) {
                console.error('Ошибка выхода:', error);
                alert('Не удалось выйти из аккаунта');
            }
        }
    }

    async checkAuth() {
        try {
            const result = await this.supabase.auth.getSession();
            const session = result?.data?.session;
            const error = result?.error;
            
            if (error) {
                console.error('Ошибка проверки сессии:', error);
                return;
            }

            if (session) {
                console.log('Сессия найдена:', session.user);
                this.updateUI();
            } else {
                console.log('Активная сессия не найдена');
            }
        } catch (error) {
            console.error('Ошибка проверки авторизации:', error);
        }
    }

    async updateUI() {
        const userSection = document.getElementById('userSection');
        if (!userSection) return;

        try {
            const res = await this.supabase.auth.getUser().catch(err => {
                // Избегаем засорения консоли при ожидаемой ошибке AuthSessionMissingError
                if (err && err.message && err.message.includes('AuthSessionMissingError')) {
                    console.debug('Нет сессии (getUser):', err.message);
                    return { data: { user: null }, error: err };
                } else {
                    throw err;
                }
            });

            const { data: { user }, error } = res;

            if (error && !user) {
                console.error('Ошибка получения пользователя:', error);
                userSection.innerHTML = '<button class="login-btn">Войти</button>';
                return;
            }

            if (user) {
                console.log('Пользователь найден:', user);
                
                const name = user.user_metadata?.full_name || 
                            user.user_metadata?.global_name || 
                            user.email || 
                            'User';
                
                const avatarUrl = user.user_metadata?.avatar_url;
                
                userSection.innerHTML = `
                    <div class="user-dropdown">
                        <div class="user-info">
                            <div class="user-avatar" title="${name}">
                                ${avatarUrl ? 
                                    `<img src="${avatarUrl}" alt="${name}">` : 
                                    name[0].toUpperCase()
                                }
                            </div>
                            <span>${name}</span>
                        </div>
                        <div class="dropdown-menu">
                            <div class="dropdown-item" onclick="authManager.signOut()">
                                <svg viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
                                </svg>
                                Выйти
                            </div>
                        </div>
                    </div>
                `;
            } else {
                userSection.innerHTML = '<button class="login-btn">Войти</button>';
            }
        } catch (error) {
            console.error('Ошибка обновления UI:', error);
            userSection.innerHTML = '<button class="login-btn">Войти</button>';
        }
    }

    async handleServerJoin() {
        try {
            const res = await this.supabase.auth.getUser().catch(err => {
                if (err && err.message && err.message.includes('AuthSessionMissingError')) {
                    console.debug('Нет сессии при handleServerJoin');
                    return { data: { user: null }, error: err };
                } else {
                    throw err;
                }
            });
            
            const { data: { user }, error } = res;
            
            if (error) {
                console.error('Ошибка проверки пользователя:', error);
                this.showModal('#authPage');
                return;
            }

            if (user) {
                this.showModal('#ipModal');
            } else {
                this.showModal('#authPage');
            }
        } catch (error) {
            console.error('Ошибка обработки кнопки сервера:', error);
            this.showModal('#authPage');
        }
    }

    async copyIP(button) {
        const ip = button.getAttribute('data-ip');
        
        try {
            await navigator.clipboard.writeText(ip);
            
            button.classList.add('copied');
            
            setTimeout(() => {
                button.classList.remove('copied');
            }, 1200);
            
        } catch (error) {
            console.error('Ошибка копирования:', error);
            
            try {
                const textArea = document.createElement('textarea');
                textArea.value = ip;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                
                button.classList.add('copied');
                setTimeout(() => button.classList.remove('copied'), 1200);
                
            } catch (fallbackError) {
                alert('Не удалось скопировать IP. Скопируйте вручную: ' + ip);
            }
        }
    }
}

// Глобальная переменная для доступа к менеджера авторизации
let authManager;

document.addEventListener('DOMContentLoaded', function() {
    if (typeof window.supabase !== 'undefined') {
        authManager = new AuthManager();
        window.authManager = authManager;
    } else {
        const checkSupabase = setInterval(() => {
            if (typeof window.supabase !== 'undefined') {
                clearInterval(checkSupabase);
                authManager = new AuthManager();
                window.authManager = authManager;
            }
        }, 100);
    }
});

// Глобальные функции для кнопок
window.scrollToServers = function() {
    const el = document.getElementById('servers-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
