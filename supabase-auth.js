// supabase-auth.js — упрощённый и надёжный менеджер авторизации Supabase (v2)
// Задачи:
// - надежно обрабатывать OAuth-редирект (getSessionFromUrl)
// - включить persistSession/detectSessionInUrl
// - более стабильная отрисовка UI и делегирование событий

class AuthManager {
  constructor() {
    this.SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
    this.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhbmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
    this.supabase = null;
    this.init();
  }

  async init() {
    if (typeof window.supabase === 'undefined') {
      console.error('Supabase не загружен (проверьте порядок <script>): библиотека должна загружаться ДО этого файла.');
      return;
    }

    try {
      // Включаем опции, чтобы SDK попытался распарсить сессию из URL и сохранять её
      this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY, {
        auth: {
          detectSessionInUrl: true,
          persistSession: true
        }
      });

      // Подписка на изменение статуса — вешаем сразу
      this.supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, session);
        this.updateUI();
      });

      this.setupEventListeners();

      // Если URL содержит OAuth-параметры — попробуем извлечь сессию вручную, затем очистим URL
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const looksLikeOAuth = hash.includes('access_token') || hash.includes('refresh_token') || search.includes('code');

      if (looksLikeOAuth) {
        try {
          console.log('OAuth-редирект обнаружен — обработка getSessionFromUrl...');
          // Supabase v2: распарсит и сохранит сессию, если possible
          await this.supabase.auth.getSessionFromUrl({ storeSession: true }).catch(err => {
            console.warn('getSessionFromUrl warning:', err);
          });
          // Убираем параметры из URL, чтобы не обрабатывать их повторно
          try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
        } catch (e) {
          console.warn('Ошибка при getSessionFromUrl:', e);
        }
      }

      await this.checkAuth();
    } catch (error) {
      console.error('Ошибка инициализации Supabase:', error);
    }
  }

  setupEventListeners() {
    // Кнопка входа в модальном окне
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#discordSignIn');
      if (btn) {
        e.preventDefault();
        this.signInWithDiscord();
      }
    });

    // Показываем модалку при клике на кнопку "Войти" в header (делегируем)
    document.addEventListener('click', (e) => {
      const loginBtn = e.target.closest('#userSection .login-btn');
      if (loginBtn) {
        this.showModal('#authPage');
      }
    });

    // Закрытие модалей (делегируем, чтобы охватить динамические элементы)
    document.addEventListener('click', (e) => {
      if (e.target.closest('.close-auth')) this.hideModal('#authPage');
      if (e.target.closest('.close-ip-modal')) this.hideModal('#ipModal');
    });

    // Закрытие модалей кликом по подложке
    document.addEventListener('click', (e) => {
      if (e.target === document.querySelector('#authPage')) this.hideModal('#authPage');
      if (e.target === document.querySelector('#ipModal')) this.hideModal('#ipModal');
    });

    // Делегированная обработка кликов для кнопок "Присоединиться" (сервер) и IP-кнопок
    document.addEventListener('click', (e) => {
      const join = e.target.closest('.server-join-btn');
      if (join) {
        e.preventDefault();
        this.handleServerJoin();
        return;
      }
      const ipBtn = e.target.closest('.ip-btn');
      if (ipBtn) {
        // Передаём DOM-элемент
        this.copyIP(ipBtn);
      }
    });

    // Клавиши Enter/Space для ip-btn (accessibility)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        const active = document.activeElement;
        if (active && active.classList && active.classList.contains('ip-btn')) {
          e.preventDefault();
          this.copyIP(active);
        }
      }
    });
  }

  showModal(selector) {
    const modal = document.querySelector(selector);
    if (modal) modal.style.display = 'flex';
  }

  hideModal(selector) {
    const modal = document.querySelector(selector);
    if (modal) modal.style.display = 'none';
  }

  async signInWithDiscord() {
    try {
      console.log('Запуск OAuth Discord...');
      // ВАЖНО: redirectTo должен точно совпадать с тем, что указан в Supabase и в Discord OAuth
      const redirectUri = window.location.origin + window.location.pathname; // <-- измените при необходимости на точный зарегистрированный URI
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: redirectUri,
          scopes: 'identify email'
        }
      });

      if (error) {
        console.error('Ошибка signInWithOAuth:', error);
        alert('Ошибка при входе через Discord: ' + (error.message || error));
        return;
      }

      console.log('signInWithOAuth response:', data);
      // При успешном начале OAuth пользователь будет перенаправлен на Discord — дальнейшая обработка при редиректе
    } catch (error) {
      console.error('Ошибка авторизации:', error);
      alert('Произошла ошибка при авторизации');
    }
  }

  async signOut() {
    if (!confirm('Выйти из аккаунта?')) return;
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) throw error;
      this.updateUI();
      this.hideModal('#authPage');
      this.hideModal('#ipModal');
    } catch (err) {
      console.error('Ошибка при выходе:', err);
      alert('Не удалось выйти из аккаунта');
    }
  }

  async checkAuth() {
    try {
      const res = await this.supabase.auth.getSession();
      const session = res?.data?.session;
      if (res?.error) {
        console.warn('getSession error:', res.error);
      }
      if (session) {
        console.log('Сессия активна:', session.user);
        await this.updateUI();
      } else {
        console.log('Сессии нет');
        await this.updateUI(); // рендерим кнопку входа
      }
    } catch (err) {
      console.error('Ошибка checkAuth:', err);
    }
  }

  async updateUI() {
    const userSection = document.getElementById('userSection');
    if (!userSection) return;

    try {
      const res = await this.supabase.auth.getUser().catch(err => {
        if (err && String(err.message).includes('AuthSessionMissingError')) {
          // Ожидаемая ситуация — нет сессии
          return { data: { user: null }, error: err };
        }
        throw err;
      });

      const user = res?.data?.user;
      const error = res?.error;

      if (!user) {
        userSection.innerHTML = '<button class="login-btn">Войти</button>';
        return;
      }

      const name = user.user_metadata?.full_name || user.user_metadata?.global_name || user.email || 'User';
      const avatarUrl = user.user_metadata?.avatar_url;

      userSection.innerHTML = `
        <div class="user-dropdown">
          <div class="user-info" tabindex="0" aria-haspopup="true">
            <div class="user-avatar" title="${name}">
              ${avatarUrl ? `<img src="${avatarUrl}" alt="${name}">` : name[0].toUpperCase()}
            </div>
            <span>${name}</span>
          </div>
          <div class="dropdown-menu" role="menu">
            <div class="dropdown-item" id="signOutBtn" role="menuitem">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
              </svg>
              Выйти
            </div>
          </div>
        </div>
      `;

      // Подписываемся на кнопку выхода (делегирование уже есть, но удобно повесить локально)
      const signOutBtn = document.getElementById('signOutBtn');
      if (signOutBtn) {
        signOutBtn.addEventListener('click', () => this.signOut());
      }
    } catch (err) {
      console.error('updateUI error:', err);
      const userSection = document.getElementById('userSection');
      if (userSection) userSection.innerHTML = '<button class="login-btn">Войти</button>';
    }
  }

  async handleServerJoin() {
    try {
      const res = await this.supabase.auth.getUser().catch(err => {
        if (err && String(err.message).includes('AuthSessionMissingError')) {
          return { data: { user: null }, error: err };
        }
        throw err;
      });
      const user = res?.data?.user;
      if (user) {
        this.showModal('#ipModal');
      } else {
        this.showModal('#authPage');
      }
    } catch (err) {
      console.error('handleServerJoin error:', err);
      this.showModal('#authPage');
    }
  }

  async copyIP(button) {
    if (!button) return;
    const ip = button.getAttribute('data-ip') || '';
    if (!ip) return;

    try {
      await navigator.clipboard.writeText(ip);
      button.classList.add('copied');
      setTimeout(() => button.classList.remove('copied'), 1200);
    } catch (err) {
      console.warn('navigator.clipboard failed, fallback to textarea', err);
      try {
        const ta = document.createElement('textarea');
        ta.value = ip;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        button.classList.add('copied');
        setTimeout(() => button.classList.remove('copied'), 1200);
      } catch (fallbackErr) {
        alert('Не удалось скопировать IP. Скопируйте вручную: ' + ip);
      }
    }
  }
}

// Экспорт / глобальная переменная
window.authManager = null;
document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.supabase !== 'undefined') {
    window.authManager = new AuthManager();
  } else {
    const checker = setInterval(() => {
      if (typeof window.supabase !== 'undefined') {
        clearInterval(checker);
        window.authManager = new AuthManager();
      }
    }, 150);
  }
});
