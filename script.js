class MainPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateOnlineCount(); // Запускаем обновление онлайна при загрузке
        setInterval(() => this.updateOnlineCount(), 60000); // Обновляем каждую минуту
    }

    async updateOnlineCount() {
        const serverIp = "cbworlds.aboba.host"; // Твой IP
        const heroOnlineElement = document.getElementById('online-count');
        const cardOnlineElement = document.getElementById('server-card-online');
        const onlineDotElement = document.querySelector('.online-dot');

        try {
            const response = await fetch(`https://api.mcsrvstat.us/2/${serverIp}`);
            const data = await response.json();

            // УЛУЧШЕННАЯ ПРОВЕРКА: убеждаемся, что получили корректные данные
            if (data.online && data.players && data.players.online !== undefined) {
                const onlineText = data.players.online;
                if (heroOnlineElement) heroOnlineElement.textContent = onlineText;
                if (cardOnlineElement) cardOnlineElement.textContent = `${onlineText} онлайн`;
                if (onlineDotElement) onlineDotElement.style.background = 'var(--primary)';
            } else {
                if (heroOnlineElement) heroOnlineElement.textContent = 'Оффлайн';
                if (cardOnlineElement) cardOnlineElement.textContent = `Оффлайн`;
                if (onlineDotElement) onlineDotElement.style.background = '#eb445a';
            }
        } catch (error) {
            console.error("Ошибка при получении онлайна:", error);
            if (heroOnlineElement) heroOnlineElement.textContent = 'Ошибка';
            if (cardOnlineElement) cardOnlineElement.textContent = 'Ошибка';
            if (onlineDotElement) onlineDotElement.style.background = '#eb445a';
        }
    }

    setupEventListeners() {
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.mobile-menu-btn')) this.toggleMobileMenu();
            if (e.target.closest('.login-btn')) this.showModal('#authPage');
            if (e.target.closest('#discordSignIn')) this.authManager.signInWithDiscord();
            if (e.target.closest('.server-join-btn')) this.handleServerJoin();
            if (e.target.closest('.ip-btn')) this.copyIP(e.target.closest('.ip-btn'));
            if (e.target.closest('.logout-btn')) this.authManager.signOut();

            const activeModal = document.querySelector('.auth-container.active, .ip-modal.active');
            if (activeModal) {
                 if (e.target.closest('.close-auth, .close-ip-modal') || e.target === activeModal) {
                    this.hideModal(activeModal);
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.auth-container.active, .ip-modal.active').forEach(modal => this.hideModal(modal));
            }
        });
    }
    
    async handleServerJoin() {
        const { data: { user } } = await this.authManager.supabase.auth.getUser();
        if (user) this.showModal('#ipModal');
        else this.showModal('#authPage');
    }

    toggleMobileMenu() { const nav = document.querySelector('nav'); nav.classList.toggle('active'); this.toggleOverlay(nav.classList.contains('active')); }
    toggleOverlay(show) { let overlay = document.querySelector('.nav-overlay'); if (show && !overlay) { overlay = document.createElement('div'); overlay.className = 'nav-overlay'; overlay.style.cssText = `position: fixed; top: 70px; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 98;`; document.body.appendChild(overlay); overlay.addEventListener('click', () => this.toggleMobileMenu()); } else if (!show && overlay) { overlay.remove(); } }
    
    // ОБНОВЛЕННАЯ ЛОГИКА ДЛЯ АНИМАЦИИ МОДАЛЬНЫХ ОКОН
    showModal(selector) {
        const modal = document.querySelector(selector);
        if (modal) {
            modal.classList.add('active');
        }
    }

    hideModal(modal) {
        if (typeof modal === 'string') modal = document.querySelector(modal);
        if (modal) {
            modal.classList.remove('active');
        }
    }

    async copyIP(button) { const ip = button.dataset.ip; if (!ip) return; try { await navigator.clipboard.writeText(ip); button.classList.add('copied'); setTimeout(() => button.classList.remove('copied'), 1500); } catch (err) { alert('Не удалось скопировать IP. Скопируйте вручную: ' + ip); } }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new MainPage(authManager);
});

window.scrollToServers = function() {
    document.getElementById('servers-section')?.scrollIntoView({ behavior: 'smooth' });
};
