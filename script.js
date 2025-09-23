class MainPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.updateOnlineCount();
        this.showBetaWarningOnce();
        setInterval(() => this.updateOnlineCount(), 60000);
    }

    showBetaWarningOnce() {
        const modal = document.getElementById('betaWarningModal');
        // Показываем окно, только если оно не было показано в этой сессии
        if (modal && !sessionStorage.getItem('betaWarningShown')) {
            this.showModal(modal);
        }
    }

    async updateOnlineCount() {
        const serverIp = "cbworlds.aboba.host";
        const heroOnlineElement = document.getElementById('online-count');
        const cardOnlineElement = document.getElementById('server-card-online');
        const onlineDotElement = document.querySelector('.online-dot');

        try {
            const response = await fetch(`https://api.mcsrvstat.us/2/${serverIp}`);
            const data = await response.json();

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
            // Обработчики для всех кнопок
            if (e.target.closest('.mobile-menu-btn')) this.toggleMobileMenu();
            if (e.target.closest('.login-btn')) this.showModal('#authPage');
            if (e.target.closest('#discordSignIn')) this.authManager.signInWithDiscord();
            if (e.target.closest('.server-join-btn')) this.handleServerJoin();
            if (e.target.closest('.ip-btn')) this.copyIP(e.target.closest('.ip-btn'));
            if (e.target.closest('.logout-btn')) this.authManager.signOut();

            // ИСПРАВЛЕНИЕ: Логика закрытия модальных окон
            const authModal = e.target.closest('.auth-container');
            if (authModal) {
                // Если кликнули на кнопку закрытия бета-окна (крестик или кнопку "Я понимаю")
                if (e.target.closest('.close-beta-warning-btn') || (authModal.id === 'betaWarningModal' && e.target.closest('.close-auth'))) {
                    this.hideModal(authModal);
                    // Сразу же запоминаем, что окно было показано
                    sessionStorage.setItem('betaWarningShown', 'true');
                } 
                // Логика для других модальных окон
                else if (e.target.closest('.close-auth, .close-ip-modal') || e.target === authModal) {
                    this.hideModal(authModal);
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.auth-container.active').forEach(modal => this.hideModal(modal));
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
    
    showModal(selector) {
        const modal = typeof selector === 'string' ? document.querySelector(selector) : selector;
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
