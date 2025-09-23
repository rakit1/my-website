class AdminPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.user = null;
        this.ticketsListContainer = document.getElementById('all-tickets-list');
        this.adminContainer = document.getElementById('admin-container'); 
        this.init();
    }

    async init() {
        const { data: { user } } = await this.authManager.supabase.auth.getUser();

        if (user) {
            this.user = user;
            const { data: profile, error } = await this.authManager.supabase
                .from('profiles')
                .select('role')
                .eq('id', this.user.id)
                .single();

            if (error || !profile || profile.role !== 'Администратор') {
                window.location.href = 'account.html';
                return;
            }

            this.adminContainer.style.display = 'block';
            this.fetchAllTickets();

        } else {
            window.location.href = 'index.html';
        }
    }

    async fetchAllTickets() {
        if (!this.ticketsListContainer) return;

        try {
            // ИЗМЕНЕНИЕ: Используем безопасную RPC функцию для админов
            const { data, error } = await this.authManager.supabase.rpc('get_all_tickets_for_admin');

            if (error) throw error;

            if (data.length > 0) {
                this.ticketsListContainer.innerHTML = data.map(ticket => {
                    const date = new Date(ticket.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric', month: 'long', year: 'numeric'
                    });
                    
                    const statusIndicator = ticket.is_closed 
                        ? '<span class="ticket-status closed">Закрыт</span>' 
                        : '<span class="open-ticket-btn">Ответить</span>';

                    const authorUsername = ticket.profiles?.username || 'Неизвестный пользователь';

                    return `
                        <a href="ticket.html?id=${ticket.id}" class="ticket-card-link">
                            <div class="ticket-card">
                                <div>
                                    <span class="ticket-id">Тикет #${ticket.id}</span>
                                    <div class="ticket-author">От: ${authorUsername}</div>
                                    <p class="ticket-description">${ticket.description}</p>
                                </div>
                                <div class="ticket-footer">
                                    <span class="ticket-date">Создано: ${date}</span>
                                    ${statusIndicator}
                                </div>
                            </div>
                        </a>
                    `;
                }).join('');
            } else {
                this.ticketsListContainer.innerHTML = '<p class="no-tickets-message">Активных обращений нет.</p>';
            }
        } catch (error) {
            this.ticketsListContainer.innerHTML = `<p class="no-tickets-message error">Не удалось загрузить обращения: ${error.message}</p>`;
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new AdminPage(authManager);
});
