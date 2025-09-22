// Новый и единственный script.js

class App {
    constructor() {
        // Ключи Supabase (в реальном проекте их лучше хранить в переменных окружения)
        this.SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
        this.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
        this.supabase = null;
        
        // Ждем загрузки DOM и Supabase, а затем инициализируем приложение
        this.waitForDependencies().then(() => this.init());
    }

    // Метод для ожидания загрузки всех зависимостей
    async waitForDependencies() {
        return new Promise((resolve) => {
            const check = () => {
                // Проверяем, загрузилась ли библиотека Supabase и готов ли DOM
                if (typeof window.supabase !== 'undefined' && document.readyState !== 'loading') {
                    resolve();
                } else {
                    setTimeout(check, 100); // Проверяем снова через 100 мс
                }
            };
            
            if (document.readyState === 'complete') {
                check();
            } else {
                // Если DOM еще не готов, ждем события DOMContentLoaded
                document.addEventListener('DOMContentLoaded', check);
            }
        });
    }

    // Основная функция инициализации приложения
    init() {
        console.log('Приложение инициализировано');
        // Создаем клиент Supabase
        this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);

        // Устанавливаем все обработчики событий
        this.setupEventListeners();

        // Проверяем статус аутентификации при загрузке страницы
        this.checkAuth();
        
        // Добавляем слушатель для отслеживания изменений статуса аутентификации (вход/выход)
        this.supabase.auth.onAuthStateChange((event, session) => {
            console.log('Статус аутентификации изменился:', event);
            this.updateUserUI();
        });
    }

    // Централизованная настройка всех обработчиков событий на странице
    setupEventListeners() {
        // Используем делегирование событий для эффективности
        document.body.addEventListener('click', (e) => {
            // Клик по кнопке мобильного меню
            if (e.target.closest('.mobile-menu-btn')) this.toggleMobileMenu();

            // Клик по кнопке "Войти"
            if (e.target.closest('.login-btn')) this.showModal('#authPage');

            // Клик по кнопке входа через Discord в модальном окне
            if (e.target.closest('#discordSignIn')) this.signInWithDiscord();

            // Клик по кнопке "Присоединиться" на карточке сервера
            if (e.target.closest('.server-join-btn')) this.handleServerJoin();

            // Клик по кнопкам копирования IP
            if (e.target.closest('.ip-btn')) this.copyIP(e.target.closest('.ip-btn'));
            
            // Клик по кнопке "Выйти" в выпадающем меню
            if (e.target.closest('.logout-btn')) this.signOut();

            // Закрытие модальных окон (по крестику или по клику на фон)
            const modal = e.target.closest('.auth-container, .ip-modal');
            if (e.target.closest('.close-auth, .close-ip-modal') || e.target === modal) {
                this.hideModal(modal);
            }
            
            // Открытие/закрытие выпадающего меню пользователя
            const userDropdownToggle = e.target.closest('.user-name');
            if (userDropdownToggle) {
                userDropdownToggle.parentElement.classList.toggle('active');
            } else if (!e.target.closest('.user-dropdown')) {
                // Закрываем все выпадающие меню, если клик был вне их области
                document.querySelectorAll('.user-dropdown.active').forEach(d => d.classList.remove('active'));
            }
        });

        // Закрытие модальных окон по нажатию клавиши ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.auth-container, .ip-modal').forEach(modal => this.hideModal(modal));
            }
        });
    }

    // --- Логика Мобильного Меню ---
    toggleMobileMenu() {
        const nav = document.querySelector('nav');
        nav.classList.toggle('active');
        this.toggleOverlay(nav.classList.contains('active'));
    }

    toggleOverlay(show) {
        let overlay = document.querySelector('.nav-overlay');
        if (show && !overlay) {
            overlay = document.createElement('div');
            overlay.className = 'nav-overlay';
            overlay.style.cssText = `position: fixed; top: 70px; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 98;`;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', () => this.toggleMobileMenu());
        } else if (!show && overlay) {
            overlay.remove();
        }
    }
    
    // --- Логика Модальных Окон ---
    showModal(selector) {
        const modal = document.querySelector(selector);
        if (modal) {
            modal.style.display = 'flex';
            modal.setAttribute('aria-hidden', 'false');
        }
    }

    hideModal(modal) {
        if (typeof modal === 'string') modal = document.querySelector(modal);
        if (modal && modal.style.display !== 'none') {
            modal.style.display = 'none';
            modal.setAttribute('aria-hidden', 'true');
        }
    }
    
    // --- Логика Аутентификации ---
    async checkAuth() {
        await this.updateUserUI();
    }
    
    async signInWithDiscord() {
        const { error } = await this.supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: { 
                redirectTo: window.location.href,
                scopes: 'identify' // ИЗМЕНЕНИЕ: Мы просим у Discord разрешение на просмотр имени
            }
        });
        if (error) console.error('Ошибка входа через Discord:', error);
    }

    async signOut() {
        const { error } = await this.supabase.auth.signOut();
        if (error) console.error('Ошибка выхода:', error);
    }

    async handleServerJoin() {
        const { data: { user } } = await this.supabase.auth.getUser();
        if (user) {
            this.showModal('#ipModal');
        } else {
            this.showModal('#authPage');
        }
    }

    // --- Обновление Интерфейса Пользователя ---
    async updateUserUI() {
        const userSection = document.getElementById('userSection');
        if (!userSection) return;

        const { data: { user } } = await this.supabase.auth.getUser();

        if (user) {
            const name = this.escapeHtml(user.user_metadata?.full_name || user.email || 'Пользователь');
            const avatarUrl = this.escapeHtml(user.user_metadata?.avatar_url);
            userSection.innerHTML = `
                <div class="user-info">
                    <div class="user-avatar" title="${name}">
                        ${avatarUrl ? `<img src="${avatarUrl}" alt="Аватар" style="width:100%;height:100%;border-radius:50%;">` : name.charAt(0).toUpperCase()}
                    </div>
                    <div class="user-dropdown">
                        <span class="user-name">${name}</span>
                        <div class="dropdown-menu">
                            <button class="logout-btn">Выйти</button>
                        </div>
                    </div>
                </div>`;
        } else {
            userSection.innerHTML = '<button class="login-btn">Войти</button>';
        }
    }
    
    // --- Вспомогательные Функции ---
    async copyIP(button) {
        const ip = button.dataset.ip;
        if (!ip) return;

        try {
            await navigator.clipboard.writeText(ip);
            button.classList.add('copied');
            setTimeout(() => button.classList.remove('copied'), 1500);
        } catch (err) {
            console.error('Не удалось скопировать IP: ', err);
            alert('Не удалось скопировать IP. Скопируйте вручную: ' + ip);
        }
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
}

// Запускаем наше приложение
const app = new App();

// Глобальная функция для скролла, чтобы ее можно было вызывать из HTML (onclick)
window.scrollToServers = function() {
    document.getElementById('servers-section')?.scrollIntoView({ behavior: 'smooth' });
};
