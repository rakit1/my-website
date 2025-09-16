// supabase-auth.js — более устойчивый вариант инициализации Supabase auth
// ВАЖНО: при публикации в публичных местах НЕ выкладывайте anon-key (если он скомпрометирован,
// регенерируйте в панели Supabase).
(function () {
  'use strict';

  // Задайте ваши значения (анон‑ключ можно оставить пустым для защитного режима)
  const SUPABASE_URL = 'https://egskxyxgzdidfbxhjaud.supabase.co'; // <-- ваш проект
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw'; // <-- вставьте anon key здесь (без <>). Если пусто — auth будет отключён.

  // Локальная переменная клиента
  let sb = null;

  // Попытка безопасной инициализации клиента
  try {
    if (window.supabase && typeof supabase.createClient === 'function' && SUPABASE_URL && SUPABASE_ANON_KEY) {
      sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.info('Supabase client initialized.');
    } else {
      if (!window.supabase) console.warn('Supabase SDK not found. Убедитесь, что CDN загружен перед этим скриптом.');
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) console.info('SUPABASE_URL или SUPABASE_ANON_KEY не заданы — авторизация отключена (защитный режим).');
      sb = null;
    }
  } catch (err) {
    console.error('Ошибка при инициализации Supabase (защитный режим):', err);
    sb = null;
  }

  // Экспортируем интерфейс на window (безопасные заглушки, если sb === null)
  window.signInWithDiscord = signInWithDiscord;
  window.signOutSupabase = signOutSupabase;
  window.checkAuthAndShowIp = checkAuthAndShowIp;
  window.signInWithNick = signInWithNick;
  window.signUpWithNick = signUpWithNick;
  window.updateUserSectionFromSession = updateUserSectionFromSession;

  // Попробуем подписаться и восстановить сессию, если клиент создан
  (function initAuth() {
    if (!sb) return;

    try {
      if (typeof sb.auth.getSessionFromUrl === 'function') {
        // Попытка обработать редирект от OAuth, если есть параметры в URL
        sb.auth.getSessionFromUrl({ storeSession: true }).catch(()=>{/*ignore*/});
      }
    } catch (err) {
      // Не критично
      console.debug('getSessionFromUrl not available or failed:', err);
    }

    // Подписываемся на изменения сессии (безопасно)
    try {
      if (typeof sb.auth.onAuthStateChange === 'function') {
        sb.auth.onAuthStateChange((_event, session) => {
          try { updateUserSectionFromSession(session); } catch (e) { /* ignore */ }
        });
      }
    } catch (err) {
      console.warn('onAuthStateChange subscription failed:', err);
    }

    // Попытка получить текущую сессию
    (async () => {
      try {
        if (typeof sb.auth.getSession === 'function') {
          const { data } = await sb.auth.getSession();
          updateUserSectionFromSession(data?.session ?? null);
        }
      } catch (err) {
        console.error('Ошибка получения сессии Supabase:', err);
      }
    })();
  })();

  // Навешивание обработчика на кнопку входа: делегирование + попытка прямой привязки
  (function attachHandlers() {
    function tryAttach() {
      const modalBtn = document.getElementById('discordSignIn');
      if (modalBtn && !modalBtn._sa_attached) {
        modalBtn.addEventListener('click', (e) => { e.preventDefault(); signInWithDiscord(); });
        modalBtn._sa_attached = true;
      }
    }
    tryAttach();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', tryAttach);
    }
    // Делегирование — на всякий случай
    document.addEventListener('click', function (e) {
      try {
        const btn = e.target && e.target.closest && e.target.closest('#discordSignIn');
        if (btn) {
          e.preventDefault();
          signInWithDiscord();
        }
      } catch (_) { /* silent */ }
    });
  })();

  // Реализация входа через Discord (OAuth)
  async function signInWithDiscord() {
    if (!sb) {
      alert('Авторизация недоступна (ошибка конфигурации). Свяжитесь с администратором.');
      return;
    }
    try {
      if (typeof sb.auth.signInWithOAuth !== 'function') {
        alert('Метод signInWithOAuth не поддерживается в текущей версии Supabase SDK.');
        return;
      }
      await sb.auth.signInWithOAuth({
        provider: 'discord',
        options: { scopes: 'identify email' }
      });
      // Редирект произойдёт автоматически
    } catch (err) {
      console.error('Ошибка при попытке входа через Discord:', err);
      alert(err?.message || 'Не удалось начать вход через Discord.');
    }
  }

  // Выход
  async function signOutSupabase() {
    if (!sb) { console.info('signOutSupabase: Supabase не настроен.'); return; }
    try {
      if (typeof sb.auth.signOut === 'function') {
        await sb.auth.signOut();
      }
      updateUserSectionFromSession(null);
    } catch (err) {
      console.error('Ошибка выхода:', err);
      alert('Не удалось выйти.');
    }
  }

  // Старые заглушки
  function signInWithNick() {
    return Promise.reject(new Error('Вход по нику/паролю отключён. Используйте Discord.'));
  }
  function signUpWithNick() {
    return Promise.reject(new Error('Регистрация по нику/паролю отключена. Используйте Discord.'));
  }

  // Обновление UI секции пользователя (безопасно)
  function updateUserSectionFromSession(session) {
    try {
      const sec = document.getElementById('userSection');
      if (!sec) return;
      if (session && session.user) {
        const meta = session.user.user_metadata || {};
        const name = meta.username || meta.user_name || meta.full_name || session.user.email || 'Игрок';
        const initials = (name && name[0]) ? name[0].toUpperCase() : 'U';
        sec.innerHTML = `
          <div class="user-info" title="${escapeHtml(name)}">
            <div class="user-avatar" id="userAvatar">${escapeHtml(initials)}</div>
            <div style="margin-left:8px; font-weight:700; color:var(--text)">${escapeHtml(truncate(name, 18))}</div>
          </div>
        `;
        const avatar = document.getElementById('userAvatar');
        if (avatar) avatar.addEventListener('click', () => {
          if (confirm('Выйти из аккаунта?')) signOutSupabase();
        });
        hideAuthModalSafe();
      } else {
        sec.innerHTML = '<button class="login-btn">Войти</button>';
      }
    } catch (err) {
      console.error('updateUserSectionFromSession error:', err);
    }
  }

  // Проверка сессии и показ IP/модалки
  async function checkAuthAndShowIp() {
    if (!sb) { showAuthModalSafe(); return; }
    try {
      if (typeof sb.auth.getSession === 'function') {
        const { data } = await sb.auth.getSession();
        if (data && data.session && data.session.user) {
          showIpModalSafe();
        } else {
          showAuthModalSafe();
        }
      } else {
        showAuthModalSafe();
      }
    } catch (err) {
      console.error('Ошибка проверки сессии:', err);
      showAuthModalSafe();
    }
  }

  /* UI helpers (fallback) */
  function showAuthModalSafe() {
    const el = document.getElementById('authPage');
    if (el) el.style.display = 'flex';
  }
  function hideAuthModalSafe() {
    const el = document.getElementById('authPage');
    if (el) el.style.display = 'none';
  }
  function showIpModalSafe() {
    const el = document.getElementById('ipModal');
    if (el) el.style.display = 'flex';
  }

  /* Utils */
  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }

})();
