// supabase-auth.js
class AuthManager {
    constructor() {
        this.SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
        this.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
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
            this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
            this.setupEventListeners();
            await this.checkAuth();
            
            // Слушаем изменения статуса авторизации
            this.supabase.auth.onAuthStateChange((event, session) => {
                console.log('Статус авторизации изменился:', event);
                this.updateUI();
            });
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

        // Кнопка входа
        this.on('.login-btn', 'click', () => {
            this.showModal('#authPage');
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
            
            // Используем фиксированный URL для редиректа
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: { 
                    redirectTo: 'https://rakit1.github.io/my-website/',
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
            alert('Не удалось выйти из аккаунта');
        }
    }

    async checkAuth() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            
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
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                console.error('Ошибка получения пользователя:', error);
                userSection.innerHTML = '<button class="login-btn">Войти</button>';
                return;
            }

            if (user) {
                console.log('Пользователь найден:', user);
                
                const name = user.user_metadata?.full_name || 
                            user.user_metadata?.global_name || 
                            user.email || 
                            'Пользователь';
                
                const avatarUrl = user.user_metadata?.avatar_url;
                
                // Обновляем HTML с новым выпадающим меню
                userSection.innerHTML = `
                    <div class="user-info">
                        <div class="user-avatar" title="${name}">
                            ${avatarUrl ? 
                                `<img src="${avatarUrl}" alt="${name}" style="width:100%;height:100%;border-radius:50%;">` : 
                                name[0]
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
                
                // Добавляем обработчики для нового меню
                this.setupUserDropdownHandlers();
                
            } else {
                userSection.innerHTML = '<button class="login-btn">Войти</button>';
            }
        } catch (error) {
            console.error('Ошибка обновления UI:', error);
            userSection.innerHTML = '<button class="login-btn">Войти</button>';
        }
    }

    setupUserDropdownHandlers() {
        // Клик по имени пользователя для открытия/закрытия меню
        const userName = document.querySelector('.user-name');
        if (userName) {
            userName.addEventListener('click', (e) => {
                const dropdown = e.target.closest('.user-dropdown');
                if (dropdown) {
                    dropdown.classList.toggle('active');
                    e.stopPropagation();
                }
            });
        }

        // Кнопка выхода
        const logoutBtn = document.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                console.log('Кнопка выхода нажата');
                this.signOut();
            });
        }

        // Закрытие меню при клике вне его
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-dropdown')) {
                const dropdowns = document.querySelectorAll('.user-dropdown');
                dropdowns.forEach(dropdown => dropdown.classList.remove('active'));
            }
        });
    }

    async handleServerJoin() {
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
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

// Инициализация при загрузке DOM
document.addEventListener('DOMContentLoaded', function() {
    // Проверяем, загружен ли Supabase
    if (typeof window.supabase !== 'undefined') {
        new AuthManager();
    } else {
        // Если Supabase еще не загружен, ждем его
        const checkSupabase = setInterval(() => {
            if (typeof window.supabase !== 'undefined') {
                clearInterval(checkSupabase);
                new AuthManager();
            }
        }, 100);
    }
});

// Глобальные функции для кнопок
window.scrollToServers = function() {
    const el = document.getElementById('servers-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
