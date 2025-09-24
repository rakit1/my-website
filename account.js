class AccountPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.db = authManager.db;
        this.user = null;
        this.profileCard = document.getElementById('user-profile-card');
        this.ticketsList = document.getElementById('tickets-list');
        this.adminPanelSection = document.getElementById('admin-panel-section');
        this.unsubscribe = null;
        this.init();
    }

    init() {
        this.authManager.auth.onAuthStateChanged(user => {
            if (user && this.authManager.user) {
                this.user = this.authManager.user;
                this.displayUserProfile();
                this.fetchAndDisplayTickets();
            } else if (!user) {
                window.location.href = 'index.html';
            }
        });
        window.addEventListener('beforeunload', () => {
            if (this.unsubscribe) this.unsubscribe();
        });
    }

    displayUserProfile() {
        if (!this.user || !this.profileCard) return;
        const { username, email, avatar_url, role = 'Игрок' } = this.user;
        const roleClass = role === 'Администратор' ? 'administrator' : 'player';
        this.profileCard.innerHTML = `<div class="profile-avatar">${avatar_url ? `<img src="${avatar_url}" alt="Аватар">` : username.charAt(0).toUpperCase()}</div><h1 class="profile-name">${username}</h1><span class="user-role ${roleClass}">${role}</span><p class="profile-email">${email}</p>`;
        if (role === 'Администратор') {
            this.displayAdminButton();
            this.subscribeToTicketCount();
        }
    }
    
    displayAdminButton() {
        this.adminPanelSection.innerHTML = `<a href="admin.html" class="admin-panel-button">Отвечать на тикеты<span class="ticket-count">...</span></a>`;
    }

    subscribeToTicketCount() {
        const ticketCountElement = document.querySelector('.ticket-count');
        if (!ticketCountElement) return;
        this.unsubscribe = this.db.collection('tickets').where('is_closed', '==', false)
            .onSnapshot(snapshot => {
                ticketCountElement.textContent = snapshot.size;
            }, error => {
                console.error("Ошибка real-time:", error);
                ticketCountElement.textContent = 'X';
            });
    }

    async fetchAndDisplayTickets() {
        if (!this.user || !this.ticketsList) return;
        try {
            const snapshot = await this.db.collection('tickets').where('user_id', '==', this.user.uid).orderBy('created_at', 'desc').get();
            if (!snapshot.empty) {
                this.ticketsList.innerHTML = snapshot.docs.map(doc => {
                    const ticket = doc.data();
                    const date = ticket.created_at ? new Date(ticket.created_at.toDate()).toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'}) : 'неизвестно';
                    const statusIndicator = ticket.is_closed ? '<span class="ticket-status closed">Закрыт</span>' : '<span class="open-ticket-btn">Посмотреть</span>';
                    return `<a href="ticket.html?id=${doc.id}" class="ticket-card-link"><div class="ticket-card"><div><span class="ticket-id">Тикет #${doc.id}</span><p class="ticket-description">${ticket.description}</p></div><div class="ticket-footer"><span class="ticket-date">Создано: ${date}</span>${statusIndicator}</div></div></a>`;
                }).join('');
            } else {
                this.ticketsList.innerHTML = '<p class="no-tickets-message">У вас пока нет обращений в поддержку.</p>';
            }
        } catch (error) {
            console.error("Ошибка загрузки тикетов:", error);
            this.ticketsList.innerHTML = `<p class="no-tickets-message error">Не удалось загрузить обращения: ${error.message}</p>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new AccountPage(authManager);
});
