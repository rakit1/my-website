class SupportPage {
    constructor() {
        this.SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
        this.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
        this.supabase = null;
        this.user = null;
        this.form = document.getElementById('ticket-form');
        this.feedbackDiv = document.getElementById('form-feedback');
        document.addEventListener('DOMContentLoaded', () => this.init());
    }

    async init() {
        this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        this.user = user;
        this.updateUserUI();
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
    
    async handleSubmit(event) {
        event.preventDefault();
        const description = this.form.elements.description.value;
        const submitButton = this.form.querySelector('button[type="submit"]');
        const displayName = this.user.user_metadata?.full_name || 'Неизвестно';
        submitButton.disabled = true;
        submitButton.textContent = 'Отправка...';
        try {
            const { error } = await this.supabase
                .from('tickets')
                .insert([{ description: description, username: displayName, user_id: this.user.id }]);
            if (error) throw error;
            this.showFeedback('Ваше обращение успешно отправлено!', 'success');
            this.form.reset();
        } catch (error) {
            this.showFeedback(`Ошибка: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Отправить обращение';
        }
    }
    
    showFeedback(message, type) {
        this.feedbackDiv.textContent = message;
        this.feedbackDiv.className = `form-feedback ${type} visible`;
        this.feedbackDiv.setAttribute('aria-hidden', 'false');
        setTimeout(() => {
            this.feedbackDiv.classList.remove('visible');
            this.feedbackDiv.setAttribute('aria-hidden', 'true');
        }, 5000);
    }

    updateUserUI() {
        const userSection = document.getElementById('userSection');
        if (!userSection || !this.user) return;
        const name = this.user.user_metadata?.full_name || this.user.email;
        const avatarUrl = this.user.user_metadata?.avatar_url;
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
        this.setupUserMenuListeners(userSection);
    }

    setupUserMenuListeners(userSection) {
        const logoutBtn = userSection.querySelector('.logout-btn');
        if(logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
    }

    async handleLogout() {
        const { error } = await this.supabase.auth.signOut();
        if (error) {
            console.error('Ошибка при выходе:', error.message);
            alert('Не удалось выйти. Попробуйте еще раз.');
        } else {
            window.location.href = 'index.html';
        }
    }
}

new SupportPage();
