class TicketPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.user = null;
        this.ticketId = new URLSearchParams(window.location.search).get('id');
        
        this.chatBox = document.getElementById('chat-box');
        this.messageForm = document.getElementById('message-form');
        this.ticketTitle = document.getElementById('ticket-title');
        this.messageTextarea = this.messageForm.querySelector('textarea[name="message"]'); // Добавлено
        this.sendMessageButton = this.messageForm.querySelector('button[type="submit"]'); // Добавлено
        this.closeTicketButton = document.getElementById('close-ticket-btn'); // Добавлено

        this.isTicketClosed = false; // Состояние тикета

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
            await this.loadInitialData(); // Ожидаем загрузку данных
            this.setupEventListeners();
            this.subscribeToMessages();
        } else {
            window.location.href = 'index.html';
        }
    }
    
    async loadInitialData() {
        const { data: ticketData, error: ticketError } = await this.authManager.supabase
            .from('tickets')
            .select('description, created_at, is_closed') // ИЗМЕНЕНИЕ 3: Получаем статус is_closed
            .eq('id', this.ticketId)
            .eq('user_id', this.user.id)
            .single();

        if (ticketError || !ticketData) {
            this.chatBox.innerHTML = '<p class="error-message">Не удалось найти тикет или у вас нет к нему доступа.</p>';
            this.messageForm.style.display = 'none';
            return;
        }

        this.ticketTitle.textContent = `Тикет #${this.ticketId}`;
        this.isTicketClosed = ticketData.is_closed; // Обновляем состояние тикета

        // ИЗМЕНЕНИЕ 3: Обновляем UI в зависимости от статуса тикета
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

        messageDiv.innerHTML = `
            <p>${message.content}</p>
            <span>${date}</span>
        `;
        this.chatBox.appendChild(messageDiv);
    }
    
    scrollToBottom() {
        this.chatBox.scrollTop = this.chatBox.scrollHeight;
    }

    setupEventListeners() {
        this.messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = this.messageTextarea.value.trim();
            if (!content) return;
            if (this.isTicketClosed) return; // Не отправляем, если тикет закрыт

            this.sendMessageButton.disabled = true;
            this.sendMessageButton.textContent = 'Отправка...';

            try {
                const { data, error } = await this.authManager.supabase
                    .from('messages')
                    .insert({
                        ticket_id: this.ticketId,
                        user_id: this.user.id,
                        content: content
                    })
                    .select() // ИЗМЕНЕНИЕ 2: Запрашиваем вставленные данные
                    .single();

                if (error) throw error;
                
                // ИЗМЕНЕНИЕ 2: Мгновенное отображение отправленного сообщения
                this.addMessageToBox(data);
                this.scrollToBottom();
                this.messageForm.reset();

            } catch (error) {
                alert('Ошибка отправки сообщения: ' + error.message);
            } finally {
                this.sendMessageButton.disabled = false;
                this.sendMessageButton.textContent = 'Отправить';
            }
        });

        // ИЗМЕНЕНИЕ 3: Обработчик для кнопки закрытия тикета
        if (this.closeTicketButton) {
            this.closeTicketButton.addEventListener('click', () => this.handleCloseTicket());
        }
    }

    // ИЗМЕНЕНИЕ 3: Функция для обновления UI в зависимости от статуса тикета
    updateTicketUI() {
        if (this.isTicketClosed) {
            this.messageTextarea.disabled = true;
            this.messageTextarea.placeholder = 'Тикет закрыт. Отправка сообщений недоступна.';
            this.sendMessageButton.disabled = true;
            this.sendMessageButton.textContent = 'Тикет закрыт';
            if (this.closeTicketButton) {
                this.closeTicketButton.disabled = true;
                this.closeTicketButton.textContent = 'Закрыто';
            }
        } else {
            this.messageTextarea.disabled = false;
            this.messageTextarea.placeholder = 'Введите ваше сообщение...';
            this.sendMessageButton.disabled = false;
            this.sendMessageButton.textContent = 'Отправить';
            if (this.closeTicketButton) {
                this.closeTicketButton.disabled = false;
                this.closeTicketButton.textContent = 'Закрыть тикет';
            }
        }
    }

    // ИЗМЕНЕНИЕ 3: Функция для закрытия тикета
    async handleCloseTicket() {
        if (!confirm('Вы уверены, что хотите закрыть этот тикет? Вы больше не сможете отправлять сообщения.')) {
            return;
        }

        this.closeTicketButton.disabled = true;
        this.closeTicketButton.textContent = 'Закрытие...';

        try {
            const { error } = await this.authManager.supabase
                .from('tickets')
                .update({ is_closed: true })
                .eq('id', this.ticketId)
                .eq('user_id', this.user.id);

            if (error) throw error;

            this.isTicketClosed = true;
            this.updateTicketUI();
            alert('Тикет успешно закрыт.');

        } catch (error) {
            alert('Ошибка при закрытии тикета: ' + error.message);
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
                // ИЗМЕНЕНИЕ 2: Удалена проверка payload.new.user_id !== this.user.id
                // Теперь сообщения пользователя также будут добавляться через подписку
                this.addMessageToBox(payload.new);
                this.scrollToBottom();
            })
            .subscribe();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new TicketPage(authManager);
});
