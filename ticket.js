class TicketPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.supabase = authManager.supabase;
        this.user = null;
        this.ticketId = new URLSearchParams(window.location.search).get('id');
        this.isCurrentUserAdmin = false;
        this.isTicketClosed = false;
        this.channel = null;

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

        this.init();
    }

    async init() {
        if (!this.ticketId) {
            window.location.href = 'account.html';
            return;
        }
        const { data: { user } } = await this.supabase.auth.getUser();
        if (user) {
            this.user = user;
            await this.loadInitialData(); // Сначала загружаем данные
            this.setupEventListeners();
            this.subscribeToUpdates(); // Потом подписываемся на обновления
        } else {
            window.location.href = 'index.html';
        }
    }

    // Загрузка данных остается такой же, как в прошлый раз (через два запроса)
    async loadInitialData() {
        try {
            const { data: ticketData, error: ticketError } = await this.supabase
                .from('tickets').select('user_id, is_closed').eq('id', this.ticketId).single();
            if (ticketError) throw new Error("Не удалось найти тикет или у вас нет к нему доступа.");

            const { data: messages, error: messagesError } = await this.supabase
                .from('messages').select('*').eq('ticket_id', this.ticketId).order('created_at');
            if (messagesError) throw messagesError;

            const authorIds = [...new Set(messages.map(msg => msg.user_id))];
            if (!authorIds.includes(this.user.id)) authorIds.push(this.user.id);

            if (authorIds.length > 0) {
                const { data: profiles, error: profilesError } = await this.supabase
                    .from('profiles').select('id, username, avatar_url, role').in('id', authorIds);
                if (profilesError) throw profilesError;
                profiles.forEach(p => this.participants.set(p.id, p));
            }

            const currentUserProfile = this.participants.get(this.user.id);
            this.isCurrentUserAdmin = currentUserProfile?.role === 'Администратор';

            if (!this.isCurrentUserAdmin && ticketData.user_id !== this.user.id) {
                throw new Error("У вас нет доступа к этому тикету.");
            }

            this.isTicketClosed = ticketData.is_closed;
            this.ticketTitle.textContent = `Тикет #${this.ticketId}`;
            this.updateTicketUI();

            this.chatBox.innerHTML = '';
            messages.forEach(msg => this.addMessageToBox(msg));
            this.scrollToBottom();

        } catch (error) {
            this.showError(error.message);
        }
    }
    
    // --- ГЛАВНОЕ ИЗМЕНЕНИЕ ЗДЕСЬ ---
    subscribeToUpdates() {
        // Мы больше не слушаем `postgres_changes`. Вместо этого мы создаем свой собственный канал.
        // Имя канала уникально для каждого тикета, например 'ticket_chat:4'
        const channelName = `ticket_chat:${this.ticketId}`;
        
        this.channel = this.supabase.channel(channelName);

        // Теперь мы слушаем событие 'new_message', которое будет принудительно отправлено нашим триггером из базы данных.
        this.channel.on('broadcast', { event: 'new_message' }, async ({ payload }) => {
            const newMessage = payload.new;
            
            // Если мы не знаем автора, догружаем его профиль
            if (!this.participants.has(newMessage.user_id)) {
                const { data: profile } = await this.supabase.from('profiles').select('username, avatar_url, role').eq('id', newMessage.user_id).single();
                if (profile) this.participants.set(newMessage.user_id, profile);
            }
            
            this.addMessageToBox(newMessage);
            this.scrollToBottom();
        }).subscribe();

        // Также оставляем подписку на обновление самого тикета (на случай закрытия)
        this.supabase.channel(`ticket-status-${this.ticketId}`)
            .on('postgres_changes', {
                event: 'UPDATE', schema: 'public', table: 'tickets', filter: `id=eq.${this.ticketId}`
            }, (payload) => {
                if (payload.new.is_closed) {
                    this.isTicketClosed = true;
                    this.updateTicketUI();
                }
            }).subscribe();
    }

    // Функция отправки сообщения теперь тоже должна отправлять уведомление
    async handleSubmit(event) {
        event.preventDefault();
        const content = this.messageForm.elements.message.value.trim();
        if (!content || this.isTicketClosed) return;

        this.sendMessageButton.disabled = true;

        try {
            // Сначала вставляем сообщение в базу
            const { data: newMessage, error } = await this.supabase
                .from('messages')
                .insert({ ticket_id: this.ticketId, user_id: this.user.id, content })
                .select()
                .single();

            if (error) throw error;
            
            // Теперь отправляем уведомление по нашему каналу
            await this.channel.send({
                type: 'broadcast',
                event: 'new_message',
                payload: { new: newMessage },
            });

            this.messageForm.reset();
        } catch (error) {
            alert('Ошибка отправки сообщения: ' + error.message);
        } finally {
            this.sendMessageButton.disabled = false;
            this.messageTextarea.focus();
        }
    }
    
    // Остальной код остается без изменений...
    addMessageToBox(message) {
        if (document.querySelector(`[data-message-id="${message.id}"]`)) return;
        const authorProfile = this.participants.get(message.user_id) || { username: 'Пользователь', avatar_url: null, role: 'Игрок' };
        const isUserMessage = message.user_id === this.user.id;
        const isAdmin = authorProfile.role === 'Администратор';
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${isUserMessage ? 'user' : 'admin'}`;
        wrapper.dataset.messageId = message.id;
        const date = new Date(message.created_at).toLocaleString('ru-RU');
        const avatarHTML = authorProfile.avatar_url 
            ? `<img src="${authorProfile.avatar_url}" alt="Аватар">` 
            : `<div class="message-avatar-placeholder">${(authorProfile.username || 'U').charAt(0).toUpperCase()}</div>`;
        const authorClass = isAdmin ? 'message-author admin-role' : 'message-author';
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        messageHeader.innerHTML = `<div class="message-avatar">${avatarHTML}</div><div class="${authorClass}">${authorProfile.username || 'Пользователь'}</div>`;
        const messageBody = document.createElement('div');
        messageBody.className = 'message';
        const messageContent = document.createElement('p');
        messageContent.textContent = message.content;
        const messageTimestamp = document.createElement('span');
        messageTimestamp.textContent = date;
        messageBody.appendChild(messageContent);
        messageBody.appendChild(messageTimestamp);
        wrapper.appendChild(messageHeader);
        wrapper.appendChild(messageBody);
        this.chatBox.appendChild(wrapper);
    }
    setupEventListeners() {
        this.messageForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.closeTicketButton.addEventListener('click', () => {
            if (!this.isTicketClosed) this.confirmationModal.classList.add('active');
        });
        this.cancelCloseBtn.addEventListener('click', () => {
            this.confirmationModal.classList.remove('active');
        });
        this.confirmCloseBtn.addEventListener('click', () => this.executeTicketClosure());
    }
    destroy() {
        if (this.channel) this.supabase.removeChannel(this.channel);
        const statusChannel = this.supabase.channel(`ticket-status-${this.ticketId}`);
        if (statusChannel) this.supabase.removeChannel(statusChannel);
    }
    async executeTicketClosure() {
        this.confirmCloseBtn.disabled = true;
        try {
            const { error } = await this.supabase.from('tickets').update({ is_closed: true }).eq('id', this.ticketId);
            if (error) throw error;
            this.confirmationModal.classList.remove('active');
        } catch (error) {
            alert('Ошибка при закрытии тикета: ' + error.message);
        } finally {
            this.confirmCloseBtn.disabled = false;
        }
    }
    updateTicketUI() {
        if (this.isCurrentUserAdmin) {
            this.closeTicketButton.style.display = 'inline-flex';
        } else {
            this.closeTicketButton.style.display = 'none';
        }
        if (this.isTicketClosed) {
            this.messageTextarea.disabled = true;
            this.messageTextarea.placeholder = 'Тикет закрыт. Отправка сообщений недоступна.';
            this.sendMessageButton.disabled = true;
            this.closeTicketButton.disabled = true;
            this.closeTicketButton.textContent = 'Тикет закрыт';
            this.destroy();
        }
    }
    scrollToBottom() {
        this.chatBox.scrollTop = this.chatBox.scrollHeight;
    }
    showError(message) {
        this.chatBox.innerHTML = `<p class="error-message">${message}</p>`;
        this.messageForm.style.display = 'none';
        this.closeTicketButton.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    const ticketPage = new TicketPage(authManager);
    window.addEventListener('beforeunload', () => ticketPage.destroy());
});
