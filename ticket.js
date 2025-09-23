class TicketPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.user = null;
        this.ticketId = new URLSearchParams(window.location.search).get('id');
        this.isCurrentUserAdmin = false;
        this.participants = new Map();
        
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
        const { data: profile } = await this.authManager.supabase
            .from('profiles')
            .select('role')
            .eq('id', this.user.id)
            .single();
        
        if (profile) {
            this.isCurrentUserAdmin = profile.role === 'Администратор';
        }

        let ticketQuery = this.authManager.supabase
            .from('tickets')
            .select('user_id, is_closed')
            .eq('id', this.ticketId);

        if (!this.isCurrentUserAdmin) {
            ticketQuery = ticketQuery.eq('user_id', this.user.id);
        }

        const { data: ticketData, error: ticketError } = await ticketQuery.single();

        if (ticketError || !ticketData) {
            this.chatBox.innerHTML = '<p class="error-message">Не удалось найти тикет или у вас нет к нему доступа.</p>';
            this.messageForm.style.display = 'none';
            this.closeTicketButton.style.display = 'none';
            return;
        }

        this.ticketTitle.textContent = `Тикет #${this.ticketId}`;
        this.isTicketClosed = ticketData.is_closed;
        this.updateTicketUI();

        // ИСПРАВЛЕННЫЙ ЗАПРОС К СООБЩЕНИЯМ
        const { data: messages, error: messagesError } = await this.authManager.supabase
            .from('messages')
            .select(`
                content, 
                created_at, 
                user_id,
                profiles ( username ) 
            `)
            .eq('ticket_id', this.ticketId)
            .order('created_at');

        if (messagesError) {
             this.chatBox.innerHTML = `<p class="error-message">Не удалось загрузить сообщения. Ошибка: ${messagesError.message}</p>`;
             return;
        }

        this.chatBox.innerHTML = '';
        for (const msg of messages) {
            await this.addMessageToBox(msg, msg.profiles);
        }
        this.scrollToBottom();
    }

    async addMessageToBox(message, profile) {
        let authorProfile = this.participants.get(message.user_id);

        if (!authorProfile) {
            authorProfile = profile || { username: 'Пользователь' };
            this.participants.set(message.user_id, authorProfile);
        }
        
        const { data: { user } } = await this.authManager.supabase.auth.getUserById(message.user_id);
        const authorAvatarUrl = user?.user_metadata?.avatar_url;
        const authorName = authorProfile.username || user?.user_metadata?.full_name || 'Пользователь';

        const isUserMessage = message.user_id === this.user.id;
        
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${isUserMessage ? 'user' : 'admin'}`;
        
        const date = new Date(message.created_at).toLocaleString('ru-RU');
        
        const avatarHTML = authorAvatarUrl
            ? `<img src="${authorAvatarUrl}" alt="Аватар">`
            : `<div class="message-avatar-placeholder">${authorName.charAt(0).toUpperCase()}</div>`;

        wrapper.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">${avatarHTML}</div>
                <div class="message-author">${authorName}</div>
            </div>
            <div class="message">
                <p>${message.content}</p>
                <span>${date}</span>
            </div>
        `;
        this.chatBox.appendChild(wrapper);
    }
    
    scrollToBottom() {
        this.chatBox.scrollTop = this.chatBox.scrollHeight;
    }

    setupEventListeners() {
        document.body.addEventListener('click', (e) => {
            if (e.target.closest('.logout-btn')) {
                this.authManager.signOut();
            }
        });

        this.messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = this.messageTextarea.value.trim();
            if (!content || this.isTicketClosed) return;

            this.sendMessageButton.disabled = true;

            try {
                await this.authManager.supabase
                    .from('messages')
                    .insert({ ticket_id: this.ticketId, user_id: this.user.id, content: content });
                
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
                .eq('id', this.ticketId);

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
        const canClose = this.isCurrentUserAdmin || !this.isTicketClosed;
        this.closeTicketButton.style.display = canClose ? 'inline-flex' : 'none';

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
            }, async (payload) => {
                await this.addMessageToBox(payload.new);
                this.scrollToBottom();
            })
            .subscribe();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new TicketPage(authManager);
});
