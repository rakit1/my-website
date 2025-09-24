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
            if (e.target.closest('.login-btn')) this.showModal('#authPage');
            if (e.target.closest('#discordSignIn')) this.authManager.signInWithDiscord();
            if (e.target.closest('.server-join-btn')) this.handleServerJoin();
            if (e.target.closest('.ip-btn')) this.copyIP(e.target.closest('.ip-btn'));
            if (e.target.closest('.close-auth, .close-ip-modal, .close-beta-warning-btn')) {
                const modal = e.target.closest('.auth-container, .ip-modal');
                if (modal) {
                    this.hideModal(modal);
                    if (modal.id === 'betaWarningModal') sessionStorage.setItem('betaWarningShown', 'true');
                }
            }
            const activeModal = document.querySelector('.auth-container.active, .ip-modal.active');
            if (activeModal && e.target === activeModal) {
                this.hideModal(activeModal);
                if (activeModal.id === 'betaWarningModal') sessionStorage.setItem('betaWarningShown', 'true');
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
        if (this.authManager.user) {
            this.showModal('#ipModal');
        } else {
            this.showModal('#authPage');
        }
    }
    
    showModal(selector) {
        document.querySelector(selector)?.classList.add('active');
    }

    hideModal(selector) {
        document.querySelector(selector)?.classList.remove('active');
    }

    async copyIP(button) {
        const ip = button.dataset.ip;
        if (!ip) return;
        try {
            await navigator.clipboard.writeText(ip);
            button.classList.add('copied');
            setTimeout(() => button.classList.remove('copied'), 1500);
        } catch (err) {
            alert('Не удалось скопировать IP. Скопируйте вручную: ' + ip);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new MainPage(authManager);
});

window.scrollToServers = function() {
    document.getElementById('servers-section')?.scrollIntoView({ behavior: 'smooth' });
};
