class SupportPage {
    constructor() {
        this.SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
        this.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
        this.supabase = null;
        this.user = null;

        this.form = document.getElementById('ticket-form');
        this.feedbackDiv = document.getElementById('form-feedback');
        
        this.init();
    }

    async init() {
        // 1. Инициализируем Supabase
        this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY);

        // 2. Проверяем, авторизован ли пользователь
        const { data: { user } } = await this.supabase.auth.getUser();
        if (!user) {
            // Если нет — выгоняем на главную
            window.location.href = 'index.html';
            return; // Прекращаем выполнение скрипта
        }
        this.user = user;
        
        // 3. Отображаем информацию о пользователе в шапке
        this.updateUserUI();

        // 4. Настраиваем обработчик для формы
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    async handleSubmit(event) {
        event.preventDefault(); // Предотвращаем перезагрузку страницы
        
        const username = this.form.elements.username.value;
        const description = this.form.elements.description.value;
        const submitButton = this.form.querySelector('button[type="submit"]');

        submitButton.disabled = true;
        submitButton.textContent = 'Отправка...';

        try {
            // Отправляем данные в таблицу 'tickets' в Supabase
            const { error } = await this.supabase
                .from('tickets')
                .insert([
                    { 
                        username: username, 
                        description: description,
                        // Важно: привязываем тикет к ID пользователя, который его создал!
                        user_id: this.user.id 
                    }
                ]);

            if (error) {
                // Если Supabase вернул ошибку, показываем ее
                throw error;
            }

            // Если все успешно
            this.showFeedback('Ваше обращение успешно отправлено!', 'success');
            this.form.reset();

        } catch (error) {
            this.showFeedback(`Ошибка: ${error.message}`, 'error');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Отправить обращение';
        }
    }
    
    showFeedback(message, type) {
        this.feedbackDiv.textContent = message;
        this.feedbackDiv.className = `form-feedback ${type} visible`;
        this.feedbackDiv.setAttribute('aria-hidden', 'false');

        setTimeout(() => {
            this.feedbackDiv.classList.remove('visible');
            this.feedbackDiv.setAttribute('aria-hidden', 'true');
        }, 5000);
    }

    updateUserUI() {
        // Эта функция дублирует логику из основного script.js для отображения
        // пользователя в шапке на этой отдельной странице.
        const userSection = document.getElementById('userSection');
        if (!userSection || !this.user) return;

        const name = this.user.user_metadata?.full_name || this.user.email;
        const avatarUrl = this.user.user_metadata?.avatar_url;
        userSection.innerHTML = `
            <div class="user-info">
                <div class="user-avatar" title="${name}">
                    ${avatarUrl ? `<img src="${avatarUrl}" alt="Аватар" style="width:100%;height:100%;border-radius:50%;">` : name.charAt(0).toUpperCase()}
                </div>
                <span class="user-name">${name}</span>
            </div>`;
    }
}

// Запускаем скрипт после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    new SupportPage();
});
