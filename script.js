class MainPage {
    constructor() {
        document.addEventListener('userStateReady', (event) => {
            this.user = event.detail;
            this.initPage();
        });
    }
    
    initPage() {
        this.setupEventListeners();
        this.updateOnlineCount();
        this.showBetaWarningOnce();
        setInterval(() => this.updateOnlineCount(), 60000);
    }

    showBetaWarningOnce() {
        const modal = document.getElementById('betaWarningModal');
        if (modal && !sessionStorage.getItem('betaWarningShown')) this.showModal(modal);
    }

    async updateOnlineCount() {
        const serverIp = "cbworlds.aboba.host";
        const heroOnline = document.getElementById('online-count');
        const cardOnline = document.getElementById('server-card-online');
        const onlineDot = document.querySelector('.online-dot');
        try {
            const response = await fetch(`https://api.mcsrvstat.us/2/${serverIp}`);
            const data = await response.json();
            if (data.online) {
                const onlineText = data.players.online;
                if (heroOnline) heroOnline.textContent = onlineText;
                if (cardOnline) cardOnline.textContent = `${onlineText} онлайн`;
                if (onlineDot) onlineDot.style.background = 'var(--primary)';
            } else {
                if (heroOnline) heroOnline.textContent = 'Оффлайн';
                if (cardOnline) cardOnline.textContent = `Оффлайн`;
                if (onlineDot) onlineDot.style.background = '#eb445a';
            }
        } catch (error) {
            console.error("Ошибка получения онлайна:", error);
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
            alert('Не удалось скопировать IP. Скопируйте вручную: ' + ip);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new MainPage();
});

window.scrollToServers = () => {
    document.getElementById('servers-section')?.scrollIntoView({ behavior: 'smooth' });
};
