class AuthManager {
    constructor() {
        this.SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
        this.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
        this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);

        this.supabase.auth.getSession().then(({ data: { session } }) => {
            this.updateUserUI(session?.user);
        });
        
        this.supabase.auth.onAuthStateChange((event, session) => {
            this.updateUserUI(session?.user);
        });
    }

    async signInWithDiscord() {
        await this.supabase.auth.signInWithOAuth({
            provider: 'discord',
            options: { 
                redirectTo: window.location.href,
                scopes: 'identify email'
            }
        });
    }

    async signOut() {
        document.body.classList.add('fade-out');
        setTimeout(async () => {
            await this.supabase.auth.signOut();
            window.location.href = 'index.html';
        }, 500);
    }

    updateUserUI(user) {
        const userSection = document.getElementById('userSection');
        if (!userSection) return;

        if (user) {
            const name = user.user_metadata?.full_name || user.email || 'Пользователь';
            const avatarUrl = user.user_metadata?.avatar_url;
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
                            <a href="account.html" class="dropdown-item">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 4c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm0 14c-2.03 0-4.43-.82-6.14-2.88a9.947 9.947 0 0 1 12.28 0C16.43 19.18 14.03 20 12 20z"></path></svg>
                                <span>Личный кабинет</span>
                            </a>
                            <button class="logout-btn dropdown-item">
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
}
