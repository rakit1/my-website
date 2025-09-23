class TicketPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.supabase = authManager.supabase;
        this.user = null;
        this.ticketId = new URLSearchParams(window.location.search).get('id');
        this.isCurrentUserAdmin = false;
        this.isTicketClosed = false;
        this.channel = null;
        this.pendingMessages = new Map(); // Для отслеживания временных сообщений

        this.participants = new Map();

        // Элементы DOM
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
        console.log('🚀 Инициализация страницы тикета...');
        
        if (!this.ticketId) {
            window.location.href = 'account.html';
            return;
        }

        const { data: { user } } = await this.supabase.auth.getUser();
        
        if (user) {
            this.user = user;
            await this.loadInitialData();
            this.setupEventListeners();
            await this.subscribeToRealtimeMessages();
        } else {
            window.location.href = 'index.html';
        }
    }

    async loadInitialData() {
        try {
            // Загружаем профиль пользователя
            const { data: profile } = await this.supabase
                .from('profiles')
                .select('role, username, avatar_url')
                .eq('id', this.user.id)
                .single();
            
            if (profile) {
                this.isCurrentUserAdmin = profile.role === 'Администратор';
                this.participants.set(this.user.id, profile);
            }

            // Проверяем доступ к тикету
            const { data: ticketData, error: ticketError } = await this.supabase
                .from('tickets')
                .select('user_id, is_closed')
                .eq('id', this.ticketId)
                .single();

            if (ticketError || (!this.isCurrentUserAdmin && ticketData.user_id !== this.user.id)) {
                throw new Error("Не удалось найти тикет или у вас нет к нему доступа.");
            }
            
            this.isTicketClosed = ticketData.is_closed;
            this.ticketTitle.textContent = `Тикет #${this.ticketId}`;
            this.updateTicketUI();

            // Загружаем сообщения
            const { data: messages, error: messagesError } = await this.supabase
                .from('messages')
                .select(`*, profiles(username, avatar_url, role)`)
                .eq('ticket_id', this.ticketId)
                .order('created_at');

            if (messagesError) throw messagesError;
            
            messages.forEach(msg => {
                if (msg.profiles && !this.participants.has(msg.user_id)) {
                    this.participants.set(msg.user_id, msg.profiles);
                }
            });

            // Отображаем сообщения
            this.chatBox.innerHTML = '';
            messages.forEach(msg => this.addMessageToBox(msg));
            this.scrollToBottom();

        } catch (error) {
            this.showError(error.message);
        }
    }

    addMessageToBox(message, isTemporary = false) {
        // Проверка на дубликаты
        if (message.id && document.querySelector(`[data-message-id="${message.id}"]`)) {
            return;
        }

        // Если это временное сообщение, проверяем не отображается ли уже
        if (isTemporary && document.querySelector(`[data-temp-id="${message.tempId}"]`)) {
            return;
        }

        const authorProfile = this.participants.get(message.user_id) || { 
            username: 'Пользователь', 
            avatar_url: null, 
            role: 'Игрок' 
        };

        const isUserMessage = message.user_id === this.user.id;
        const isAdmin = authorProfile.role === 'Администратор';
        const messageId = message.id || `temp_${message.tempId}`;

        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${isUserMessage ? 'user' : 'admin'}`;
        wrapper.dataset.messageId = messageId;
        if (isTemporary) {
            wrapper.dataset.tempId = message.tempId;
        }
        
        const date = new Date(message.created_at || new Date()).toLocaleString('ru-RU');
        
        const avatarHTML = authorProfile.avatar_url
            ? `<img src="${authorProfile.avatar_url}" alt="Аватар">`
            : `<div class="message-avatar-placeholder">${authorProfile.username.charAt(0).toUpperCase()}</div>`;

        const authorClass = isAdmin ? 'message-author admin-role' : 'message-author';

        wrapper.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">${avatarHTML}</div>
                <div class="${authorClass}">${authorProfile.username}</div>
                ${isTemporary ? '<span class="sending-indicator">⏳ Отправляется...</span>' : ''}
            </div>
            <div class="message">
                <p>${message.content}</p>
                <span>${date}</span>
            </div>
        `;

        this.chatBox.appendChild(wrapper);
        this.scrollToBottom();
    }

    setupEventListeners() {
        this.messageForm.addEventListener('submit', async (e) => {
            await this.handleMessageSubmit(e);
        });

        this.closeTicketButton.addEventListener('click', () => {
            if (!this.isTicketClosed) this.confirmationModal.classList.add('active');
        });

        this.cancelCloseBtn.addEventListener('click', () => {
            this.confirmationModal.classList.remove('active');
        });

        this.confirmCloseBtn.addEventListener('click', () => this.executeTicketClosure());
    }

    async handleMessageSubmit(e) {
        e.preventDefault();
        const content = this.messageTextarea.value.trim();
        if (!content || this.isTicketClosed) return;

        // Создаем временное сообщение
        const tempId = Date.now();
        const tempMessage = {
            tempId: tempId,
            user_id: this.user.id,
            ticket_id: this.ticketId,
            content: content,
            created_at: new Date().toISOString()
        };

        // Сохраняем оригинальный текст
        const originalContent = content;
        this.messageTextarea.value = '';
        this.sendMessageButton.disabled = true;

        // Показываем временное сообщение
        this.addMessageToBox(tempMessage, true);
        this.pendingMessages.set(tempId, tempMessage);

        try {
            // Отправляем на сервер
            const { data: newMessage, error } = await this.supabase
                .from('messages')
                .insert({ 
                    ticket_id: this.ticketId, 
                    user_id: this.user.id, 
                    content: originalContent 
                })
                .select()
                .single();

            if (error) throw error;

            console.log('✅ Сообщение отправлено, ID:', newMessage.id);

            // Real-time само заменит временное сообщение, но на всякий случай:
            // Удаляем временное сообщение через 5 секунд, если real-time не сработал
            setTimeout(() => {
                const tempElement = document.querySelector(`[data-temp-id="${tempId}"]`);
                if (tempElement && !document.querySelector(`[data-message-id="${newMessage.id}"]`)) {
                    tempElement.remove();
                    // Добавляем сообщение вручную
                    this.addMessageToBox(newMessage);
                }
            }, 5000);

        } catch (error) {
            console.error('❌ Ошибка отправки:', error);
            
            // Показываем ошибку в временном сообщении
            const tempElement = document.querySelector(`[data-temp-id="${tempId}"]`);
            if (tempElement) {
                const indicator = tempElement.querySelector('.sending-indicator');
                if (indicator) {
                    indicator.textContent = '❌ Ошибка отправки';
                    indicator.style.color = '#ff4444';
                }
            }
            
            // Восстанавливаем текст
            this.messageTextarea.value = originalContent;
        } finally {
            this.sendMessageButton.disabled = false;
            this.messageTextarea.focus();
        }
    }

    async subscribeToRealtimeMessages() {
        try {
            if (this.channel) {
                this.supabase.removeChannel(this.channel);
            }

            console.log('🔔 Подписка на real-time...');

            this.channel = this.supabase.channel(`ticket:${this.ticketId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `ticket_id=eq.${this.ticketId}`
                    },
                    async (payload) => {
                        console.log('📨 Real-time сообщение:', payload.new);

                        // Для своих сообщений: удаляем временное и добавляем настоящее
                        if (payload.new.user_id === this.user.id) {
                            // Ищем временное сообщение по содержанию
                            const tempElements = document.querySelectorAll('[data-temp-id]');
                            for (const tempElement of tempElements) {
                                const messageText = tempElement.querySelector('.message p').textContent;
                                if (messageText === payload.new.content) {
                                    tempElement.remove();
                                    break;
                                }
                            }
                        }

                        // Загружаем профиль если нужно
                        if (!this.participants.has(payload.new.user_id)) {
                            const { data: profile } = await this.supabase
                                .from('profiles')
                                .select('username, avatar_url, role')
                                .eq('id', payload.new.user_id)
                                .single();
                            
                            if (profile) {
                                this.participants.set(payload.new.user_id, profile);
                            }
                        }

                        // Добавляем сообщение
                        this.addMessageToBox(payload.new);
                    }
                )
                .subscribe((status) => {
                    console.log('📡 Статус подписки:', status);
                });

        } catch (error) {
            console.error('❌ Ошибка real-time:', error);
        }
    }

    async executeTicketClosure() {
        this.confirmCloseBtn.disabled = true;
        this.confirmCloseBtn.textContent = 'Закрытие...';
        
        try {
            const { error } = await this.supabase
                .from('tickets')
                .update({ is_closed: true })
                .eq('id', this.ticketId);

            if (error) throw error;

            this.isTicketClosed = true;
            this.updateTicketUI();
            this.confirmationModal.classList.remove('active');

        } catch (error) {
            alert('Ошибка при закрытии тикета: ' + error.message);
        } finally {
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

    scrollToBottom() {
        setTimeout(() => {
            this.chatBox.scrollTop = this.chatBox.scrollHeight;
        }, 100);
    }

    showError(message) {
        this.chatBox.innerHTML = `<p class="error-message">${message}</p>`;
        this.messageForm.style.display = 'none';
        this.closeTicketButton.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new TicketPage(authManager);
});
