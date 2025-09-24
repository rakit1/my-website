class SupportPage {
    constructor() {
        this.db = firebase.firestore();
        this.user = null;
        this.form = document.getElementById('ticket-form');
        this.feedbackDiv = document.getElementById('form-feedback');
        this.supportContent = document.getElementById('support-content');
        this.ticketExistsWarning = document.getElementById('ticket-exists-warning');
        this.loginPromptModal = document.getElementById('login-prompt');
        this.promptLoginBtn = document.getElementById('prompt-login-btn');

        // Ждем события 'userStateReady' от auth.js
        document.addEventListener('userStateReady', (event) => {
            this.user = event.detail;
            if (this.user) {
                this.setupAuthenticatedView();
            } else {
                this.setupGuestView();
            }
        });

        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
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
        if (this.promptLoginBtn) {
            this.promptLoginBtn.addEventListener('click', () => window.authManager.signInWithDiscord());
        }
    }

    async handleSubmit(event) {
        event.preventDefault();
        const description = this.form.elements.description.value.trim();
        if (!description) {
            return this.showFeedback('Описание не может быть пустым.', 'error');
        }
        
        const submitButton = this.form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Создание...';

        const counterRef = this.db.collection('counters').doc('tickets');
        const newTicketRef = this.db.collection('tickets').doc();

        try {
            await this.db.runTransaction(async (transaction) => {
                const counterDoc = await transaction.get(counterRef);
                if (!counterDoc.exists) {
                    throw new Error("Документ-счетчик не найден!");
                }
                const newNumber = counterDoc.data().current_number + 1;
                
                transaction.update(counterRef, { current_number: newNumber });
                
                const ticketData = {
                    user_id: this.user.uid,
                    description,
                    is_closed: false,
                    created_at: firebase.firestore.FieldValue.serverTimestamp(),
                    ticket_number: newNumber
                };
                transaction.set(newTicketRef, ticketData);
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
        setTimeout(() => { this.feedbackDiv.classList.remove('visible'); }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SupportPage();
});
