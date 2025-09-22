class TicketPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.user = null;
        this.ticketId = new URLSearchParams(window.location.search).get('id');
        
        this.chatBox = document.getElementById('chat-box');
        this.messageForm = document.getElementById('message-form');
        this.ticketTitle = document.getElementById('ticket-title');

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
            this.loadInitialData();
            this.setupEventListeners();
            this.subscribeToMessages();
        } else {
            window.location.href = 'index.html';
        }
    }
    
    async loadInitialData() {
        // Загружаем основную информацию о тикете
        const { data: ticketData, error: ticketError } = await this.authManager.supabase
            .from('tickets')
            .select('description, created_at')
            .eq('id', this.ticketId)
            .eq('user_id', this.user.id) // Проверка, что тикет принадлежит пользователю
            .single();

        if (ticketError || !ticketData) {
            this.chatBox.innerHTML = '<p class="error-message">Не удалось найти тикет или у вас нет к нему доступа.</p>';
            this.messageForm.style.display = 'none';
            return;
        }

        this.ticketTitle.textContent = `Тикет #${this.ticketId}`;
        
        // Загружаем сообщения
        const { data: messages, error: messagesError } = await this.authManager.supabase
            .from('messages')
            .select('content, created_at, user_id')
            .eq('ticket_id', this.ticketId)
            .order('created_at');

        if (messagesError) {
             this.chatBox.innerHTML = '<p class="error-message">Не удалось загрузить сообщения.</p>';
             return;
        }
        
        // Отображаем первоначальное сообщение тикета и последующие сообщения
        this.chatBox.innerHTML = ''; // Очищаем скелетоны
        this.addMessageToBox({
            content: ticketData.description,
            created_at: ticketData.created_at,
            user_id: this.user.id // Первое сообщение всегда от пользователя
        });

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
            const content = this.messageForm.elements.message.value.trim();
            if (!content) return;

            const submitButton = this.messageForm.querySelector('button');
            submitButton.disabled = true;

            const { error } = await this.authManager.supabase
                .from('messages')
                .insert({
                    ticket_id: this.ticketId,
                    user_id: this.user.id,
                    content: content
                });

            if (error) {
                alert('Ошибка отправки сообщения: ' + error.message);
            } else {
                this.messageForm.reset();
            }
            submitButton.disabled = false;
        });
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
                // Добавляем сообщение только если оно еще не на странице
                // Это предотвратит дублирование при отправке своего же сообщения
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
