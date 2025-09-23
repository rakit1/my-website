class TicketPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.supabase = authManager.supabase;
        this.user = null;
        this.ticketId = new URLSearchParams(window.location.search).get('id');
        this.isCurrentUserAdmin = false;
        this.isTicketClosed = false;
        this.pollingInterval = null;

        // Кэш для данных пользователей, чтобы не делать лишних запросов
        this.participants = new Map();

        // Поиск элементов на странице
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
     * Главная функция, запускающая всю логику страницы.
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
            this.startPolling(); // ← Запускаем опрос каждые 2 секунды
        } else {
            window.location.href = 'index.html';
        }
    }

    /**
     * Загружает начальные данные: информацию о тикете, сообщения и профили.
     */
    async loadInitialData() {
        try {
            // 1. Получаем профиль текущего пользователя (чтобы узнать, админ ли он)
            const { data: profile } = await this.supabase
                .from('profiles')
                .select('role, username, avatar_url')
                .eq('id', this.user.id)
                .single();
            
            if (profile) {
                this.isCurrentUserAdmin = profile.role === 'Администратор';
                this.participants.set(this.user.id, profile);
            }

            // 2. Получаем данные о тикете и проверяем, есть ли у пользователя доступ
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

            // 3. Загружаем все сообщения и данные их авторов
            const { data: messages, error: messagesError } = await this.supabase
                .from('messages')
                .select(`*, profiles(username, avatar_url, role)`)
                .eq('ticket_id', this.ticketId)
                .order('created_at');

            if (messagesError) throw messagesError;
            
            // Сохраняем данные авторов в кэш
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
            this.showError(error.message);
        }
    }

    /**
     * Отображает одно сообщение в чате.
     */
    addMessageToBox(message) {
        // Защита от дублирования сообщений
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
     * Настраивает обработчики событий для кнопок и форм.
     */
    setupEventListeners() {
        this.messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const content = this.messageTextarea.value.trim();
            if (!content || this.isTicketClosed) return;

            this.sendMessageButton.disabled = true;

            try {
                // Отправляем сообщение и сразу получаем его обратно
                const { data: newMessage, error } = await this.supabase
                    .from('messages')
                    .insert({ ticket_id: this.ticketId, user_id: this.user.id, content: content })
                    .select()
                    .single();

                if (error) throw error;
                
                // Сразу отображаем своё сообщение
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

        // Обработчики для модального окна закрытия тикета
        this.closeTicketButton.addEventListener('click', () => {
            if (!this.isTicketClosed) this.confirmationModal.classList.add('active');
        });
        this.cancelCloseBtn.addEventListener('click', () => {
            this.confirmationModal.classList.remove('active');
        });
        this.confirmCloseBtn.addEventListener('click', () => this.executeTicketClosure());
    }

    /**
     * Запускает опрос новых сообщений каждые 2 секунды
     */
    startPolling() {
        this.pollingInterval = setInterval(async () => {
            try {
                // Находим ID последнего сообщения на экране
                const lastMessageElement = this.chatBox.lastElementChild;
                const lastMessageId = lastMessageElement ? lastMessageElement.dataset.messageId : null;

                // Запрашиваем сообщения, которые новее последнего
                const query = this.supabase
                    .from('messages')
                    .select(`*, profiles(username, avatar_url, role)`)
                    .eq('ticket_id', this.ticketId)
                    .order('created_at', { ascending: true });

                if (lastMessageId) {
                    query.gt('id', lastMessageId); // Только сообщения новее последнего
                }

                const { data: newMessages, error } = await query;

                if (error) throw error;

                if (newMessages && newMessages.length > 0) {
                    newMessages.forEach(msg => {
                        if (msg.profiles && !this.participants.has(msg.user_id)) {
                            this.participants.set(msg.user_id, msg.profiles);
                        }
                        this.addMessageToBox(msg);
                    });
                    this.scrollToBottom();
                }
            } catch (error) {
                console.error("Ошибка при загрузке новых сообщений:", error.message);
            }
        }, 2000); // Каждые 2 секунды
    }

    /**
     * Останавливает опрос при уходе со страницы
     */
    destroy() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }
    }

    /**
     * Закрывает тикет.
     */
    async executeTicketClosure() {
        this.confirmCloseBtn.disabled = true;
        try {
            const { error } = await this.supabase.from('tickets').update({ is_closed: true }).eq('id', this.ticketId);
            if (error) throw error;

            this.isTicketClosed = true;
            this.updateTicketUI();
            this.confirmationModal.classList.remove('active');
        } catch (error) {
            alert('Ошибка при закрытии тикета: ' + error.message);
        } finally {
            this.confirmCloseBtn.disabled = false;
        }
    }

    /**
     * Обновляет интерфейс в зависимости от статуса тикета (открыт/закрыт).
     */
    updateTicketUI() {
        if (this.isTicketClosed) {
            this.messageTextarea.disabled = true;
            this.messageTextarea.placeholder = 'Тикет закрыт. Отправка сообщений недоступна.';
            this.sendMessageButton.disabled = true;
            this.closeTicketButton.disabled = true;
            this.closeTicketButton.textContent = 'Тикет закрыт';
        }
    }

    /**
     * Прокручивает чат в самый низ.
     */
    scrollToBottom() {
        this.chatBox.scrollTop = this.chatBox.scrollHeight;
    }

    /**
     * Показывает ошибку на странице, если что-то пошло не так.
     */
    showError(message) {
        this.chatBox.innerHTML = `<p class="error-message">${message}</p>`;
        this.messageForm.style.display = 'none';
        this.closeTicketButton.style.display = 'none';
    }
}

// Запускаем все, когда страница загрузится
document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    const ticketPage = new TicketPage(authManager);

    // Останавливаем polling, когда пользователь уходит со страницы
    window.addEventListener('beforeunload', () => ticketPage.destroy());
});
