// supabase-auth.js
class AuthManager {
    constructor() {
        this.SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
        this.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
        this.supabase = null;
        this.isInitialized = false;
        this.init();
    }

    async init() {
        try {
            // Ждем полной загрузки Supabase
            await this.waitForSupabase();
            
            if (typeof window.supabase === 'undefined') {
                throw new Error("Supabase не загружен!");
            }

            this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
            this.setupGlobalEventListeners();
            await this.checkAuth();
            
            // Слушаем изменения статуса авторизации
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('Статус авторизации изменился:', event);
                this.updateUI();
            });
            
            this.isInitialized = true;
        } catch (error) {
            console.error('Ошибка инициализации Supabase:', error);
            this.showError('Ошибка загрузки системы авторизации');
        }
    }

    async waitForSupabase() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 секунд максимум
            
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
        // Глобальные обработчики которые не зависят от динамического контента
        this.delegateEvent('click', '.close-auth', () => this.hideModal('#authPage'));
        this.delegateEvent('click', '.close-ip-modal', () => this.hideModal('#ipModal'));
        
        // Закрытие модалок по клику вне контента
        this.delegateEvent('click', '#authPage', (e) => {
            if (e.target === e.currentTarget) this.hideModal('#authPage');
        });
        this.delegateEvent('click', '#ipModal', (e) => {
            if (e.target === e.currentTarget) this.hideModal('#ipModal');
        });

        // Server join buttons
        this.delegateEvent('click', '.server-join-btn', () => this.handleServerJoin());

        // IP copy buttons
        this.delegateEvent('click', '.ip-btn', (e) => this.copyIP(e.target.closest('.ip-btn')));
    }

    // Делегирование событий для динамического контента
    delegateEvent(event, selector, handler) {
        document.addEventListener(event, (e) => {
            if (e.target.matches(selector) || e.target.closest(selector)) {
                handler(e);
            }
        });
    }

    showModal(selector) {
        const modal = document.querySelector(selector);
        if (modal) {
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden'; // Блокируем скролл
            
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
            document.body.style.overflow = ''; // Разблокируем скролл
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

            console.log('OAuth данные:', data);

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
                throw new Error('Ошибка проверки сессии: ' + error.message);
            }

            if (session) {
                console.log('Сессия найдена:', session.user);
            }
            
            this.updateUI();
        } catch (error) {
            console.error('Ошибка проверки авторизации:', error);
        }
    }

    async updateUI() {
        const userSection = document.getElementById('userSection');
        if (!userSection) return;

        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                throw new Error('Ошибка получения пользователя: ' + error.message);
            }

            if (user) {
                this.renderUserInfo(userSection, user);
            } else {
                this.renderLoginButton(userSection);
            }
        } catch (error) {
            console.error('Ошибка обновления UI:', error);
            this.renderLoginButton(userSection);
        }
    }

    renderLoginButton(container) {
        // Безопасное создание кнопки через textContent
        container.innerHTML = '<button class="login-btn">Войти</button>';
        
        // Обработчик вешается через делегирование, поэтому не нужно перевешивать
    }

    renderUserInfo(container, user) {
        // Безопасное экранирование данных пользователя
        const name = this.escapeHtml(
            user.user_metadata?.full_name || 
            user.user_metadata?.global_name || 
            user.email || 
            'Пользователь'
        );
        
        const avatarUrl = user.user_metadata?.avatar_url;
        
        // Безопасное создание HTML
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

    // Экранирование HTML для защиты от XSS
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    setupUserDropdownHandlers() {
        // Обработчики теперь через делегирование, не требуют перевешивания
    }

    async handleServerJoin() {
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                throw new Error('Ошибка проверки пользователя: ' + error.message);
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
        
        if (!ip) {
            this.showError('IP адрес не найден');
            return;
        }
        
        try {
            await navigator.clipboard.writeText(ip);
            
            // Визуальная обратная связь
            button.classList.add('copied');
            
            // Восстанавливаем через 1.2 секунды
            setTimeout(() => {
                button.classList.remove('copied');
            }, 1200);
            
        } catch (error) {
            console.error('Ошибка копирования:', error);
            
            // Запасной вариант для старых браузеров
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
        // Можно добавить красивый индикатор загрузки
        console.log('Loading:', message);
    }

    hideLoading() {
        // Скрыть индикатор загрузки
    }

    showError(message) {
        // Показать красивое уведомление об ошибке
        alert(message); // Временное решение
    }
}

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    new AuthManager();
});

// Глобальная функция для кнопок
window.scrollToServers = function() {
    const el = document.getElementById('servers-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// ОБЩИЙ обработчик для закрытия выпадающих меню при клике вне их
document.addEventListener('click', function(e) {
    // Закрываем все выпадающие меню пользователя
    const dropdowns = document.querySelectorAll('.user-dropdown');
    dropdowns.forEach(dropdown => {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('active');
        }
    });
    
    // Открываем/закрываем выпадающее меню по клику на имя пользователя
    if (e.target.classList.contains('user-name')) {
        const dropdown = e.target.closest('.user-dropdown');
        if (dropdown) {
            dropdown.classList.toggle('active');
            e.stopPropagation();
        }
    }
    
    // Обработчик выхода
    if (e.target.classList.contains('logout-btn')) {
        const authManager = document.authManager;
        if (authManager) {
            authManager.signOut();
        }
    }
    
    // Обработчик кнопки входа (делегирование)
    if (e.target.classList.contains('login-btn')) {
        const authManager = document.authManager;
        if (authManager) {
            authManager.showModal('#authPage');
        }
    }
});

// Сохраняем экземпляр для глобального доступа
document.addEventListener('DOMContentLoaded', function() {
    document.authManager = new AuthManager();
});
