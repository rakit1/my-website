// supabase-auth.js
class AuthManager {
    constructor() {
        this.SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
        this.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
        this.supabase = null;
        this.isInitialized = false;
        
        // Защита от множественной инициализации
        if (window.authManagerInstance) {
            return window.authManagerInstance;
        }
        window.authManagerInstance = this;
        
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
            
            this.setupGlobalEventListeners();
            
            // Слушаем изменения статуса авторизации
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('Статус авторизации изменился:', event);
                this.updateUI();
            });
            
            // Проверяем авторизацию после настройки listeners
            await this.checkAuth();
            
            this.isInitialized = true;
        } catch (error) {
            console.error('Ошибка инициализации Supabase:', error);
            this.showError('Ошибка загрузки системы авторизации');
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

    setupGlobalEventListeners() {
        // Удаляем старые обработчики перед добавлением новых
        this.removeAllEventListeners();
        
        // Делегирование событий для динамического контента
        document.addEventListener('click', (e) => {
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
            if (e.target.id === 'authPage') {
                this.hideModal('#authPage');
                return;
            }
            
            if (e.target.id === 'ipModal') {
                this.hideModal('#ipModal');
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
        });
    }

    removeAllEventListeners() {
        // Клонируем и заменяем body чтобы удалить все обработчики
        const newBody = document.body.cloneNode(true);
        document.body.parentNode.replaceChild(newBody, document.body);
    }

    showModal(selector) {
        const modal = document.querySelector(selector);
        if (modal) {
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
            
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
            this.showLoading('Авторизация через Discord...');
            
            // Динамический URL редиректа
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
        } finally {
            this.hideLoading();
        }
    }

    async signOut() {
        try {
            this.showLoading('Выход из аккаунта...');
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            
            this.updateUI();
            this.hideModal('#authPage');
            this.hideModal('#ipModal');
        } catch (error) {
            console.error('Ошибка выхода:', error);
            this.showError('Не удалось выйти из аккаунта');
        } finally {
            this.hideLoading();
        }
    }

    async checkAuth() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
            if (error) {
                console.warn('Ошибка проверки сессии:', error.message);
                // Не бросаем ошибку, продолжаем с null сессией
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
                // Показываем кнопку входа при ошибке
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
        container.innerHTML = '<button class="login-btn" style="cursor: pointer;">Войти</button>';
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
                    <span class="user-name" style="cursor: pointer;">${name}</span>
                    <div class="dropdown-menu">
                        <button class="logout-btn" style="cursor: pointer;">Выйти</button>
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

    showLoading(message = 'Загрузка...') {
        // Можно добавить индикатор
        console.log('Loading:', message);
    }

    hideLoading() {
        // Скрыть индикатор
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

// Защита ключей - обфускация (базовая)
const protectedConfig = (function() {
    const base64Url = "aHR0cHM6Ly9lZ3NreHl4Z3pkaWRmYnhoamF1ZC5zdXBhYmFzZS5j";
    const base64Key = "ZXlKaGJHY2lPaUpJVXpJMU5pSXNJblI1Y0NJNklrcFhWQ0o5LmV5SnBjM01pT2lKemRYQnlaV1JwYm1jdGNuVnpkSE1pTENKcFlYUWlPakUyTnpnM09UY3pOek45Llg2MGdrZjhoajBZRUt6TGRDRk9PWFRBbGZESjJBb0lOb0pIWThwUGVERnc";
    
    return {
        url: atob(base64Url + 'o'),
        key: atob(base64Key)
    };
})();

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    // Задержка для гарантии загрузки Supabase
    setTimeout(() => {
        if (!window.authManager) {
            window.authManager = new AuthManager();
        }
    }, 100);
});

// Глобальная функция для кнопок
window.scrollToServers = function() {
    const el = document.getElementById('servers-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
