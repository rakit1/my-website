class App {
    constructor() {
        // Ключи Supabase
        this.SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
        this.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
        this.supabase = null;
        this.waitForDependencies().then(() => this.init());
    }

    async waitForDependencies() {
        return new Promise((resolve) => {
            const check = () => {
                if (typeof window.supabase !== 'undefined' && document.readyState !== 'loading') resolve();
                else setTimeout(check, 100);
            };
            if (document.readyState === 'complete') check();
            else document.addEventListener('DOMContentLoaded', check);
        });
    }

    init() {
        this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
        this.setupEventListeners();
        this.checkAuth();
        this.supabase.auth.onAuthStateChange(() => this.updateUserUI());
    }

    setupEventListeners() {
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.mobile-menu-btn')) this.toggleMobileMenu();
            if (e.target.closest('.login-btn')) this.showModal('#authPage');
            if (e.target.closest('#discordSignIn')) this.signInWithDiscord();
            if (e.target.closest('.server-join-btn')) this.handleServerJoin();
            if (e.target.closest('.ip-btn')) this.copyIP(e.target.closest('.ip-btn'));
            if (e.target.closest('.logout-btn')) this.signOut();

            const modal = e.target.closest('.auth-container, .ip-modal');
            if (e.target.closest('.close-auth, .close-ip-modal') || e.target === modal) {
                this.hideModal(modal);
            }
        });

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                document.querySelectorAll('.auth-container, .ip-modal').forEach(modal => this.hideModal(modal));
            }
        });
    }
    
    async signInWithDiscord() {
        const { error } = await this.supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: { 
                redirectTo: window.location.href,
                scopes: 'identify email'
            }
        });
        if (error) console.error('Ошибка входа через Discord:', error);
    }

    async signOut() {
        const { error } = await this.supabase.auth.signOut();
        if (error) console.error('Ошибка выхода:', error);
    }

    async updateUserUI() {
        const userSection = document.getElementById('userSection');
        if (!userSection) return;
        const { data: { user } } = await this.supabase.auth.getUser();
        if (user) {
            const name = this.escapeHtml(user.user_metadata?.full_name || user.email || 'Пользователь');
            const avatarUrl = this.escapeHtml(user.user_metadata?.avatar_url);
            userSection.innerHTML = `
                <div class="user-info">
                    <div class="user-dropdown">
                        <div class="user-name">
                            <div class="user-avatar" title="${name}">
                                ${avatarUrl ? `<img src="${avatarUrl}" alt="Аватар" style="width:100%;height:100%;border-radius:50%;">` : name.charAt(0).toUpperCase()}
                            </div>
                            <span>${name}</span>
                        </div>
                        <div class="dropdown-menu">
                            <button class="logout-btn">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22ZM12 20C16.4183 20 20 16.4183 20 12C20 7.58172 16.4183 4 12 4C7.58172 4 4 7.58172 4 12C4 16.4183 7.58172 20 12 20ZM12 11H16V13H12V16L8 12L12 8V11Z"></path></svg>
                                <span>Выйти</span>
                            </button>
                        </div>
                    </div>
                </div>`;
        } else {
            userSection.innerHTML = '<button class="login-btn">Войти</button>';
        }
    }
    
    // ... (остальные функции без изменений) ...
    async checkAuth() { await this.updateUserUI(); }
    toggleMobileMenu() { const nav = document.querySelector('nav'); nav.classList.toggle('active'); this.toggleOverlay(nav.classList.contains('active')); }
    toggleOverlay(show) { let overlay = document.querySelector('.nav-overlay'); if (show && !overlay) { overlay = document.createElement('div'); overlay.className = 'nav-overlay'; overlay.style.cssText = `position: fixed; top: 70px; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 98;`; document.body.appendChild(overlay); overlay.addEventListener('click', () => this.toggleMobileMenu()); } else if (!show && overlay) { overlay.remove(); } }
    showModal(selector) { const modal = document.querySelector(selector); if (modal) { modal.style.display = 'flex'; modal.setAttribute('aria-hidden', 'false'); } }
    hideModal(modal) { if (typeof modal === 'string') modal = document.querySelector(modal); if (modal && modal.style.display !== 'none') { modal.style.display = 'none'; modal.setAttribute('aria-hidden', 'true'); } }
    async handleServerJoin() { const { data: { user } } = await this.supabase.auth.getUser(); if (user) { this.showModal('#ipModal'); } else { this.showModal('#authPage'); } }
    async copyIP(button) { const ip = button.dataset.ip; if (!ip) return; try { await navigator.clipboard.writeText(ip); button.classList.add('copied'); setTimeout(() => button.classList.remove('copied'), 1500); } catch (err) { console.error('Не удалось скопировать IP: ', err); alert('Не удалось скопировать IP. Скопируйте вручную: ' + ip); } }
    escapeHtml(unsafe) { if (!unsafe) return ''; return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;"); }
}

const app = new App();

window.scrollToServers = function() {
    document.getElementById('servers-section')?.scrollIntoView({ behavior: 'smooth' });
};
