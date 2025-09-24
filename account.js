class AccountPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.supabase = authManager.supabase; // Добавляем supabase для удобства
        this.user = null;
        this.profileCard = document.getElementById('user-profile-card');
        this.ticketsList = document.getElementById('tickets-list');
        this.adminPanelSection = document.getElementById('admin-panel-section');
        this.channel = null; // Канал для Realtime
        this.init();
    }

    async init() {
        const { data: { user } } = await this.supabase.auth.getUser();

        if (user) {
            this.user = user;
            this.displayUserProfile();
            this.fetchAndDisplayTickets();
        } else {
            window.location.href = 'index.html';
        }

        // Отписываемся от канала при уходе со страницы
        window.addEventListener('beforeunload', () => {
            if (this.channel) {
                this.supabase.removeChannel(this.channel);
            }
        });
    }

    async displayUserProfile() {
        if (!this.user || !this.profileCard) return;

        const name = this.user.user_metadata?.full_name || 'Пользователь';
        const email = this.user.email;
        const avatarUrl = this.user.user_metadata?.avatar_url;

        let userRole = 'Игрок';
        try {
            const { data, error } = await this.supabase
                .from('profiles')
                .select('role')
                .eq('id', this.user.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            if (data) userRole = data.role;

            if (userRole === 'Администратор') {
                this.displayAdminButton();
                this.subscribeToTicketCount(); // Подписываемся на обновления, если пользователь - админ
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
    
    // Новая функция для обновления счетчика
    async updateAdminTicketCount() {
        const ticketCountElement = document.querySelector('.ticket-count');
        if (!ticketCountElement) return;

        try {
            const { count, error } = await this.supabase
                .from('tickets')
                .select('*', { count: 'exact', head: true })
                .eq('is_closed', false);

            if (error) throw error;

            ticketCountElement.textContent = count;
        } catch (error) {
            console.error('Не удалось обновить количество тикетов:', error);
            ticketCountElement.textContent = 'X';
        }
    }

    // Эта функция теперь только отображает кнопку
    async displayAdminButton() {
        if (this.adminPanelSection) {
            this.adminPanelSection.innerHTML = `
                <a href="admin.html" class="admin-panel-button">
                    Отвечать на тикеты
                    <span class="ticket-count">...</span>
                </a>
            `;
            // Вызываем обновление счетчика сразу после отрисовки кнопки
            this.updateAdminTicketCount();
        }
    }
    
    // Новая функция для подписки на Realtime
    subscribeToTicketCount() {
        if (this.channel) return; // Если уже подписаны, ничего не делаем

        this.channel = this.supabase.channel('public:tickets')
          .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'tickets' }, 
            () => {
              // При любом изменении в таблице tickets, обновляем счетчик
              this.updateAdminTicketCount();
            }
          )
          .subscribe();
    }

    async fetchAndDisplayTickets() {
        if (!this.user || !this.ticketsList) return;

        try {
            const { data, error } = await this.supabase.rpc('get_tickets_for_user');

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
