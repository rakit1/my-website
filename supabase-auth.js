// supabase-auth.js
class AuthManager {
    constructor() {
        // Защита от множественной инициализации
        if (window.authManagerInstance) {
            return window.authManagerInstance;
        }
        window.authManagerInstance = this;
        
        this.SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
        this.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
        this.supabase = null;
        this.isInitialized = false;
        this.eventListeners = [];
        
        this.init();
    }

    async init() {
        try {
            // Ждем полной загрузки Supabase
            await this.waitForSupabase();
            
            if (typeof window.supabase === 'undefined') {
                throw new Error("Supabase не загружен!");
            }

            // Создаем клиент только один раз
            if (!window.supabaseClient) {
                window.supabaseClient = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
            }
            this.supabase = window.supabaseClient;
            
            this.setupEventListeners();
            
            // Слушаем изменения статуса авторизации
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('Статус авторизации изменился:', event);
                this.updateUI();
            });
            
            // Проверяем авторизацию
            await this.checkAuth();
            
            this.isInitialized = true;
            console.log('AuthManager инициализирован');
        } catch (error) {
            console.error('Ошибка инициализации Supabase:', error);
        }
    }

    async waitForSupabase() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50;
            
            const check = () => {
                attempts++;
                if (typeof window.supabase !== 'undefined') {
                    resolve();
                } else if (attempts >= maxAttempts) {
                    reject(new Error('Timeout waiting for Supabase'));
                } else {
                    setTimeout(check, 100);
                }
            };
            
            check();
        });
    }

    setupEventListeners() {
        // Очищаем старые обработчики
        this.removeEventListeners();
        
        // Делегирование событий для всего документа
        const handleClick = (e) => {
            // Кнопка Discord в модалке
            if (e.target.closest('#discordSignIn')) {
                e.preventDefault();
                this.signInWithDiscord();
                return;
            }
            
            // Кнопка входа в хедере
            if (e.target.closest('.login-btn')) {
                this.showModal('#authPage');
                return;
            }
            
            // Закрытие модалок
            if (e.target.closest('.close-auth')) {
                this.hideModal('#authPage');
                return;
            }
            
            if (e.target.closest('.close-ip-modal')) {
                this.hideModal('#ipModal');
                return;
            }
            
            // Server join buttons
            if (e.target.closest('.server-join-btn')) {
                this.handleServerJoin();
                return;
            }
            
            // IP copy buttons
            const ipBtn = e.target.closest('.ip-btn');
            if (ipBtn) {
                this.copyIP(ipBtn);
                return;
            }
            
            // Закрытие модалок по клику вне контента
            if (e.target.id === 'authPage' || e.target.id === 'ipModal') {
                this.hideModal('#' + e.target.id);
                return;
            }
            
            // Выпадающее меню пользователя
            if (e.target.closest('.user-name')) {
                const dropdown = e.target.closest('.user-dropdown');
                if (dropdown) {
                    dropdown.classList.toggle('active');
                    e.stopPropagation();
                }
                return;
            }
            
            // Кнопка выхода
            if (e.target.closest('.logout-btn')) {
                this.signOut();
                return;
            }
            
            // Закрытие всех выпадающих меню при клике вне их
            const dropdowns = document.querySelectorAll('.user-dropdown');
            dropdowns.forEach(dropdown => {
                if (!dropdown.contains(e.target)) {
                    dropdown.classList.remove('active');
                }
            });
        };

        document.addEventListener('click', handleClick);
        this.eventListeners.push({ type: 'click', handler: handleClick });
        
        // Закрытие модалок по ESC
        const handleKeydown = (e) => {
            if (e.key === 'Escape') {
                this.hideModal('#authPage');
                this.hideModal('#ipModal');
            }
        };
        
        document.addEventListener('keydown', handleKeydown);
        this.eventListeners.push({ type: 'keydown', handler: handleKeydown });
    }

    removeEventListeners() {
        this.eventListeners.forEach(({ type, handler }) => {
            document.removeEventListener(type, handler);
        });
        this.eventListeners = [];
    }

    showModal(selector) {
        const modal = document.querySelector(selector);
        if (modal) {
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            
            // Фокусируемся на первом интерактивном элементе
            const focusElement = modal.querySelector('button, [tabindex]');
            if (focusElement) focusElement.focus();
        }
    }

    hideModal(selector) {
        const modal = document.querySelector(selector);
        if (modal) {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }
    }

    async signInWithDiscord() {
        try {
            console.log('Начало авторизации через Discord...');
            
            const redirectUrl = window.location.origin + window.location.pathname;
            
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: { 
                    redirectTo: redirectUrl,
                    scopes: 'identify email'
                }
            });

            if (error) {
                throw new Error('OAuth ошибка: ' + error.message);
            }

            console.log('OAuth запущен:', data);

        } catch (error) {
            console.error('Ошибка авторизации:', error);
            this.showError('Ошибка при входе через Discord: ' + error.message);
        }
    }

    async signOut() {
        try {
            console.log('Выполняется выход...');
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            
            console.log('Выход выполнен успешно');
            this.updateUI();
            this.hideModal('#authPage');
            this.hideModal('#ipModal');
        } catch (error) {
            console.error('Ошибка выхода:', error);
            this.showError('Не удалось выйти из аккаунта');
        }
    }

    async checkAuth() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                console.warn('Ошибка проверки сессии:', error.message);
            }

            this.updateUI();
        } catch (error) {
            console.warn('Ошибка проверки авторизации:', error.message);
            this.updateUI();
        }
    }

    async updateUI() {
        const userSection = document.getElementById('userSection');
        if (!userSection) {
            console.warn('userSection не найден');
            return;
        }

        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                console.warn('Ошибка получения пользователя:', error.message);
                this.renderLoginButton(userSection);
                return;
            }

            if (user) {
                this.renderUserInfo(userSection, user);
            } else {
                this.renderLoginButton(userSection);
            }
        } catch (error) {
            console.warn('Ошибка обновления UI:', error.message);
            this.renderLoginButton(userSection);
        }
    }

    renderLoginButton(container) {
        container.innerHTML = '<button class="login-btn">Войти</button>';
    }

    renderUserInfo(container, user) {
        const name = this.escapeHtml(
            user.user_metadata?.full_name || 
            user.user_metadata?.global_name || 
            user.email || 
            'Пользователь'
        );
        
        const avatarUrl = user.user_metadata?.avatar_url;
        
        container.innerHTML = `
            <div class="user-info">
                <div class="user-avatar" title="${name}">
                    ${avatarUrl ? 
                        `<img src="${this.escapeHtml(avatarUrl)}" alt="${name}" style="width:100%;height:100%;border-radius:50%;" loading="lazy">` : 
                        this.escapeHtml(name[0])
                    }
                </div>
                <div class="user-dropdown">
                    <span class="user-name">${name}</span>
                    <div class="dropdown-menu">
                        <button class="logout-btn">Выйти</button>
                    </div>
                </div>
            </div>
        `;
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    async handleServerJoin() {
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                console.warn('Ошибка проверки пользователя:', error.message);
                this.showModal('#authPage');
                return;
            }

            if (user) {
                this.showModal('#ipModal');
            } else {
                this.showModal('#authPage');
            }
        } catch (error) {
            console.warn('Ошибка обработки кнопки сервера:', error.message);
            this.showModal('#authPage');
        }
    }

    async copyIP(button) {
        const ip = button.getAttribute('data-ip');
        
        if (!ip) {
            this.showError('IP адрес не найден');
            return;
        }
        
        try {
            await navigator.clipboard.writeText(ip);
            button.classList.add('copied');
            setTimeout(() => button.classList.remove('copied'), 1200);
        } catch (error) {
            console.error('Ошибка копирования:', error);
            try {
                const textArea = document.createElement('textarea');
                textArea.value = ip;
                textArea.style.position = 'fixed';
                textArea.style.opacity = '0';
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                button.classList.add('copied');
                setTimeout(() => button.classList.remove('copied'), 1200);
            } catch (fallbackError) {
                this.showError('Не удалось скопировать IP. Скопируйте вручную: ' + ip);
            }
        }
    }

    showError(message) {
        // Временное решение - можно заменить на красивый toast
        const existingError = document.querySelector('.error-toast');
        if (existingError) existingError.remove();
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-toast';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff4444;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            z-index: 10000;
            max-width: 300px;
        `;
        document.body.appendChild(errorDiv);
        
        setTimeout(() => errorDiv.remove(), 5000);
    }
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    // Ждем загрузки Supabase
    const checkSupabase = setInterval(() => {
        if (typeof window.supabase !== 'undefined') {
            clearInterval(checkSupabase);
            window.authManager = new AuthManager();
        }
    }, 100);
    
    // Таймаут на случай если Supabase не загрузится
    setTimeout(() => {
        if (typeof window.supabase === 'undefined') {
            console.error('Supabase не загрузился вовремя');
        }
    }, 5000);
});

// Глобальная функция для кнопок
window.scrollToServers = function() {
    const el = document.getElementById('servers-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
