class AccountPage {
    constructor(authManager) {
        this.authManager = authManager;
        this.user = null;
        this.profileCard = document.getElementById('user-profile-card');
        this.ticketsList = document.getElementById('tickets-list');
        this.init();
    }

    async init() {
        const { data: { user } } = await this.authManager.supabase.auth.getUser();

        if (user) {
            this.user = user;
            this.displayUserProfile();
            this.fetchAndDisplayTickets();
        } else {
            // Если пользователь не авторизован, перенаправляем на главную
            window.location.href = 'index.html';
        }
    }

    displayUserProfile() {
        if (!this.user || !this.profileCard) return;

        const name = this.user.user_metadata?.full_name || 'Пользователь';
        const email = this.user.email;
        const avatarUrl = this.user.user_metadata?.avatar_url;

        this.profileCard.innerHTML = `
            <div class="profile-avatar">
                ${avatarUrl ? `<img src="${avatarUrl}" alt="Аватар">` : name.charAt(0).toUpperCase()}
            </div>
            <h1 class="profile-name">${name}</h1>
            <p class="profile-email">${email}</p>
        `;
    }

    async fetchAndDisplayTickets() {
        if (!this.user || !this.ticketsList) return;

        try {
            const { data, error } = await this.authManager.supabase
                .from('tickets')
                .select('description, created_at')
                .eq('user_id', this.user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data.length > 0) {
                this.ticketsList.innerHTML = data.map(ticket => {
                    const date = new Date(ticket.created_at).toLocaleDateString('ru-RU', {
                        day: 'numeric', month: 'long', year: 'numeric'
                    });
                    return `
                        <div class="ticket-card">
                            <p class="ticket-description">${ticket.description}</p>
                            <span class="ticket-date">Создано: ${date}</span>
                        </div>
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
