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
            if (e.target.closest('.close-auth') || e.target === this.loginPromptModal) {
                this.loginPromptModal.classList.remove('active');
                if (!this.user) {
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
        submitButton.disabled = true;
        submitButton.textContent = 'Отправка...';
        
        try {
            // Создаем тикет
            const { data: ticketData, error: ticketError } = await this.authManager.supabase
                .from('tickets')
                .insert([{ description: description, user_id: this.user.id }])
                .select()
                .single();

            if (ticketError) throw ticketError;
            
            const newTicketId = ticketData.id;

            // Сразу после создания тикета создаем первое сообщение
            // ИСПРАВЛЕНИЕ: Добавили `ticket_owner_id`, указывая, что автор тикета - текущий пользователь
            const { error: messageError } = await this.authManager.supabase
                .from('messages')
                .insert([{ 
                    ticket_id: newTicketId, 
                    user_id: this.user.id, 
                    content: description,
                    ticket_owner_id: this.user.id 
                }]);
                
            if (messageError) throw messageError;

            // Если все успешно, переходим на страницу тикета
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
