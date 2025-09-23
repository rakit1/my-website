class TicketPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.supabase = authManager.supabase;
        this.user = null;
        this.ticketId = new URLSearchParams(window.location.search).get('id');
        this.isCurrentUserAdmin = false;
        this.isTicketClosed = false;
        this.channel = null;

        // Кэш для данных пользователей (чтобы не запрашивать одно и то же)
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
        if (!this.ticketId) {
            window.location.href = 'account.html';
            return;
        }

        const { data: { user } } = await this.supabase.auth.getUser();

        if (user) {
            this.user = user;
            await this.loadInitialData();
            this.setupEventListeners();
            this.subscribeToRealtimeMessages();
        } else {
            window.location.href = 'index.html';
        }
    }

    /**
     * Загружает все необходимые данные при открытии страницы:
     * информацию о тикете, сообщения и данные пользователей.
     */
    async loadInitialData() {
        try {
            // 1. Получаем профиль текущего пользователя и проверяем, админ ли он
            const { data: profile } = await this.supabase
                .from('profiles')
                .select('role, username, avatar_url')
                .eq('id', this.user.id)
                .single();
            
            if (profile) {
                this.isCurrentUserAdmin = profile.role === 'Администратор';
                this.participants.set(this.user.id, profile);
            }

            // 2. Получаем данные о самом тикете (и проверяем доступ)
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

            // 3. Загружаем все сообщения и профили их авторов
            const { data: messages, error: messagesError } = await this.supabase
                .from('messages')
                .select(`*, profiles(username, avatar_url, role)`)
                .eq('ticket_id', this.ticketId)
                .order('created_at');

            if (messagesError) throw messagesError;
            
            // Кэшируем данные авторов, чтобы не делать лишних запросов
            messages.forEach(msg => {
                if (msg.profiles && !this.participants.has(msg.user_id)) {
                    this.participants.set(msg.user_id, msg.profiles);
                }
            });

            // 4. Отображаем сообщения в чате
            this.chatBox.innerHTML = '';
            messages.forEach(msg => this.addMessageToBox(msg));
            this.scrollToBottom();

        } catch (error) {
            this.chatBox.innerHTML = `<p class="error-message">${error.message}</p>`;
            this.messageForm.style.display = 'none';
            this.closeTicketButton.style.display = 'none';
        }
    }

    /**
     * Отображает одно сообщение в окне чата.
     * @param {object} message - Объект сообщения из Supabase.
     */
    addMessageToBox(message) {
        // Проверка, чтобы не дублировать сообщения от Realtime
        if (document.querySelector(`[data-message-id="${message.id}"]`)) {
            return;
        }

        const authorProfile = this.participants.get(message.user_id) || { username: 'Пользователь', avatar_url: null, role: 'Игрок' };
        const isUserMessage = message.user_id === this.user.id;
        const isAdmin = authorProfile.role === 'Администратор';

        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${isUserMessage ? 'user' : 'admin'}`;
        wrapper.dataset.messageId = message.id;
        
        const date = new Date(message.created_at).toLocaleString('ru-RU');
        
        const avatarHTML = authorProfile.avatar_url
            ? `<img src="${authorProfile.avatar_url}" alt="Аватар">`
            : `<div class="message-avatar-placeholder">${authorProfile.username.charAt(0).toUpperCase()}</div>`;

        const authorClass = isAdmin ? 'message-author admin-role' : 'message-author';

        wrapper.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">${avatarHTML}</div>
                <div class="${authorClass}">${authorProfile.username}</div>
            </div>
            <div class="message">
                <p>${message.content}</p>
                <span>${date}</span>
            </div>
        `;
        this.chatBox.appendChild(wrapper);
    }
    
    /**
     * Настраивает все обработчики событий (отправка, закрытие тикета).
     */
    setupEventListeners() {
        // --- ГЛАВНОЕ ИСПРАВЛЕНИЕ ---
        // Обработчик отправки формы
        this.messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = this.messageTextarea.value.trim();
            if (!content || this.isTicketClosed) return;

            this.sendMessageButton.disabled = true;

            try {
                // Отправляем сообщение и сразу просим вернуть его с помощью .select().single()
                const { data: newMessage, error } = await this.supabase
                    .from('messages')
                    .insert({ ticket_id: this.ticketId, user_id: this.user.id, content: content })
                    .select()
                    .single();

                if (error) throw error;
                
                // Не ждем Realtime, а сразу же отображаем свое сообщение
                this.addMessageToBox(newMessage);
                this.scrollToBottom();
                this.messageForm.reset();

            } catch (error) {
                alert('Ошибка отправки сообщения: ' + error.message);
            } finally {
                this.sendMessageButton.disabled = false;
                this.messageTextarea.focus();
            }
        });

        // Обработчики для закрытия тикета
        this.closeTicketButton.addEventListener('click', () => {
            if (!this.isTicketClosed) this.confirmationModal.classList.add('active');
        });

        this.cancelCloseBtn.addEventListener('click', () => {
            this.confirmationModal.classList.remove('active');
        });

        this.confirmCloseBtn.addEventListener('click', () => this.executeTicketClosure());
    }

    /**
     * Подписывается на события Realtime для получения новых сообщений.
     */
    subscribeToRealtimeMessages() {
        if (this.channel) {
            this.supabase.removeChannel(this.channel);
        }

        this.channel = this.supabase.channel(`messages_ticket_${this.ticketId}`);
        
        this.channel.on(
            'postgres_changes', 
            { event: 'INSERT', schema: 'public', table: 'messages', filter: `ticket_id=eq.${this.ticketId}`},
            async (payload) => {
                // Если пришло сообщение от другого пользователя, его данных у нас может не быть
                if (!this.participants.has(payload.new.user_id)) {
                    const { data: profile } = await this.supabase.from('profiles').select('username, avatar_url, role').eq('id', payload.new.user_id).single();
                    if (profile) {
                        this.participants.set(payload.new.user_id, profile);
                    }
                }
                this.addMessageToBox(payload.new);
                this.scrollToBottom();
            }
        ).subscribe((status, err) => {
            if (status === 'SUBSCRIBED') {
                console.log('Успешная подписка на обновления чата!');
            } else if (err) {
                console.error('Ошибка подписки на Realtime:', err);
            }
        });
    }

    /**
     * Выполняет закрытие тикета.
     */
    async executeTicketClosure() {
        this.confirmCloseBtn.disabled = true;
        this.confirmCloseBtn.textContent = 'Закрытие...';
        try {
            const { error } = await this.supabase.from('tickets').update({ is_closed: true }).eq('id', this.ticketId);
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

    /**
     * Обновляет интерфейс (кнопки, поля ввода) в зависимости от статуса тикета.
     */
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

    /**
     * Прокручивает чат в самый низ.
     */
    scrollToBottom() {
        this.chatBox.scrollTop = this.chatBox.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new TicketPage(authManager);
});
