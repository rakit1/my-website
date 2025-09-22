class SupportPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.user = null;
        this.form = document.getElementById('ticket-form');
        this.feedbackDiv = document.getElementById('form-feedback');
        
        this.supportContent = document.getElementById('support-content');
        this.loginPromptModal = document.getElementById('login-prompt');
        this.promptLoginBtn = document.getElementById('prompt-login-btn');

        this.init();
    }

    async init() {
        const { data: { user } } = await this.authManager.supabase.auth.getUser();
        
        if (user) {
            this.user = user;
            this.setupAuthenticatedView();
        } else {
            this.setupGuestView();
        }
        
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.logout-btn')) {
                this.authManager.signOut();
            }
            // ИСПРАВЛЕНИЕ 1: Перенаправление на главную при закрытии модального окна
            if (e.target.closest('.close-auth') || e.target === this.loginPromptModal) {
                this.loginPromptModal.classList.remove('active');
                if (!this.user) { // Если пользователь не авторизован
                    document.body.classList.add('fade-out');
                    setTimeout(() => {
                        window.location.href = 'index.html';
                    }, 250);
                }
            }
        });

        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
    }

    setupAuthenticatedView() {
        this.supportContent.style.display = 'block';
        this.loginPromptModal.classList.remove('active');
    }

    setupGuestView() {
        this.supportContent.style.display = 'none';
        this.loginPromptModal.classList.add('active'); 
        this.promptLoginBtn.addEventListener('click', () => {
            this.authManager.signInWithDiscord();
        });
    }

    async handleSubmit(event) {
        event.preventDefault();
        const description = this.form.elements.description.value.trim();
        if (!description) {
            this.showFeedback('Описание не может быть пустым.', 'error');
            return;
        }

        const submitButton = this.form.querySelector('button[type="submit"]');
        const displayName = this.user.user_metadata?.full_name || 'Неизвестно';
        submitButton.disabled = true;
        submitButton.textContent = 'Отправка...';
        
        try {
            const { data, error } = await this.authManager.supabase
                .from('tickets')
                .insert([{ description: description, username: displayName, user_id: this.user.id }])
                .select()
                .single();

            if (error) throw error;
            
            const newTicketId = data.id;

            const { error: messageError } = await this.authManager.supabase
                .from('messages')
                .insert([{ ticket_id: newTicketId, user_id: this.user.id, content: description }]);
                
            if (messageError) throw messageError;

            document.body.classList.add('fade-out');
            setTimeout(() => {
                window.location.href = `ticket.html?id=${newTicketId}`;
            }, 250);

        } catch (error) {
            this.showFeedback(`Ошибка: ${error.message}`, 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Отправить обращение';
        }
    }
    
    showFeedback(message, type) {
        this.feedbackDiv.textContent = message;
        this.feedbackDiv.className = `form-feedback ${type} visible`;
        setTimeout(() => { this.feedbackDiv.classList.remove('visible'); }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new SupportPage(authManager);
});
