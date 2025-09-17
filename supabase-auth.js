// supabase-auth.js
// Обновлённый менеджер авторизации: парсит хеш с access_token и вызывает setSession если нужно.

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
      // Включаем detectSessionInUrl и persistSession
      this.supabase = window.supabase.createClient(this.SUPABASE_URL, this.SUPABASE_ANON_KEY, {
        auth: { detectSessionInUrl: true, persistSession: true }
      });

      // Подписка на изменения статуса (логируем)
      if (this.supabase.auth && typeof this.supabase.auth.onAuthStateChange === 'function') {
        this.supabase.auth.onAuthStateChange((event, session) => {
          console.log('Auth state changed:', event, session);
          this.updateUI();
        });
      }

      this.setupEventListeners();

      // Если URL содержит хеш/код — пытаемся восстановить сессию
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const hasHashTokens = hash.includes('access_token') || hash.includes('refresh_token');
      const hasCode = search.includes('code');

      if (hasHashTokens || hasCode) {
        console.log('Похоже на OAuth-редирект — пытаемся восстановить сессию...');
        // 1) Если есть getSessionFromUrl -> попробуем его
        if (this.supabase.auth && typeof this.supabase.auth.getSessionFromUrl === 'function') {
          try {
            await this.supabase.auth.getSessionFromUrl({ storeSession: true }).catch(e => {
              console.warn('getSessionFromUrl warning:', e);
            });
            console.log('getSessionFromUrl выполнен (если поддерживается).');
          } catch (e) {
            console.warn('getSessionFromUrl failed:', e);
          }
        }

        // 2) Если в хеше есть access_token и setSession доступен — установим сессию вручную
        if (hasHashTokens) {
          const params = this._parseHash(window.location.hash);
          if (params.access_token) {
            if (this.supabase.auth && typeof this.supabase.auth.setSession === 'function') {
              try {
                const result = await this.supabase.auth.setSession({
                  access_token: params.access_token,
                  refresh_token: params.refresh_token || null
                });
                if (result?.error) {
                  console.warn('setSession returned error:', result.error);
                } else {
                  console.log('Сессия установлена через setSession.');
                }
              } catch (err) {
                console.warn('Ошибка при setSession:', err);
              }
            } else {
              console.warn('supabase.auth.setSession не доступен в SDK — обновите версию supabase-js до v2.x');
            }
          } else {
            console.log('В хеше нет access_token — возможно вернулся только code.');
          }
        } else if (hasCode) {
          console.log('В URL есть ?code= — SDK обычно обменяет код на сессию автоматически при detectSessionInUrl=true. Если сессия не появилась — проверьте redirect URI в Supabase/Discord и версию SDK.');
        }

        // Убираем параметры из URL чтобы не оставлять токен в адресной строке
        try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) {}
      }

      // Подождём небольшую паузу и проверим сессию (несколько попыток)
      await this._waitForSession(4, 300);

      await this.checkAuth();
    } catch (error) {
      console.error('Ошибка инициализации Supabase:', error);
    }
  }

  setupEventListeners() {
    // Кнопка Discord входа
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('#discordSignIn');
      if (btn) {
        e.preventDefault();
        this.signInWithDiscord();
      }
    });

    // Показать модалку при клике на "Войти" в header
    document.addEventListener('click', (e) => {
      const loginBtn = e.target.closest('#userSection .login-btn');
      if (loginBtn) this.showModal('#authPage');
    });

    // Закрытие модалей
    document.addEventListener('click', (e) => {
      if (e.target.closest('.close-auth')) this.hideModal('#authPage');
      if (e.target.closest('.close-ip-modal')) this.hideModal('#ipModal');
      if (e.target === document.querySelector('#authPage')) this.hideModal('#authPage');
      if (e.target === document.querySelector('#ipModal')) this.hideModal('#ipModal');
    });

    // Делегированные клики для server-join и ip buttons
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

    // Enter/Space для ip-btn
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
      const redirectTo = window.location.origin + window.location.pathname; // измените явно если нужно
      const { data, error } = await this.supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo, scopes: 'identify email' }
      });
      if (error) {
        console.error('Ошибка OAuth:', error);
        alert('Ошибка при входе через Discord: ' + (error.message || error));
        return;
      }
      console.log('signInWithOAuth стартован:', data);
      // Далее пользователь будет редиректнут на Discord
    } catch (err) {
      console.error('Ошибка signInWithDiscord:', err);
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
        await this.updateUI();
      } else {
        console.log('Активная сессия не найдена');
        await this.updateUI();
      }
    } catch (err) {
      console.error('Ошибка проверки сессии:', err);
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
          <div class="user-info" tabindex="0" aria-haspopup="true">
            <div class="user-avatar" title="${name}">
              ${avatarUrl ? `<img src="${avatarUrl}" alt="${name}">` : name[0].toUpperCase()}
            </div>
            <span>${name}</span>
          </div>
          <div class="dropdown-menu">
            <div class="dropdown-item" id="signOutBtn">Выйти</div>
          </div>
        </div>
      `;
      document.getElementById('signOutBtn')?.addEventListener('click', () => this.signOut());
    } catch (err) {
      console.error('Ошибка updateUI:', err);
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
      console.error('Ошибка handleServerJoin:', err);
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

  _parseHash(hash) {
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

window.authManager = null;
document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.supabase !== 'undefined') window.authManager = new AuthManager();
  else {
    const check = setInterval(() => {
      if (typeof window.supabase !== 'undefined') {
        clearInterval(check);
        window.authManager = new AuthManager();
      }
    }, 150);
  }
});
