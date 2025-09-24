class TicketPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.db = authManager.db;
        this.user = null;
        this.ticketId = new URLSearchParams(window.location.search).get('id');
        this.isCurrentUserAdmin = false;
        this.isTicketClosed = false;
        this.unsubscribeMessages = null;
        this.unsubscribeTicket = null;

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

    init() {
        if (!this.ticketId) {
            window.location.href = 'account.html';
            return;
        }
        
        this.authManager.auth.onAuthStateChanged(user => {
            if (user && this.authManager.user) {
                this.user = this.authManager.user;
                this.isCurrentUserAdmin = this.user.role === 'Администратор';
                this.loadInitialData();
                this.setupEventListeners();
            } else if (!user) {
                window.location.href = 'index.html';
            }
        });

        window.addEventListener('beforeunload', () => this.destroy());
    }

    async loadInitialData() {
        try {
            const ticketRef = firebase.firestore().collection('tickets').doc(this.ticketId);
            const ticketDoc = await ticketRef.get();

            if (!ticketDoc.exists) throw new Error("Тикет не найден.");

            const ticketData = ticketDoc.data();
            
            if (!this.isCurrentUserAdmin && ticketData.user_id !== this.user.uid) {
                throw new Error("У вас нет доступа к этому тикету.");
            }
            
            this.ticketTitle.textContent = `Тикет #${this.ticketId}`;
            
            const currentUserProfile = await firebase.firestore().collection('profiles').doc(this.user.uid).get();
            if (currentUserProfile.exists) {
                this.participants.set(this.user.uid, currentUserProfile.data());
            }

            this.subscribeToUpdates();

        } catch (error) {
            this.showError(error.message);
        }
    }
    
    subscribeToUpdates() {
        const ticketRef = firebase.firestore().collection('tickets').doc(this.ticketId);
        this.unsubscribeTicket = ticketRef.onSnapshot(doc => {
            const ticketData = doc.data();
            if (ticketData && ticketData.is_closed !== this.isTicketClosed) {
                this.isTicketClosed = ticketData.is_closed;
                this.updateTicketUI();
            }
        });

        const messagesRef = firebase.firestore().collection('messages');
        const query = messagesRef.where('ticket_id', '==', this.ticketId).orderBy('created_at');
        
        this.chatBox.innerHTML = '';

        this.unsubscribeMessages = query.onSnapshot(async snapshot => {
            const changes = snapshot.docChanges();
            const newParticipantIds = [...new Set(changes
                .map(change => change.doc.data().user_id)
                .filter(id => !this.participants.has(id)))];
            
            if (newParticipantIds.length > 0) {
                 const profilesSnapshot = await firebase.firestore().collection('profiles').where(firebase.firestore.FieldPath.documentId(), 'in', newParticipantIds).get();
                 profilesSnapshot.docs.forEach(doc => this.participants.set(doc.id, doc.data()));
            }

            changes.forEach(change => {
                if (change.type === "added") {
                    this.addMessageToBox(change.doc.id, change.doc.data());
                }
            });
            this.scrollToBottom();
        }, error => {
            console.error("Ошибка real-time подписки на сообщения:", error);
            this.showError("Не удалось загрузить сообщения.");
        });
    }

    async handleSubmit(event) {
        event.preventDefault();
        const content = this.messageForm.elements.message.value.trim();
        if (!content || this.isTicketClosed) return;

        this.sendMessageButton.disabled = true;
        try {
            await firebase.firestore().collection('messages').add({
                ticket_id: this.ticketId,
                user_id: this.user.uid,
                content: content,
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.messageForm.reset();
        } catch (error) {
            alert('Ошибка отправки сообщения: ' + error.message);
        } finally {
            this.sendMessageButton.disabled = false;
            this.messageTextarea.focus();
        }
    }
    
    addMessageToBox(messageId, message) {
        if (document.querySelector(`[data-message-id="${messageId}"]`)) return;
        
        const authorProfile = this.participants.get(message.user_id) || { username: 'Пользователь', avatar_url: null, role: 'Игрок' };
        const isUserMessage = message.user_id === this.user.uid;
        const isAdmin = authorProfile.role === 'Администратор';

        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${isUserMessage ? 'user' : 'admin'}`;
        wrapper.dataset.messageId = messageId;
        
        const date = message.created_at ? new Date(message.created_at.toDate()).toLocaleString('ru-RU') : 'отправка...';
        
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
        if (this.unsubscribeMessages) this.unsubscribeMessages();
        if (this.unsubscribeTicket) this.unsubscribeTicket();
    }

    async executeTicketClosure() {
        this.confirmCloseBtn.disabled = true;
        try {
            const ticketRef = firebase.firestore().collection('tickets').doc(this.ticketId);
            await ticketRef.update({ is_closed: true });
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
    new TicketPage(authManager);
});

