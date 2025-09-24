class SupportPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.db = authManager.db;
        this.user = null;
        this.form = document.getElementById('ticket-form');
        this.feedbackDiv = document.getElementById('form-feedback');
        this.supportContent = document.getElementById('support-content');
        this.ticketExistsWarning = document.getElementById('ticket-exists-warning');
        this.loginPromptModal = document.getElementById('login-prompt');
        this.promptLoginBtn = document.getElementById('prompt-login-btn');
        this.init();
    }

    init() {
        // ИСПРАВЛЕНИЕ БАГА №3: Тоже слушаем событие о готовности пользователя
        document.addEventListener('userStateReady', (event) => {
            const user = event.detail;
            if (user) {
                this.user = this.authManager.user; // Берем полные данные из authManager
                this.setupAuthenticatedView();
            } else {
                this.setupGuestView();
            }
        });

        // Проверка на случай, если пользователь уже авторизован
        if (this.authManager.user) {
            this.user = this.authManager.user;
            this.setupAuthenticatedView();
        } else if (this.authManager.auth.currentUser === null) {
            // Если мы точно знаем, что пользователя нет, показываем окно входа
            this.setupGuestView();
        }
        
        if (this.form) this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    async setupAuthenticatedView() {
        this.loginPromptModal.classList.remove('active');
        try {
            const snapshot = await this.db.collection('tickets').where('user_id', '==', this.user.uid).where('is_closed', '==', false).limit(1).get();
            if (!snapshot.empty) {
                this.supportContent.style.display = 'none';
                this.ticketExistsWarning.style.display = 'block';
            } else {
                this.supportContent.style.display = 'block';
                this.ticketExistsWarning.style.display = 'none';
            }
        } catch (error) {
            this.showFeedback(`Ошибка проверки тикетов: ${error.message}`, 'error');
        }
    }

    setupGuestView() {
        this.supportContent.style.display = 'none';
        this.ticketExistsWarning.style.display = 'none';
        this.loginPromptModal.classList.add('active'); 
        this.promptLoginBtn.addEventListener('click', () => this.authManager.signInWithDiscord());
    }

    async handleSubmit(event) {
        event.preventDefault();
        if (!this.user) {
            this.showFeedback('Вы не авторизованы.', 'error');
            return;
        }
        const description = this.form.elements.description.value.trim();
        if (!description) return this.showFeedback('Описание не может быть пустым.', 'error');
        
        const submitButton = this.form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Отправка...';
        
        try {
            const newTicketRef = await this.db.collection('tickets').add({
                user_id: this.user.uid,
                description,
                is_closed: false,
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            await this.db.collection('messages').add({
                ticket_id: newTicketRef.id,
                user_id: this.user.uid,
                content: description,
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            document.body.classList.add('fade-out');
            setTimeout(() => window.location.href = `ticket.html?id=${newTicketRef.id}`, 250);
        } catch (error) {
            this.showFeedback(`Ошибка: ${error.message}`, 'error');
            submitButton.disabled = false;
            submitButton.textContent = 'Отправить обращение';
        }
    }
    
    showFeedback(message, type) {
        this.feedbackDiv.textContent = message;
        this.feedbackDiv.className = `form-feedback ${type} visible`;
        this.supportContent.style.display = 'block';
        setTimeout(() => { this.feedbackDiv.classList.remove('visible'); }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new SupportPage(authManager);
});
