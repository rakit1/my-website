class TicketPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.supabase = authManager.supabase;
        this.user = null;
        this.ticketId = new URLSearchParams(window.location.search).get('id');
        this.isCurrentUserAdmin = false;
        this.isTicketClosed = false;
        this.channel = null;
        this.isSubscribed = false;

        // Кэш для данных пользователей
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

    /**
     * Главная функция инициализации страницы
     */
    async init() {
        console.log('🚀 Инициализация страницы тикета...');
        
        if (!this.ticketId) {
            console.error('❌ ID тикета не найден в URL');
            window.location.href = 'account.html';
            return;
        }

        try {
            const { data: { user }, error: authError } = await this.supabase.auth.getUser();
            
            if (authError) throw authError;
            
            if (user) {
                this.user = user;
                console.log('✅ Пользователь авторизован:', user.email);
                await this.loadInitialData();
                this.setupEventListeners();
                await this.subscribeToRealtimeMessages();
            } else {
                console.warn('⚠️ Пользователь не авторизован, перенаправление...');
                window.location.href = 'index.html';
            }
        } catch (error) {
            console.error('❌ Ошибка инициализации:', error);
            this.showError('Ошибка загрузки страницы');
        }
    }

    /**
     * Загружает начальные данные тикета
     */
    async loadInitialData() {
        try {
            console.log('📥 Загрузка данных тикета...');

            // 1. Загружаем профиль пользователя
            const { data: profile, error: profileError } = await this.supabase
                .from('profiles')
                .select('role, username, avatar_url')
                .eq('id', this.user.id)
                .single();

            if (profileError) throw profileError;
            
            if (profile) {
                this.isCurrentUserAdmin = profile.role === 'Администратор';
                this.participants.set(this.user.id, profile);
                console.log('✅ Профиль загружен, роль:', profile.role);
            }

            // 2. Проверяем доступ к тикету
            const { data: ticketData, error: ticketError } = await this.supabase
                .from('tickets')
                .select('user_id, is_closed, title')
                .eq('id', this.ticketId)
                .single();

            if (ticketError) throw ticketError;
            
            // Проверка прав доступа
            if (!this.isCurrentUserAdmin && ticketData.user_id !== this.user.id) {
                throw new Error("У вас нет доступа к этому тикету");
            }
            
            this.isTicketClosed = ticketData.is_closed;
            this.ticketTitle.textContent = ticketData.title || `Тикет #${this.ticketId}`;
            this.updateTicketUI();

            // 3. Загружаем сообщения
            const { data: messages, error: messagesError } = await this.supabase
                .from('messages')
                .select(`
                    *,
                    profiles (
                        username,
                        avatar_url,
                        role
                    )
                `)
                .eq('ticket_id', this.ticketId)
                .order('created_at', { ascending: true });

            if (messagesError) throw messagesError;
            
            // Кэшируем участников чата
            messages.forEach(msg => {
                if (msg.profiles && !this.participants.has(msg.user_id)) {
                    this.participants.set(msg.user_id, msg.profiles);
                }
            });

            // 4. Отображаем сообщения
            this.renderMessages(messages);
            console.log(`✅ Загружено ${messages.length} сообщений`);

        } catch (error) {
            console.error('❌ Ошибка загрузки данных:', error);
            this.showError(error.message);
        }
    }

    /**
     * Отображает список сообщений
     */
    renderMessages(messages) {
        this.chatBox.innerHTML = '';
        messages.forEach(msg => this.addMessageToBox(msg, false));
        this.scrollToBottom();
    }

    /**
     * Добавляет сообщение в чат
     */
    addMessageToBox(message, isRealtime = false) {
        // Проверяем, не отображается ли сообщение уже
        if (message.id && document.querySelector(`[data-message-id="${message.id}"]`)) {
            if (isRealtime) console.log('⚠️ Сообщение уже отображено, пропускаем:', message.id);
            return;
        }

        const authorProfile = this.participants.get(message.user_id) || { 
            username: 'Неизвестный', 
            avatar_url: null, 
            role: 'Игрок' 
        };

        const isUserMessage = message.user_id === this.user.id;
        const isAdmin = authorProfile.role === 'Администратор';
        const messageId = message.id || `temp_${Date.now()}`;

        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${isUserMessage ? 'user' : 'other'} ${isRealtime ? 'realtime' : ''}`;
        wrapper.dataset.messageId = messageId;
        
        const date = new Date(message.created_at || new Date()).toLocaleString('ru-RU');
        
        const avatarHTML = authorProfile.avatar_url
            ? `<img src="${authorProfile.avatar_url}" alt="Аватар ${authorProfile.username}" class="message-avatar-img">`
            : `<div class="message-avatar-placeholder">${authorProfile.username.charAt(0).toUpperCase()}</div>`;

        wrapper.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">${avatarHTML}</div>
                <div class="message-author ${isAdmin ? 'admin-role' : ''}">
                    ${authorProfile.username}
                    ${isUserMessage ? ' (Вы)' : ''}
                </div>
                ${!message.id ? '<span class="message-status sending">⏳ Отправляется...</span>' : ''}
            </div>
            <div class="message-content">
                <p>${this.escapeHtml(message.content)}</p>
                <span class="message-time">${date}</span>
            </div>
        `;

        this.chatBox.appendChild(wrapper);
        
        if (isRealtime) {
            wrapper.classList.add('new-message');
            setTimeout(() => wrapper.classList.remove('new-message'), 500);
        }
        
        this.scrollToBottom();
    }

    /**
     * Экранирование HTML для безопасности
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Настройка обработчиков событий
     */
    setupEventListeners() {
        // Отправка сообщения
        this.messageForm.addEventListener('submit', (e) => this.handleMessageSubmit(e));

        // Закрытие тикета
        this.closeTicketButton.addEventListener('click', () => {
            if (!this.isTicketClosed) this.confirmationModal.classList.add('active');
        });

        this.cancelCloseBtn.addEventListener('click', () => {
            this.confirmationModal.classList.remove('active');
        });

        this.confirmCloseBtn.addEventListener('click', () => this.executeTicketClosure());

        // Автоматическое увеличение текстового поля
        this.messageTextarea.addEventListener('input', () => {
            this.messageTextarea.style.height = 'auto';
            this.messageTextarea.style.height = Math.min(this.messageTextarea.scrollHeight, 120) + 'px';
        });
    }

    /**
     * Обработка отправки сообщения
     */
    async handleMessageSubmit(e) {
        e.preventDefault();
        
        const content = this.messageTextarea.value.trim();
        if (!content || this.isTicketClosed) return;

        // Создаем временное сообщение для мгновенного отображения
        const tempMessage = {
            user_id: this.user.id,
            ticket_id: this.ticketId,
            content: content,
            created_at: new Date().toISOString()
        };

        // Сохраняем оригинальный текст и очищаем поле
        const originalContent = content;
        this.messageTextarea.value = '';
        this.messageTextarea.style.height = 'auto';
        this.sendMessageButton.disabled = true;

        // Сразу показываем сообщение
        this.addMessageToBox(tempMessage, false);

        try {
            // Отправляем на сервер
            const { data: newMessage, error } = await this.supabase
                .from('messages')
                .insert({ 
                    ticket_id: this.ticketId, 
                    user_id: this.user.id, 
                    content: originalContent 
                })
                .select(`
                    *,
                    profiles (
                        username,
                        avatar_url,
                        role
                    )
                `)
                .single();

            if (error) throw error;

            // Обновляем кэш участников
            if (newMessage.profiles) {
                this.participants.set(newMessage.user_id, newMessage.profiles);
            }

            console.log('✅ Сообщение отправлено:', newMessage.id);

            // Удаляем временное сообщение (настоящее придет через realtime)
            const tempElement = document.querySelector(`[data-message-id="temp_${tempMessage.created_at}"]`);
            if (tempElement) {
                tempElement.remove();
            }

        } catch (error) {
            console.error('❌ Ошибка отправки:', error);
            
            // Восстанавливаем текст в поле ввода
            this.messageTextarea.value = originalContent;
            
            // Помечаем сообщение как ошибочное
            const tempElement = document.querySelector(`[data-message-id="temp_${tempMessage.created_at}"]`);
            if (tempElement) {
                tempElement.querySelector('.message-status').textContent = '❌ Ошибка отправки';
                tempElement.querySelector('.message-status').classList.add('error');
            }
            
            alert('Ошибка отправки сообщения: ' + error.message);
        } finally {
            this.sendMessageButton.disabled = false;
            this.messageTextarea.focus();
        }
    }

    /**
     * Подписка на real-time обновления
     */
    async subscribeToRealtimeMessages() {
        try {
            // Отписываемся от предыдущей подписки
            if (this.channel) {
                this.supabase.removeChannel(this.channel);
            }

            console.log('🔔 Подписка на real-time обновления...');

            this.channel = this.supabase
                .channel(`ticket:${this.ticketId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'messages',
                        filter: `ticket_id=eq.${this.ticketId}`
                    },
                    async (payload) => {
                        console.log('📨 Получено real-time сообщение:', payload.new);
                        
                        // Пропускаем свои сообщения (они уже отображены)
                        if (payload.new.user_id === this.user.id) {
                            console.log('➡️ Пропускаем свое сообщение');
                            return;
                        }

                        // Загружаем профиль отправителя если его нет в кэше
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

                        // Добавляем сообщение в чат
                        this.addMessageToBox(payload.new, true);
                    }
                )
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'tickets',
                        filter: `id=eq.${this.ticketId}`
                    },
                    (payload) => {
                        console.log('🔄 Обновление статуса тикета:', payload.new);
                        this.isTicketClosed = payload.new.is_closed;
                        this.updateTicketUI();
                    }
                )
                .subscribe((status) => {
                    console.log('📡 Статус подписки:', status);
                    this.isSubscribed = status === 'SUBSCRIBED';
                    
                    if (status === 'SUBSCRIBED') {
                        console.log('✅ Успешно подписались на обновления');
                    } else if (status === 'CHANNEL_ERROR') {
                        console.error('❌ Ошибка канала');
                    } else if (status === 'TIMED_OUT') {
                        console.warn('⚠️ Таймаут подключения');
                    }
                });

        } catch (error) {
            console.error('❌ Ошибка подписки на real-time:', error);
        }
    }

    /**
     * Закрытие тикета
     */
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
            
            console.log('✅ Тикет закрыт');

        } catch (error) {
            console.error('❌ Ошибка закрытия тикета:', error);
            alert('Ошибка при закрытии тикета: ' + error.message);
        } finally {
            this.confirmCloseBtn.disabled = false;
            this.confirmCloseBtn.textContent = 'Закрыть тикет';
        }
    }

    /**
     * Обновление интерфейса
     */
    updateTicketUI() {
        const isDisabled = this.isTicketClosed;
        
        this.messageTextarea.disabled = isDisabled;
        this.messageTextarea.placeholder = isDisabled 
            ? 'Тикет закрыт. Отправка сообщений недоступна.' 
            : 'Введите ваше сообщение...';
        
        this.sendMessageButton.disabled = isDisabled;
        this.closeTicketButton.disabled = isDisabled;
        this.closeTicketButton.textContent = isDisabled ? 'Тикет закрыт' : 'Закрыть тикет';

        if (isDisabled) {
            this.messageForm.classList.add('disabled');
        } else {
            this.messageForm.classList.remove('disabled');
        }
    }

    /**
     * Прокрутка чата вниз
     */
    scrollToBottom() {
        setTimeout(() => {
            this.chatBox.scrollTop = this.chatBox.scrollHeight;
        }, 100);
    }

    /**
     * Показать ошибку
     */
    showError(message) {
        this.chatBox.innerHTML = `
            <div class="error-message">
                <h3>Ошибка</h3>
                <p>${message}</p>
                <button onclick="window.history.back()">Назад</button>
            </div>
        `;
        this.messageForm.style.display = 'none';
        this.closeTicketButton.style.display = 'none';
    }

    /**
     * Очистка ресурсов
     */
    destroy() {
        if (this.channel) {
            this.supabase.removeChannel(this.channel);
            console.log('🧹 Канал real-time очищен');
        }
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    try {
        const authManager = new AuthManager();
        window.ticketPage = new TicketPage(authManager);
        
        // Очистка при закрытии страницы
        window.addEventListener('beforeunload', () => {
            if (window.ticketPage) {
                window.ticketPage.destroy();
            }
        });
    } catch (error) {
        console.error('❌ Ошибка инициализации приложения:', error);
    }
});
