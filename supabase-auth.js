// supabase-auth.js
class AuthManager {
    constructor() {
        this.SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
        this.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
        this.supabase = null;
        this.init();
    }

    async init() {
        if (typeof window.supabase === 'undefined') {
            console.error("Supabase не загружен!");
            return;
        }

        try {
            this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
            this.setupEventListeners();
            await this.checkAuth();
            this.supabase.auth.onAuthStateChange((event, session) => {
                this.updateUI();
            });
        } catch (error) {
            console.error('Ошибка инициализации Supabase:', error);
        }
    }

    setupEventListeners() {
        this.on('#discordSignIn', 'click', (e) => {
            e.preventDefault();
            this.signInWithDiscord();
        });

        // Выход через dropdown
        this.on('#userSection', 'click', (e) => {
            if (e.target.closest('.login-btn')) {
                this.showModal('#authPage');
            }
            if (e.target.classList.contains('user-dropdown-btn')) {
                this.signOut();
            }
        });

        // Close modals
        this.on('.close-auth', 'click', () => this.hideModal('#authPage'));
        this.on('.close-ip-modal', 'click', () => this.hideModal('#ipModal'));

        this.on('#authPage', 'click', (e) => {
            if (e.target === e.currentTarget) this.hideModal('#authPage');
        });
        this.on('#ipModal', 'click', (e) => {
            if (e.target === e.currentTarget) this.hideModal('#ipModal');
        });

        this.on('.server-join-btn', 'click', () => this.handleServerJoin());
        this.on('.ip-btn', 'click', (e) => this.copyIP(e.currentTarget));
    }

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
            const { data, error } = await this.supabase.auth.signInWithOAuth({
                provider: 'discord',
                options: { 
                    redirectTo: 'https://rakit1.github.io/my-website/',
                    scopes: 'identify email'
                }
            });
            if (error) {
                alert('Ошибка при входе через Discord: ' + error.message);
                return;
            }
        } catch (error) {
            alert('Произошла ошибка при авторизации');
        }
    }

    async signOut() {
        try {
            const { error } = await this.supabase.auth.signOut();
            if (error) throw error;
            this.updateUI();
            this.hideModal('#authPage');
            this.hideModal('#ipModal');
        } catch (error) {
            alert('Не удалось выйти из аккаунта');
        }
    }

    async checkAuth() {
        try {
            const { data: { session }, error } = await this.supabase.auth.getSession();
            if (session) {
                this.updateUI();
            }
        } catch {}
    }

    // --- ГЛАВНОЕ ИЗМЕНЕНИЕ: user-info-wrap для правильной структуры ---
    async updateUI() {
        const userSection = document.getElementById('userSection');
        if (!userSection) return;

        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            if (user) {
                const name = user.user_metadata?.full_name || user.user_metadata?.global_name || user.email || 'User';
                const avatarUrl = user.user_metadata?.avatar_url;
                userSection.innerHTML = `
                    <div class="user-info-wrap">
                      <div class="user-info" tabindex="0">
                          <div class="user-avatar" title="${name}">
                              ${avatarUrl ? 
                                  `<img src="${avatarUrl}" alt="${name}" style="width:100%;height:100%;border-radius:50%;">` : 
                                  name[0]
                              }
                          </div>
                          <span>${name}</span>
                      </div>
                      <div class="user-dropdown">
                          <button class="user-dropdown-btn" type="button">Выйти</button>
                      </div>
                    </div>
                `;
            } else {
                userSection.innerHTML = '<button class="login-btn">Войти</button>';
            }
        } catch {
            userSection.innerHTML = '<button class="login-btn">Войти</button>';
        }
    }

    async handleServerJoin() {
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            if (user) {
                this.showModal('#ipModal');
            } else {
                this.showModal('#authPage');
            }
        } catch {
            this.showModal('#authPage');
        }
    }

    async copyIP(button) {
        const ip = button.getAttribute('data-ip');
        try {
            await navigator.clipboard.writeText(ip);
            button.classList.add('copied');
            setTimeout(() => {
                button.classList.remove('copied');
            }, 1200);
        } catch {
            try {
                const textArea = document.createElement('textarea');
                textArea.value = ip;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                button.classList.add('copied');
                setTimeout(() => button.classList.remove('copied'), 1200);
            } catch {
                alert('Не удалось скопировать IP. Скопируйте вручную: ' + ip);
            }
        }
    }
}

document.addEventListener('DOMContentLoaded', function() {
    if (typeof window.supabase !== 'undefined') {
        new AuthManager();
    } else {
        const checkSupabase = setInterval(() => {
            if (typeof window.supabase !== 'undefined') {
                clearInterval(checkSupabase);
                new AuthManager();
            }
        }, 100);
    }
});

window.scrollToServers = function() {
    const el = document.getElementById('servers-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
