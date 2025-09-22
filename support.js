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
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M4 18H6V20H18V4H6V6H4V3C4 2.44772 4.44772 2 5 2H19C19.5523 2 20 2.44772 20 3V21C20 21.5523 19.5523 22 19 22H5C4.44772 22 4 21.5523 4 21V18ZM6 11H13V13H6V11ZM13.8284 7.75736L11 10.5858L9.58579 9.17157L8.17157 10.5858L11 13.4142L15.2426 9.17157L13.8284 7.75736Z"></path></svg>
                            <span>Выйти</span>
                        </button>
                    </div>
                </div>
            </div>`;
        this.setupUserMenuListeners(userSection);
    }

    setupUserMenuListeners(userSection) {
        // Убрали обработчик клика для открытия, оставили только для выхода
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
