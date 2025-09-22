class AccountPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.user = null;
        this.profileCard = document.getElementById('user-profile-card');
        this.ticketsList = document.getElementById('tickets-list');
        this.adminPanelSection = document.getElementById('admin-panel-section');
        this.init();
    }

    async init() {
        const { data: { user } } = await this.authManager.supabase.auth.getUser();

        if (user) {
            this.user = user;
            this.displayUserProfile();
            this.fetchAndDisplayTickets();
            document.body.addEventListener('click', (e) => {
                if (e.target.closest('.logout-btn')) {
                    this.authManager.signOut();
                }
            });
        } else {
            window.location.href = 'index.html';
        }
    }

    async displayUserProfile() {
        if (!this.user || !this.profileCard) return;

        const name = this.user.user_metadata?.full_name || 'Пользователь';
        const email = this.user.email;
        const avatarUrl = this.user.user_metadata?.avatar_url;

        let userRole = 'Игрок';
        try {
            const { data, error } = await this.authManager.supabase
                .from('profiles')
                .select('role')
                .eq('id', this.user.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            if (data) userRole = data.role;

            // Если пользователь - админ, показываем кнопку
            if (userRole === 'Администратор') {
                this.displayAdminButton();
            }

        } catch (error) {
            console.error('Ошибка при получении роли пользователя:', error.message);
        }
        
        const roleClass = userRole === 'Администратор' ? 'administrator' : 'player';

        this.profileCard.innerHTML = `
            <div class="profile-avatar">
                ${avatarUrl ? `<img src="${avatarUrl}" alt="Аватар">` : name.charAt(0).toUpperCase()}
            </div>
            <h1 class="profile-name">${name}</h1>
            <span class="user-role ${roleClass}">${userRole}</span>
            <p class="profile-email">${email}</p>
        `;
    }

    async displayAdminButton() {
        // Получаем количество открытых тикетов
        const { count, error } = await this.authManager.supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true })
            .eq('is_closed', false);

        if (error) {
            console.error('Не удалось получить количество тикетов:', error);
            return;
        }
        
        if (this.adminPanelSection) {
            this.adminPanelSection.innerHTML = `
                <a href="admin.html" class="admin-panel-button">
                    Отвечать на тикеты
                    <span class="ticket-count">${count}</span>
                </a>
            `;
        }
    }

    async fetchAndDisplayTickets() {
        if (!this.user || !this.ticketsList) return;

        try {
            const { data, error } = await this.authManager.supabase
                .from('tickets')
                .select('id, description, created_at, is_closed')
                .eq('user_id', this.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data.length > 0) {
                this.ticketsList.innerHTML = data.map(ticket => {
                    const date = new Date(ticket.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric', month: 'long', year: 'numeric'
                    });
                    
                    const statusIndicator = ticket.is_closed 
                        ? '<span class="ticket-status closed">Закрыт</span>' 
                        : '<span class="open-ticket-btn">Посмотреть</span>';

                    return `
                        <a href="ticket.html?id=${ticket.id}" class="ticket-card-link">
                            <div class="ticket-card">
                                <div>
                                    <span class="ticket-id">Тикет #${ticket.id}</span>
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
                this.ticketsList.innerHTML = '<p class="no-tickets-message">У вас пока нет обращений в поддержку.</p>';
            }
        } catch (error) {
            this.ticketsList.innerHTML = `<p class="no-tickets-message error">Не удалось загрузить обращения: ${error.message}</p>`;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const authManager = new AuthManager();
    new AccountPage(authManager);
});
