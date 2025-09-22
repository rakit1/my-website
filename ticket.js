class TicketPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.user = null;
        this.ticketId = new URLSearchParams(window.location.search).get('id');
        
        this.chatBox = document.getElementById('chat-box');
        this.messageForm = document.getElementById('message-form');
        this.ticketTitle = document.getElementById('ticket-title');
        this.messageTextarea = this.messageForm.querySelector('textarea[name="message"]');
        this.sendMessageButton = this.messageForm.querySelector('button[type="submit"]');
        this.closeTicketButton = document.getElementById('close-ticket-btn');

        this.confirmationModal = document.getElementById('confirmation-modal');
        this.confirmCloseBtn = document.getElementById('confirm-close-btn');
        this.cancelCloseBtn = document.getElementById('cancel-close-btn');

        this.isTicketClosed = false;

        this.init();
    }

    async init() {
        if (!this.ticketId) {
            window.location.href = 'account.html';
            return;
        }

        const { data: { user } } = await this.authManager.supabase.auth.getUser();

        if (user) {
            this.user = user;
            await this.loadInitialData();
            this.setupEventListeners();
            this.subscribeToMessages();
        } else {
            window.location.href = 'index.html';
        }
    }
    
    async loadInitialData() {
        const { data: ticketData, error: ticketError } = await this.authManager.supabase
            .from('tickets')
            .select('description, created_at, is_closed')
            .eq('id', this.ticketId)
            .eq('user_id', this.user.id)
            .single();

        if (ticketError || !ticketData) {
            this.chatBox.innerHTML = '<p class="error-message">Не удалось найти тикет или у вас нет к нему доступа.</p>';
            this.messageForm.style.display = 'none';
            this.closeTicketButton.style.display = 'none';
            return;
        }

        this.ticketTitle.textContent = `Тикет #${this.ticketId}`;
        this.isTicketClosed = ticketData.is_closed;
        this.updateTicketUI();
        
        const { data: messages, error: messagesError } = await this.authManager.supabase
            .from('messages')
            .select('content, created_at, user_id')
            .eq('ticket_id', this.ticketId)
            .order('created_at');

        if (messagesError) {
             this.chatBox.innerHTML = '<p class="error-message">Не удалось загрузить сообщения.</p>';
             return;
        }
        
        this.chatBox.innerHTML = '';
        messages.forEach(msg => this.addMessageToBox(msg));
        this.scrollToBottom();
    }

    addMessageToBox(message) {
        const messageDiv = document.createElement('div');
        const isUser = message.user_id === this.user.id;
        messageDiv.className = `message ${isUser ? 'user' : 'admin'}`;
        
        const date = new Date(message.created_at).toLocaleString('ru-RU');

        messageDiv.innerHTML = `<p>${message.content}</p><span>${date}</span>`;
        this.chatBox.appendChild(messageDiv);
    }
    
    scrollToBottom() {
        this.chatBox.scrollTop = this.chatBox.scrollHeight;
    }

    setupEventListeners() {
        this.messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = this.messageTextarea.value.trim();
            if (!content || this.isTicketClosed) return;

            this.sendMessageButton.disabled = true;

            try {
                // ИСПРАВЛЕНО: Теперь мы получаем отправленное сообщение обратно
                const { data, error } = await this.authManager.supabase
                    .from('messages')
                    .insert({ ticket_id: this.ticketId, user_id: this.user.id, content: content })
                    .select()
                    .single();

                if (error) throw error;
                
                // ИСПРАВЛЕНО: И сразу же добавляем его в чат, не дожидаясь ответа от сервера
                this.addMessageToBox(data);
                this.scrollToBottom();
                this.messageForm.reset();
            } catch (error) {
                alert('Ошибка отправки сообщения: ' + error.message);
            } finally {
                this.sendMessageButton.disabled = false;
            }
        });

        this.closeTicketButton.addEventListener('click', () => {
            if (!this.isTicketClosed) this.confirmationModal.classList.add('active');
        });

        this.cancelCloseBtn.addEventListener('click', () => {
            this.confirmationModal.classList.remove('active');
        });

        this.confirmCloseBtn.addEventListener('click', () => this.executeTicketClosure());
    }

    async executeTicketClosure() {
        this.confirmCloseBtn.disabled = true;
        this.confirmCloseBtn.textContent = 'Закрытие...';

        try {
            const { error } = await this.authManager.supabase
                .from('tickets')
                .update({ is_closed: true })
                .eq('id', this.ticketId)
                .eq('user_id', this.user.id);

            if (error) throw error;

            this.isTicketClosed = true;
            this.updateTicketUI();
        } catch (error) {
            alert('Ошибка при закрытии тикета: ' + error.message);
        } finally {
            this.confirmationModal.classList.remove('active');
            this.confirmCloseBtn.disabled = false;
            this.confirmCloseBtn.textContent = 'Закрыть тикет';
        }
    }

    updateTicketUI() {
        if (this.isTicketClosed) {
            this.messageTextarea.disabled = true;
            this.messageTextarea.placeholder = 'Тикет закрыт. Отправка сообщений недоступна.';
            this.sendMessageButton.disabled = true;
            this.closeTicketButton.disabled = true;
            this.closeTicketButton.textContent = 'Тикет закрыт';
        } else {
            this.messageTextarea.disabled = false;
            this.messageTextarea.placeholder = 'Введите ваше сообщение...';
            this.sendMessageButton.disabled = false;
            this.closeTicketButton.disabled = false;
            this.closeTicketButton.textContent = 'Закрыть тикет';
        }
    }

    subscribeToMessages() {
        this.authManager.supabase
            .channel(`messages_ticket_${this.ticketId}`)
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `ticket_id=eq.${this.ticketId}`
            }, (payload) => {
                // ИСПРАВЛЕНО: Добавляем сообщение, только если оно пришло от другого пользователя,
                // чтобы избежать дублирования (свое сообщение мы уже добавили сами)
                if (payload.new.user_id !== this.user.id) {
                    this.addMessageToBox(payload.new);
                    this.scrollToBottom();
                }
            })
            .subscribe();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new TicketPage(authManager);
});
