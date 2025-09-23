class SupportPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.user = null;
        this.form = document.getElementById('ticket-form');
        this.feedbackDiv = document.getElementById('form-feedback');
        
        this.supportContent = document.getElementById('support-content');
        this.ticketExistsWarning = document.getElementById('ticket-exists-warning');
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

        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
        }
    }

    async setupAuthenticatedView() {
        this.loginPromptModal.classList.remove('active');

        try {
            // Проверяем, есть ли у пользователя уже открытый тикет
            const { data, error, count } = await this.authManager.supabase
                .from('tickets')
                .select('id', { count: 'exact', head: true })
                .eq('user_id', this.user.id)
                .eq('is_closed', false);

            if (error) throw error;
            
            // Если есть открытый тикет (count > 0), показываем предупреждение
            if (count > 0) {
                this.supportContent.style.display = 'none';
                this.ticketExistsWarning.style.display = 'block';
            } else {
                // Если нет, показываем форму для создания
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
            const { data: ticketData, error: ticketError } = await this.authManager.supabase
                .from('tickets')
                .insert([{ description: description, user_id: this.user.id }])
                .select()
                .single();

            if (ticketError) throw ticketError;
            
            const newTicketId = ticketData.id;

            const { error: messageError } = await this.authManager.supabase
                .from('messages')
                .insert([{ 
                    ticket_id: newTicketId, 
                    user_id: this.user.id, 
                    content: description,
                    ticket_owner_id: this.user.id 
                }]);
                
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
        this.supportContent.style.display = 'block'; // Убедимся, что форма видна для отображения ошибки
        setTimeout(() => { this.feedbackDiv.classList.remove('visible'); }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new SupportPage(authManager);
});
