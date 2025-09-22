class SupportPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.user = null;
        this.form = document.getElementById('ticket-form');
        this.feedbackDiv = document.getElementById('form-feedback');
        this.init();
    }

    async init() {
        const { data: { user } } = await this.authManager.supabase.auth.getUser();
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        this.user = user;
        
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.logout-btn')) {
                this.authManager.signOut();
            }
        });
    }

    async handleSubmit(event) {
        event.preventDefault();
        const description = this.form.elements.description.value;
        const submitButton = this.form.querySelector('button[type="submit"]');
        const displayName = this.user.user_metadata?.full_name || 'Неизвестно';
        submitButton.disabled = true;
        submitButton.textContent = 'Отправка...';
        try {
            const { error } = await this.authManager.supabase
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
        setTimeout(() => { this.feedbackDiv.classList.remove('visible'); }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new SupportPage(authManager);
});
