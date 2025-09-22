class SupportPage {
    constructor() {
        this.SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
        this.SUPABASE_ANON_KEY = "eyJhbGciOiJIJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
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

        // ИЗМЕНЕНИЕ: Теперь мы берем ОБЫЧНОЕ имя и используем его для обоих полей
        const displayName = this.user.user_metadata?.full_name || 'Неизвестно';

        submitButton.disabled = true;
        submitButton.textContent = 'Отправка...';

        try {
            const { error } = await this.supabase
                .from('tickets')
                .insert([
                    { 
                        description: description,
                        username: displayName, 
                        discord_username: displayName, // Используем обычное имя и здесь
                        user_id: this.user.id 
                    }
                ]);

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
            <div class.user-info">
                <div class="user-avatar" title="${name}">
                    ${avatarUrl ? `<img src="${avatarUrl}" alt="Аватар" style="width:100%;height:100%;border-radius:50%;">` : name.charAt(0).toUpperCase()}
                </div>
                <div class="user-dropdown">
                    <span class="user-name">${name}</span>
                    <div class="dropdown-menu">
                        <button class="logout-btn">Выйти</button>
                    </div>
                </div>
            </div>`;
        
        this.setupUserMenuListeners(userSection);
    }

    setupUserMenuListeners(userSection) {
        const userNameElem = userSection.querySelector('.user-name');
        const dropdown = userSection.querySelector('.user-dropdown');
        const logoutBtn = userSection.querySelector('.logout-btn');

        if (userNameElem) {
            userNameElem.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('active');
            });
        }
        
        if(logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('active');
            }
        });
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
