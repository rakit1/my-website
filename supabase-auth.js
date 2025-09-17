// supabase-auth.js — надёжный менеджер авторизации Supabase (v2)
// Основные отличия:
// - не вызывает несуществующие методы напрямую
// - пытается установить сессию из хеша (если токены вернулись в URL)
// - даёт понятные логи для отладки редиректа / redirect URI

class AuthManager {
  constructor() {
    this.SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
    this.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhbmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
    this.supabase = null;
    this.init();
  }

  async init() {
    if (typeof window.supabase === 'undefined') {
      console.error('Supabase не загружен — подключите CDN @supabase/supabase-js ДО этого скрипта.');
      return;
    }

    try {
      this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY, {
        auth: { detectSessionInUrl: true, persistSession: true }
      });

      // Подпишемся на изменения сразу
      this.supabase.auth.onAuthStateChange((event, session) => {
        console.log('Auth state changed:', event, session);
        this.updateUI();
      });

      this.setupEventListeners();

      // Попробуем корректно обработать OAuth-редирект:
      // 1) если SDK имеет getSessionFromUrl -> используем
      // 2) иначе, если в хеше есть access_token -> распарсим и вызовем setSession
      // 3) если в query есть code -> логируем (обычно SDK сам обменяет код, если detectSessionInUrl работает)
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const looksLikeOAuthHash = hash.includes('access_token') || hash.includes('refresh_token');
      const looksLikeOAuthCode = search.includes('code');

      if (looksLikeOAuthHash || looksLikeOAuthCode) {
        console.log('Похоже на OAuth-редирект — пытаемся восстановить сессию...');
        // Если SDK содержит getSessionFromUrl, вызываем его безопасно
        if (this.supabase.auth && typeof this.supabase.auth.getSessionFromUrl === 'function') {
          try {
            await this.supabase.auth.getSessionFromUrl({ storeSession: true }).catch(err => {
              console.warn('getSessionFromUrl warning:', err);
            });
          } catch (err) {
            console.warn('getSessionFromUrl failed:', err);
          }
        } else {
          // Если метод отсутствует, проверим хеш: access_token & refresh_token
          if (looksLikeOAuthHash) {
            try {
              const params = this._parseHash(window.location.hash);
              if (params.access_token) {
                // Попытка установить сессию вручную
                if (this.supabase.auth && typeof this.supabase.auth.setSession === 'function') {
                  await this.supabase.auth.setSession({
                    access_token: params.access_token,
                    refresh_token: params.refresh_token || null
                  });
                  console.log('Сессия установлена вручную из хеша.');
                } else {
                  console.warn('supabase.auth.setSession не доступен в SDK — проверьте версию supabase-js.');
                }
              } else {
                console.log('В хеше нет access_token; возможно используется код авторизации (code).');
              }
            } catch (err) {
              console.warn('Ошибка при попытке установить сессию из хеша:', err);
            }
          } else if (looksLikeOAuthCode) {
            console.log('URL содержит ?code= — SDK обычно должен обменять код автоматически (если detectSessionInUrl=true). Если сессия не появилась, проверьте redirect URI в Supabase и Discord.');
          }
        }

        // Очистим хеш/query чтобы не обрабатывать повторно
        try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
      }

      // Некоторая задержка/повтор для уверенности, что SDK успел сохранить сессию
      await this._waitForSession(3, 400);

      await this.checkAuth();
    } catch (error) {
      console.error('Ошибка инициализации Supabase:', error);
    }
  }

  setupEventListeners() {
    // Вход через Discord (делегирование)
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#discordSignIn');
      if (btn) {
        e.preventDefault();
        this.signInWithDiscord();
      }
    });

    // Показ модалки входа при клике на кнопку "Войти" в header
    document.addEventListener('click', (e) => {
      const loginBtn = e.target.closest('#userSection .login-btn');
      if (loginBtn) this.showModal('#authPage');
    });

    // Закрытие модалей
    document.addEventListener('click', (e) => {
      if (e.target.closest('.close-auth')) this.hideModal('#authPage');
      if (e.target.closest('.close-ip-modal')) this.hideModal('#ipModal');
      // клики по подложке
      if (e.target === document.querySelector('#authPage')) this.hideModal('#authPage');
      if (e.target === document.querySelector('#ipModal')) this.hideModal('#ipModal');
    });

    // Кнопки Сервер -> Присоединиться и IP-кнопки (делегирование)
    document.addEventListener('click', (e) => {
      const join = e.target.closest('.server-join-btn');
      if (join) {
        e.preventDefault();
        this.handleServerJoin();
        return;
      }
      const ipBtn = e.target.closest('.ip-btn');
      if (ipBtn) this.copyIP(ipBtn);
    });

    // Enter/Space on ip-btn for accessibility
    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && document.activeElement && document.activeElement.classList.contains('ip-btn')) {
        e.preventDefault();
        this.copyIP(document.activeElement);
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
      console.log('Начало авторизации через Discord...');
      // redirectTo должен точно совпадать с тем, что зарегистрировано в Supabase и Discord
      const redirectTo = window.location.origin + window.location.pathname;
      await this.supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo, scopes: 'identify email' }
      });
      // Пользователь будет перенаправлен — дальнейшая обработка при редиректе
    } catch (err) {
      console.error('Ошибка signInWithOAuth:', err);
      alert('Ошибка при попытке войти через Discord');
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
      console.error('Ошибка выхода:', err);
      alert('Не удалось выйти из аккаунта');
    }
  }

  async checkAuth() {
    try {
      const res = await this.supabase.auth.getSession();
      const session = res?.data?.session;
      if (res?.error) console.warn('getSession error:', res.error);
      if (session) {
        console.log('Сессия найдена:', session.user);
        this.updateUI();
      } else {
        console.log('Активная сессия не найдена');
        this.updateUI();
      }
    } catch (err) {
      console.error('Ошибка проверки авторизации:', err);
    }
  }

  async updateUI() {
    const userSection = document.getElementById('userSection');
    if (!userSection) return;
    try {
      const res = await this.supabase.auth.getUser().catch(err => {
        if (err && String(err.message).includes('AuthSessionMissingError')) {
          return { data: { user: null }, error: err };
        }
        throw err;
      });
      const user = res?.data?.user;
      if (!user) {
        userSection.innerHTML = '<button class="login-btn">Войти</button>';
        return;
      }
      const name = user.user_metadata?.full_name || user.user_metadata?.global_name || user.email || 'User';
      const avatarUrl = user.user_metadata?.avatar_url;
      userSection.innerHTML = `
        <div class="user-dropdown">
          <div class="user-info" tabindex="0">
            <div class="user-avatar" title="${name}">
              ${avatarUrl ? `<img src="${avatarUrl}" alt="${name}">` : name[0].toUpperCase()}
            </div>
            <span>${name}</span>
          </div>
          <div class="dropdown-menu">
            <div class="dropdown-item" id="signOutBtn">Выйти</div>
          </div>
        </div>`;
      document.getElementById('signOutBtn')?.addEventListener('click', () => this.signOut());
    } catch (err) {
      console.error('Ошибка обновления UI:', err);
      userSection.innerHTML = '<button class="login-btn">Войти</button>';
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
      if (user) this.showModal('#ipModal');
      else this.showModal('#authPage');
    } catch (err) {
      console.error('Ошибка обработки кнопки сервера:', err);
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

  // Вспомогательные методы
  _parseHash(hash) {
    // hash: '#access_token=...&refresh_token=...&...'
    const cleaned = hash.charAt(0) === '#' ? hash.slice(1) : hash;
    const parts = cleaned.split('&');
    const obj = {};
    parts.forEach(p => {
      const [k, v] = p.split('=');
      if (k) obj[decodeURIComponent(k)] = v ? decodeURIComponent(v) : '';
    });
    return obj;
  }

  async _waitForSession(retries = 3, delay = 300) {
    for (let i = 0; i < retries; i++) {
      const res = await this.supabase.auth.getSession().catch(() => null);
      if (res && res.data && res.data.session) return true;
      await new Promise(r => setTimeout(r, delay));
    }
    return false;
  }
}

// Инициализация
window.authManager = null;
document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.supabase !== 'undefined') window.authManager = new AuthManager();
  else {
    const interval = setInterval(() => {
      if (typeof window.supabase !== 'undefined') {
        clearInterval(interval);
        window.authManager = new AuthManager();
      }
    }, 150);
  }
});
