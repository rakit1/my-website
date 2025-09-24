class AdminPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.db = authManager.db;
        this.user = null;
        this.ticketsListContainer = document.getElementById('all-tickets-list');
        this.adminContainer = document.getElementById('admin-container');
        this.init();
    }

    init() {
        document.addEventListener('userStateReady', (event) => {
            const user = event.detail;
            if (user?.role === 'Администратор') {
                this.user = user;
                this.adminContainer.style.display = 'block';
                this.fetchAllTickets();
            } else if (user) {
                window.location.href = 'account.html';
            } else {
                window.location.href = 'index.html';
            }
        });
    }

    async fetchAllTickets() {
        if (!this.ticketsListContainer) return;
        try {
            const snapshot = await this.db.collection('tickets').orderBy('created_at', 'desc').get();
            if (!snapshot.empty) {
                const authorIds = [...new Set(snapshot.docs.map(doc => doc.data().user_id))];
                const profiles = new Map();
                if(authorIds.length > 0) {
                    const profilesSnapshot = await this.db.collection('profiles').where(firebase.firestore.FieldPath.documentId(), 'in', authorIds).get();
                    profilesSnapshot.docs.forEach(doc => profiles.set(doc.id, doc.data()));
                }
                this.ticketsListContainer.innerHTML = snapshot.docs.map(doc => {
                    const ticket = doc.data();
                    const author = profiles.get(ticket.user_id) || { username: 'Неизвестный' };
                    const date = new Date(ticket.created_at.toDate()).toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'});
                    const status = ticket.is_closed ? '<span class="ticket-status closed">Закрыт</span>' : '<span class="open-ticket-btn">Ответить</span>';
                    return `<a href="ticket.html?id=${doc.id}" class="ticket-card-link"><div class="ticket-card"><div><span class="ticket-id">Тикет #${doc.id}</span><div class="ticket-author">От: ${author.username}</div><p class="ticket-description">${ticket.description}</p></div><div class="ticket-footer"><span class="ticket-date">Создано: ${date}</span>${status}</div></div></a>`;
                }).join('');
            } else {
                this.ticketsListContainer.innerHTML = '<p class="no-tickets-message">Активных обращений нет.</p>';
            }
        } catch (error) {
            console.error("Ошибка загрузки всех тикетов:", error);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new AdminPage(authManager);
});
