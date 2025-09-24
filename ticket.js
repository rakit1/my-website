class TicketPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.supabase = authManager.supabase;
        this.user = null;
        
        // Получаем ID тикета и убеждаемся, что это UUID
        const urlParams = new URLSearchParams(window.location.search);
        const ticketIdParam = urlParams.get('id');
        
        // Если ID это число, преобразуем в UUID формат (если нужно)
        this.ticketId = this.normalizeTicketId(ticketIdParam);
        
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

    // Функция для нормализации ID тикета
    normalizeTicketId(ticketId) {
        if (!ticketId) return null;
        
        // Если это число, возможно нужно преобразовать в UUID формат
        // Или просто вернуть как есть, если ваша база использует текстовые ID
        return ticketId;
    }

    async init() {
        if (!this.ticketId) {
            window.location.href = 'account.html';
            return;
        }
        
        console.log('Loading ticket with ID:', this.ticketId, 'Type:', typeof this.ticketId);
        
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
            console.log('Starting to load ticket data for ID:', this.ticketId);

            // Сначала проверяем существование тикета
            const { data: ticketData, error: ticketError } = await this.supabase
                .from('tickets')
                .select('id, user_id, is_closed')
                .eq('id', this.ticketId)
                .single();
                
            if (ticketError) {
                console.error('Ticket error:', ticketError);
                throw new Error("Тикет не найден или у вас нет к нему доступа.");
            }

            console.log('Ticket found:', ticketData);

            // Проверяем роль пользователя
            const { data: userProfile, error: profileError } = await this.supabase
                .from('profiles')
                .select('username, avatar_url, role')
                .eq('id', this.user.id)
                .single();
                
            if (profileError) {
                console.error('Profile error:', profileError);
                throw new Error("Не удалось загрузить профиль пользователя.");
            }

            this.isCurrentUserAdmin = userProfile?.role === 'Администратор';
            console.log('User is admin:', this.isCurrentUserAdmin);

            // Проверяем права доступа
            if (!this.isCurrentUserAdmin && ticketData.user_id !== this.user.id) {
                throw new Error("У вас нет доступа к этому тикету.");
            }

            this.isTicketClosed = ticketData.is_closed;
            console.log('Ticket closed status:', this.isTicketClosed);

            // Используем RPC функцию для получения сообщений
            console.log('Calling RPC function with ticket ID:', this.ticketId);
            const { data: messages, error: messagesError } = await this.supabase
                .rpc('get_accessible_ticket_messages', { 
                    p_ticket_id: this.ticketId 
                });

            if (messagesError) {
                console.error('RPC Error details:', messagesError);
                throw new Error("Не удалось загрузить сообщения: " + messagesError.message);
            }

            console.log('Messages loaded:', messages);

            // Сохраняем информацию об авторах
            if (messages && messages.length > 0) {
                messages.forEach(msg => {
                    this.participants.set(msg.user_id, {
                        username: msg.author_username,
                        avatar_url: msg.author_avatar_url,
                        role: msg.author_role
                    });
                });
            }

            // Добавляем текущего пользователя в участники если его нет
            if (!this.participants.has(this.user.id)) {
                this.participants.set(this.user.id, {
                    username: userProfile?.username || 'Пользователь',
                    avatar_url: userProfile?.avatar_url || null,
                    role: userProfile?.role || 'Игрок'
                });
            }

            this.ticketTitle.textContent = `Тикет #${this.ticketId}`;
            this.updateTicketUI();

            // Отображаем сообщения
            this.chatBox.innerHTML = '';
            if (messages && messages.length > 0) {
                messages.forEach(msg => this.addMessageToBox(msg));
            } else {
                this.chatBox.innerHTML = '<div class="no-messages">Сообщений пока нет</div>';
            }
            this.scrollToBottom();

        } catch (error) {
            console.error('Load initial data error:', error);
            this.showError(error.message);
        }
    }

    subscribeToUpdates() {
        try {
            // Канал для обновлений сообщений
            const channelName = `ticket_chat:${this.ticketId}`;
            
            this.channel = this.supabase.channel(channelName);

            // Слушаем новые сообщения через broadcast
            this.channel.on('broadcast', { event: 'new_message' }, async ({ payload }) => {
                try {
                    const newMessage = payload.new;
                    console.log('New message received:', newMessage);
                    
                    // Проверяем доступ к сообщению через прямой запрос
                    const { data: messageWithAccess, error } = await this.supabase
                        .from('messages')
                        .select('*')
                        .eq('id', newMessage.id)
                        .eq('ticket_id', this.ticketId)
                        .single();

                    if (!error && messageWithAccess) {
                        // Загружаем профиль автора если нужно
                        if (!this.participants.has(newMessage.user_id)) {
                            const { data: profile } = await this.supabase
                                .from('profiles')
                                .select('username, avatar_url, role')
                                .eq('id', newMessage.user_id)
                                .single();
                            
                            if (profile) {
                                this.participants.set(newMessage.user_id, profile);
                            }
                        }
                        
                        this.addMessageToBox(newMessage);
                        this.scrollToBottom();
                    }
                } catch (error) {
                    console.error('Error processing new message:', error);
                }
            }).subscribe();

            // Слушаем обновления статуса тикета
            this.supabase.channel(`ticket-status-${this.ticketId}`)
                .on('postgres_changes', {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'tickets',
                    filter: `id=eq.${this.ticketId}`
                }, (payload) => {
                    if (payload.new.is_closed) {
                        this.isTicketClosed = true;
                        this.updateTicketUI();
                    }
                }).subscribe();

            console.log('Subscribed to updates for ticket:', this.ticketId);

        } catch (error) {
            console.error('Error subscribing to updates:', error);
        }
    }

    // Остальные методы остаются без изменений
    async handleSubmit(event) {
        event.preventDefault();
        const content = this.messageForm.elements.message.value.trim();
        
        if (!content || this.isTicketClosed) return;

        this.sendMessageButton.disabled = true;

        try {
            // Вставляем новое сообщение
            const { data: newMessage, error } = await this.supabase
                .from('messages')
                .insert({
                    ticket_id: this.ticketId,
                    user_id: this.user.id,
                    content: content
                })
                .select()
                .single();

            if (error) throw error;
            
            // Отправляем уведомление в канал
            if (this.channel) {
                await this.channel.send({
                    type: 'broadcast',
                    event: 'new_message',
                    payload: { new: newMessage },
                });
            }

            this.messageForm.reset();
        } catch (error) {
            console.error('Send message error:', error);
            alert('Ошибка отправки сообщения: ' + error.message);
        } finally {
            this.sendMessageButton.disabled = false;
            this.messageTextarea.focus();
        }
    }

    addMessageToBox(message) {
        if (document.querySelector(`[data-message-id="${message.id}"]`)) return;
        
        const authorProfile = this.participants.get(message.user_id) || { 
            username: 'Пользователь', 
            avatar_url: null, 
            role: 'Игрок' 
        };
        
        const isUserMessage = message.user_id === this.user.id;
        const isAdmin = authorProfile.role === 'Администратор';
        
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${isUserMessage ? 'user' : 'admin'}`;
        wrapper.dataset.messageId = message.id;
        
        const date = new Date(message.created_at).toLocaleString('ru-RU');
        const avatarHTML = authorProfile.avatar_url 
            ? `<img src="${authorProfile.avatar_url}" alt="Аватар" class="message-avatar-img">` 
            : `<div class="message-avatar-placeholder">${(authorProfile.username || 'U').charAt(0).toUpperCase()}</div>`;
        
        const authorClass = isAdmin ? 'message-author admin-role' : 'message-author';
        
        const messageHeader = document.createElement('div');
        messageHeader.className = 'message-header';
        messageHeader.innerHTML = `
            <div class="message-avatar">${avatarHTML}</div>
            <div class="${authorClass}">${authorProfile.username || 'Пользователь'}</div>
        `;
        
        const messageBody = document.createElement('div');
        messageBody.className = 'message';
        
        const messageContent = document.createElement('p');
        messageContent.textContent = message.content;
        
        const messageTimestamp = document.createElement('span');
        messageTimestamp.className = 'message-time';
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
        if (this.channel) {
            this.supabase.removeChannel(this.channel);
        }
    }

    async executeTicketClosure() {
        this.confirmCloseBtn.disabled = true;
        
        try {
            const { error } = await this.supabase
                .from('tickets')
                .update({ is_closed: true })
                .eq('id', this.ticketId);
                
            if (error) throw error;
            
            this.confirmationModal.classList.remove('active');
        } catch (error) {
            console.error('Close ticket error:', error);
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
        setTimeout(() => {
            this.chatBox.scrollTop = this.chatBox.scrollHeight;
        }, 100);
    }

    showError(message) {
        this.chatBox.innerHTML = `<div class="error-message">${message}</div>`;
        this.messageForm.style.display = 'none';
        this.closeTicketButton.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    const ticketPage = new TicketPage(authManager);
    
    window.addEventListener('beforeunload', () => {
        if (ticketPage.destroy) {
            ticketPage.destroy();
        }
    });
});
