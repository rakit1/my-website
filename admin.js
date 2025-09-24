class AdminPage {
    constructor() {
        this.db = firebase.firestore();
        this.user = null;
        this.ticketsListContainer = document.getElementById('all-tickets-list');
        this.adminContainer = document.getElementById('admin-container');

        // Ждем события 'userStateReady' от auth.js
        document.addEventListener('userStateReady', (event) => {
            const user = event.detail;
            if (user && user.role === 'Администратор') {
                this.user = user;
                this.adminContainer.style.display = 'block';
                this.fetchAllTickets();
            } else if (user) {
                // Если пользователь не админ, отправляем в личный кабинет
                window.location.href = 'account.html';
            } else {
                // Если не авторизован, на главную
                window.location.href = 'index.html';
            }
        });
    }

    async fetchAllTickets() {
        if (!this.ticketsListContainer) return;
        this.ticketsListContainer.innerHTML = '<div class="skeleton-ticket"></div><div class="skeleton-ticket"></div><div class="skeleton-ticket"></div>'; // Показываем скелетоны
        
        try {
            const snapshot = await this.db.collection('tickets').orderBy('ticket_number', 'desc').get();
            if (!snapshot.empty) {
                const authorIds = [...new Set(snapshot.docs.map(doc => doc.data().user_id))];
                const profiles = new Map();
                
                if(authorIds.length > 0) {
                    // Firestore имеет ограничение в 10 элементов для оператора 'in'
                    // Если пользователей будет больше, нужно будет разбивать на несколько запросов.
                    // Для текущей задачи это не критично.
                    const profilesSnapshot = await this.db.collection('profiles').where(firebase.firestore.FieldPath.documentId(), 'in', authorIds).get();
                    profilesSnapshot.docs.forEach(doc => profiles.set(doc.id, doc.data()));
                }

                this.ticketsListContainer.innerHTML = snapshot.docs.map(doc => {
                    const ticket = doc.data();
                    const author = profiles.get(ticket.user_id) || { username: 'Неизвестный' };
                    const date = ticket.created_at ? new Date(ticket.created_at.toDate()).toLocaleDateString('ru-RU', {day: 'numeric', month: 'long', year: 'numeric'}) : '...';
                    const status = ticket.is_closed ? '<span class="ticket-status closed">Закрыт</span>' : '<span class="open-ticket-btn">Ответить</span>';
                    const ticketDisplayId = ticket.ticket_number ? `#${ticket.ticket_number}` : `#${doc.id.substring(0,6)}`;
                    
                    return `
                        <a href="ticket.html?id=${doc.id}" class="ticket-card-link">
                            <div class="ticket-card">
                                <div>
                                    <span class="ticket-id">Тикет ${ticketDisplayId}</span>
                                    <div class="ticket-author">От: ${author.username}</div>
                                    <p class="ticket-description">${ticket.description}</p>
                                </div>
                                <div class="ticket-footer">
                                    <span class="ticket-date">Создано: ${date}</span>
                                    ${status}
                                </div>
                            </div>
                        </a>`;
                }).join('');
            } else {
                this.ticketsListContainer.innerHTML = '<p class="no-tickets-message">Активных обращений нет.</p>';
            }
        } catch (error) {
            console.error("Ошибка загрузки всех тикетов:", error);
            this.ticketsListContainer.innerHTML = '<p class="no-tickets-message error">Не удалось загрузить тикеты.</p>';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new AdminPage();
});
