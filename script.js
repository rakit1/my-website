class MainPage {
    constructor() {
        // Просто ждем, пока authManager будет готов
        document.addEventListener('userStateReady', (event) => {
            this.user = event.detail;
            this.init();
        });
    }
    
    init() {
        this.setupEventListeners();
        this.updateOnlineCount();
        this.showBetaWarningOnce();
        setInterval(() => this.updateOnlineCount(), 60000);
    }

    showBetaWarningOnce() {
        const modal = document.getElementById('betaWarningModal');
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
        }
    }

    setupEventListeners() {
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.server-join-btn')) this.handleServerJoin();
            if (e.target.closest('.ip-btn')) this.copyIP(e.target.closest('.ip-btn'));
            
            const modalToClose = e.target.closest('.auth-container, .ip-modal');
            if (e.target.closest('.close-auth, .close-ip-modal, .close-beta-warning-btn') || e.target === modalToClose) {
                if (modalToClose) {
                    this.hideModal(modalToClose);
                    if (modalToClose.id === 'betaWarningModal') sessionStorage.setItem('betaWarningShown', 'true');
                }
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const activeModal = document.querySelector('.auth-container.active, .ip-modal.active');
                if (activeModal) this.hideModal(activeModal);
            }
        });
    }
    
    handleServerJoin() {
        if (this.user) {
            this.showModal('#ipModal');
        } else {
            // Если пользователя нет, просим authManager начать вход
            window.authManager.signInWithDiscord();
        }
    }
    
    showModal(selector) {
        const element = document.querySelector(selector);
        if (element) element.classList.add('active');
    }

    hideModal(element) {
        if (element) element.classList.remove('active');
    }

    async copyIP(button) {
        const ip = button.dataset.ip;
        if (!ip) return;
        try {
            await navigator.clipboard.writeText(ip);
            button.classList.add('copied');
            setTimeout(() => button.classList.remove('copied'), 1500);
        } catch (err) {
            console.error('Не удалось скопировать IP:', err);
            alert('Не удалось скопировать IP. Скопируйте вручную: ' + ip);
        }
    }
}

// Запускаем логику главной страницы
new MainPage();

// Глобальная функция для скролла, оставляем как есть
window.scrollToServers = function() {
    document.getElementById('servers-section')?.scrollIntoView({ behavior: 'smooth' });
};
