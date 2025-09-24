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
            await this.loadInitialData();
            this.setupEventListeners();
            this.subscribeToUpdates();
        } else {
            window.location.href = 'index.html';
        }
    }

    async loadInitialData() {
        try {
            // Сначала проверяем доступ к тикету и получаем информацию о тикете
            const { data: ticketData, error: ticketError } = await this.supabase
                .from('tickets')
                .select('user_id, is_closed')
                .eq('id', this.ticketId)
                .single();
                
            if (ticketError) {
                throw new Error("Тикет не найден или у вас нет к нему доступа.");
            }

            // Проверяем роль пользователя
            const { data: userProfile, error: profileError } = await this.supabase
                .from('profiles')
                .select('role')
                .eq('id', this.user.id)
                .single();
                
            if (profileError) {
                console.error('Profile error:', profileError);
                throw new Error("Не удалось загрузить профиль пользователя.");
            }

            this.isCurrentUserAdmin = userProfile?.role === 'Администратор';

            // Проверяем права доступа
            if (!this.isCurrentUserAdmin && ticketData.user_id !== this.user.id) {
                throw new Error("У вас нет доступа к этому тикету.");
            }

            this.isTicketClosed = ticketData.is_closed;

            // Используем RPC функцию для получения сообщений
            const { data: messages, error: messagesError } = await this.supabase
                .rpc('get_accessible_ticket_messages', { 
                    p_ticket_id: this.ticketId 
                });

            if (messagesError) {
                console.error('RPC Error:', messagesError);
                throw new Error("Не удалось загрузить сообщения.");
            }

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
            }
            this.scrollToBottom();

        } catch (error) {
            this.showError(error.message);
        }
    }

    subscribeToUpdates() {
        // Канал для обновлений сообщений
        const channelName = `ticket_chat:${this.ticketId}`;
        
        this.channel = this.supabase.channel(channelName);

        // Слушаем новые сообщения через broadcast
        this.channel.on('broadcast', { event: 'new_message' }, async ({ payload }) => {
            try {
                const newMessage = payload.new;
                
                // Проверяем доступ к сообщению через RPC функцию
                const { data: accessibleMessages } = await this.supabase
                    .rpc('get_accessible_ticket_messages', { 
                        p_ticket_id: this.ticketId 
                    })
                    .eq('id', newMessage.id);

                if (accessibleMessages && accessibleMessages.length > 0) {
                    // Если есть доступ, отображаем сообщение
                    const messageData = accessibleMessages[0];
                    
                    if (!this.participants.has(messageData.user_id)) {
                        this.participants.set(messageData.user_id, {
                            username: messageData.author_username,
                            avatar_url: messageData.author_avatar_url,
                            role: messageData.author_role
                        });
                    }
                    
                    this.addMessageToBox(messageData);
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
    }

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
        // Проверяем, не отображается ли сообщение уже
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
        
        const statusChannel = this.supabase.channel(`ticket-status-${this.ticketId}`);
        if (statusChannel) {
            this.supabase.removeChannel(statusChannel);
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
        // Показываем кнопку закрытия только администраторам
        if (this.isCurrentUserAdmin) {
            this.closeTicketButton.style.display = 'inline-flex';
        } else {
            this.closeTicketButton.style.display = 'none';
        }
        
        // Обновляем UI если тикет закрыт
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

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    const ticketPage = new TicketPage(authManager);
    
    window.addEventListener('beforeunload', () => {
        if (ticketPage.destroy) {
            ticketPage.destroy();
        }
    });
});
