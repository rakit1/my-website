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
        document.addEventListener('userStateReady', (event) => {
            this.user = event.detail;
            if (this.user) {
                this.setupAuthenticatedView();
            } else {
                this.setupGuestView();
            }
        });
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

    // ИЗМЕНЕНО: Логика создания тикета теперь использует транзакцию и счетчик
    async handleSubmit(event) {
        event.preventDefault();
        const description = this.form.elements.description.value.trim();
        if (!description) return this.showFeedback('Описание не может быть пустым.', 'error');
        
        const submitButton = this.form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Создание...';

        const counterRef = this.db.collection('counters').doc('tickets');
        const newTicketRef = this.db.collection('tickets').doc(); // Firestore все еще генерирует уникальный ID

        try {
            // Запускаем транзакцию, чтобы безопасно получить новый номер
            const newTicketNumber = await this.db.runTransaction(async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                if (!counterDoc.exists) {
                    throw "Документ-счетчик не найден!";
                }
                const newNumber = counterDoc.data().current_number + 1;
                
                // 1. Обновляем счетчик
                transaction.update(counterRef, { current_number: newNumber });
                
                // 2. Создаем новый тикет
                const ticketData = {
                    user_id: this.user.uid,
                    description,
                    is_closed: false,
                    created_at: firebase.firestore.FieldValue.serverTimestamp(),
                    ticket_number: newNumber // Добавляем наш номер
                };
                transaction.set(newTicketRef, ticketData);
                
                return newNumber;
            });

            // 3. Создаем первое сообщение для этого тикета
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
        setTimeout(() => { this.feedbackDiv.classList.remove('visible'); }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new SupportPage(authManager);
});
