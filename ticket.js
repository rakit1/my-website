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
        if (!this.ticketId) return window.location.href = 'account.html';
        document.addEventListener('userStateReady', (event) => {
            const user = event.detail;
            if (user) {
                this.user = user;
                this.isCurrentUserAdmin = this.user.role === 'Администратор';
                this.run();
            } else {
                window.location.href = 'index.html';
            }
        });
        window.addEventListener('beforeunload', () => this.destroy());
    }

    run() {
        this.loadInitialData();
        this.setupEventListeners();
    }

    async loadInitialData() {
        try {
            const ticketDoc = await this.db.collection('tickets').doc(this.ticketId).get();
            if (!ticketDoc.exists) throw new Error("Тикет не найден.");
            const ticketData = ticketDoc.data();
            if (!this.isCurrentUserAdmin && ticketData.user_id !== this.user.uid) throw new Error("У вас нет доступа к этому тикету.");
            this.ticketTitle.textContent = `Тикет #${this.ticketId}`;
            const currentUserProfile = await this.db.collection('profiles').doc(this.user.uid).get();
            if (currentUserProfile.exists) this.participants.set(this.user.uid, currentUserProfile.data());
            this.subscribeToUpdates();
        } catch (error) {
            this.showError(error.message);
        }
    }
    
    subscribeToUpdates() {
        this.unsubscribeTicket = this.db.collection('tickets').doc(this.ticketId).onSnapshot(doc => {
            const ticketData = doc.data();
            if (ticketData && ticketData.is_closed !== this.isTicketClosed) {
                this.isTicketClosed = ticketData.is_closed;
                this.updateTicketUI();
            }
        });
        this.chatBox.innerHTML = '';
        this.unsubscribeMessages = this.db.collection('messages').where('ticket_id', '==', this.ticketId).orderBy('created_at')
            .onSnapshot(async snapshot => {
                const changes = snapshot.docChanges();
                const newParticipantIds = [...new Set(changes.map(c => c.doc.data().user_id).filter(id => !this.participants.has(id)))];
                if (newParticipantIds.length > 0) {
                     const profilesSnapshot = await this.db.collection('profiles').where(firebase.firestore.FieldPath.documentId(), 'in', newParticipantIds).get();
                     profilesSnapshot.docs.forEach(doc => this.participants.set(doc.id, doc.data()));
                }
                changes.forEach(change => {
                    if (change.type === "added") this.addMessageToBox(change.doc.id, change.doc.data());
                });
                this.scrollToBottom();
            });
    }

    async handleSubmit(event) {
        event.preventDefault();
        const content = this.messageForm.elements.message.value.trim();
        if (!content || this.isTicketClosed) return;
        this.sendMessageButton.disabled = true;
        try {
            await this.db.collection('messages').add({
                ticket_id: this.ticketId,
                user_id: this.user.uid,
                content,
                created_at: firebase.firestore.FieldValue.serverTimestamp()
            });
            this.messageForm.reset();
        } catch (error) {
            alert('Ошибка отправки: ' + error.message);
        } finally {
            this.sendMessageButton.disabled = false;
        }
    }
    
    addMessageToBox(messageId, message) {
        if (document.querySelector(`[data-message-id="${messageId}"]`)) return;
        const author = this.participants.get(message.user_id) || {};
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${message.user_id === this.user.uid ? 'user' : 'admin'}`;
        wrapper.dataset.messageId = messageId;
        // ИСПРАВЛЕНИЕ: Добавлена проверка на существование даты
        const date = message.created_at ? new Date(message.created_at.toDate()).toLocaleString('ru-RU') : 'отправка...';
        const avatarHTML = author.avatar_url ? `<img src="${author.avatar_url}" alt="Аватар">` : `<div class="message-avatar-placeholder">${(author.username || 'U').charAt(0).toUpperCase()}</div>`;
        wrapper.innerHTML = `<div class="message-header"><div class="message-avatar">${avatarHTML}</div><div class="message-author ${author.role === 'Администратор' ? 'admin-role' : ''}">${author.username || 'Пользователь'}</div></div><div class="message"><p>${message.content}</p><span>${date}</span></div>`;
        this.chatBox.appendChild(wrapper);
    }
    
    setupEventListeners() {
        this.messageForm.addEventListener('submit', (e) => this.handleSubmit(e));
        this.closeTicketButton.addEventListener('click', () => { if (!this.isTicketClosed) this.confirmationModal.classList.add('active'); });
        this.cancelCloseBtn.addEventListener('click', () => this.confirmationModal.classList.remove('active'));
        this.confirmCloseBtn.addEventListener('click', () => this.executeTicketClosure());
    }

    destroy() {
        if (this.unsubscribeMessages) this.unsubscribeMessages();
        if (this.unsubscribeTicket) this.unsubscribeTicket();
    }

    async executeTicketClosure() {
        this.confirmCloseBtn.disabled = true;
        try {
            await this.db.collection('tickets').doc(this.ticketId).update({ is_closed: true });
            this.confirmationModal.classList.remove('active');
        } catch (error) {
            alert('Ошибка при закрытии тикета: ' + error.message);
        } finally {
            this.confirmCloseBtn.disabled = false;
        }
    }
    
    updateTicketUI() {
        this.closeTicketButton.style.display = this.isCurrentUserAdmin ? 'inline-flex' : 'none';
        if (this.isTicketClosed) {
            this.messageTextarea.disabled = true;
            this.messageTextarea.placeholder = 'Тикет закрыт.';
            this.sendMessageButton.disabled = true;
            this.closeTicketButton.disabled = true;
            this.closeTicketButton.textContent = 'Тикет закрыт';
            this.destroy();
        }
    }
    
    scrollToBottom() { this.chatBox.scrollTop = this.chatBox.scrollHeight; }
    showError(message) { this.chatBox.innerHTML = `<p class="error-message">${message}</p>`; this.messageForm.style.display = 'none'; this.closeTicketButton.style.display = 'none'; }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new TicketPage(authManager);
});
