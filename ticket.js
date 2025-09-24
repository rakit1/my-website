class TicketPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.supabase = authManager.supabase;
        this.user = null;
        this.ticketId = new URLSearchParams(window.location.search).get('id');
        this.isCurrentUserAdmin = false;
        this.isTicketClosed = false;
        this.channel = null;

        // Здесь мы будем хранить загруженные профили участников: { 'user_id': { username: '...', avatar_url: '...' } }
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
            await this.loadInitialData();
            this.setupEventListeners();
            this.subscribeToUpdates();
        } else {
            window.location.href = 'index.html';
        }
    }

    async loadInitialData() {
        try {
            const { data: ticketData, error: ticketError } = await this.supabase
                .from('tickets')
                .select('user_id, is_closed')
                .eq('id', this.ticketId)
                .single();

            if (ticketError) throw new Error("Не удалось найти тикет или у вас нет к нему доступа.");

            // --- НОВЫЙ, НАДЕЖНЫЙ МЕТОД ЗАГРУЗКИ ДАННЫХ ---

            // Шаг 1: Сначала получаем ТОЛЬКО сообщения, без всяких связей. Этот запрос не может сломаться.
            const { data: messages, error: messagesError } = await this.supabase
                .from('messages')
                .select('*')
                .eq('ticket_id', this.ticketId)
                .order('created_at');

            if (messagesError) throw messagesError;

            // Шаг 2: Собираем ID всех уникальных авторов из сообщений.
            const authorIds = [...new Set(messages.map(msg => msg.user_id))];
            // Добавляем ID текущего пользователя, чтобы его профиль тоже загрузился.
            if (!authorIds.includes(this.user.id)) {
                authorIds.push(this.user.id);
            }

            // Шаг 3: Одним запросом получаем все нужные профили.
            if (authorIds.length > 0) {
                const { data: profiles, error: profilesError } = await this.supabase
                    .from('profiles')
                    .select('id, username, avatar_url, role')
                    .in('id', authorIds);

                if (profilesError) throw profilesError;

                // Заполняем нашу карту участников для быстрого доступа к данным профиля.
                profiles.forEach(p => this.participants.set(p.id, p));
            }
            
            // --- КОНЕЦ НОВОГО МЕТОДА ---

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

    addMessageToBox(message) {
        if (document.querySelector(`[data-message-id="${message.id}"]`)) return;
        
        // Теперь мы просто берем профиль из уже загруженных данных.
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
        this.messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = this.messageTextarea.value.trim();
            if (!content || this.isTicketClosed) return;

            this.sendMessageButton.disabled = true;

            try {
                const { error } = await this.supabase
                    .from('messages')
                    .insert({ ticket_id: this.ticketId, user_id: this.user.id, content: content });

                if (error) throw error;
                this.messageForm.reset();
            } catch (error) {
                alert('Ошибка отправки сообщения: ' + error.message);
            } finally {
                this.sendMessageButton.disabled = false;
                this.messageTextarea.focus();
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

    subscribeToUpdates() {
        this.channel = this.supabase.channel(`ticket-updates-${this.ticketId}`)
            .on('postgres_changes', { 
                event: 'INSERT', 
                schema: 'public', 
                table: 'messages', 
                filter: `ticket_id=eq.${this.ticketId}` 
            }, async (payload) => {
                const newMessage = payload.new;
                // Если профиля нового автора еще нет, догружаем его.
                if (!this.participants.has(newMessage.user_id)) {
                    const { data: profile } = await this.supabase.from('profiles').select('username, avatar_url, role').eq('id', newMessage.user_id).single();
                    if (profile) this.participants.set(newMessage.user_id, profile);
                }
                
                this.addMessageToBox(newMessage);
                this.scrollToBottom();
            })
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'tickets',
                filter: `id=eq.${this.ticketId}`
            }, (payload) => {
                const updatedTicket = payload.new;
                if (updatedTicket.is_closed && !this.isTicketClosed) {
                    this.isTicketClosed = true;
                    this.updateTicketUI();
                }
            })
            .subscribe();
    }

    destroy() {
        if (this.channel) this.supabase.removeChannel(this.channel);
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
