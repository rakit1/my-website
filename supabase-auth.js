// supabase-auth.js
// Интеграция входа через Discord + минимальная совместимость с остальным кодом страницы.
//
// ВАЖНО: замените значения SUPABASE_URL и SUPABASE_ANON_KEY на свои из Supabase Project -> API
// Также убедитесь, что в Supabase включён Discord provider (Client ID/Secret вставлены)
// и в Discord Developer Portal в Redirects добавлен:
//   https://<YOUR_SUPABASE_PROJECT>.supabase.co/auth/v1/callback

const SUPABASE_URL = 'https://<YOUR_SUPABASE_PROJECT>.supabase.co'; // <-- замените
const SUPABASE_ANON_KEY = '<YOUR_SUPABASE_ANON_KEY>'; // <-- замените

if (!window.supabase) {
  console.warn('Supabase SDK not found - make sure the CDN script is loaded before this file.');
}

// создаём клиент Supabase
const sb = (window.supabase && supabase.createClient)
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

// Экспортируемные имена (используются в остальной логике страницы)
window.signOutSupabase = signOutSupabase;
window.checkAuthAndShowIp = checkAuthAndShowIp;
window.signInWithNick = signInWithNick; // stub: старый путь отключён
window.signUpWithNick = signUpWithNick; // stub: старый путь отключён
window.updateUserSectionFromSession = updateUserSectionFromSession;

if (!sb) {
  console.error('Supabase client not initialized. Fill SUPABASE_URL and SUPABASE_ANON_KEY correctly.');
} else {
  initAuth();
}

async function initAuth() {
  // Если пользователь вернулся с OAuth редиректа, сохраните сессию
  try {
    // Если в URL нет параметров — метод может бросить. Игнорируем.
    await sb.auth.getSessionFromUrl({ storeSession: true });
  } catch (err) {
    // Обычно "No auth params found" — нормально
    // console.debug('getSessionFromUrl:', err?.message || err);
  }

  // Подписка на смену сессии
  sb.auth.onAuthStateChange((_event, session) => {
    updateUserSectionFromSession(session);
  });

  // Получим текущую сессию и обновим UI
  try {
    const { data } = await sb.auth.getSession();
    updateUserSectionFromSession(data.session);
  } catch (err) {
    console.error('Ошибка получения сессии Supabase:', err);
  }

  // Привязываем кнопку входа в модальном окне (если есть)
  const modalBtn = document.getElementById('discordSignIn');
  if (modalBtn) {
    modalBtn.addEventListener('click', (e) => {
      e.preventDefault();
      signInWithDiscord();
    });
  }
}

// Запуск OAuth через Supabase (редирект на Discord)
async function signInWithDiscord() {
  try {
    await sb.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        scopes: 'identify email'
      }
    });
    // После этого произойдёт редирект — дальнейшая обработка в getSessionFromUrl / onAuthStateChange
  } catch (err) {
    console.error('Ошибка при попытке входа через Discord:', err);
    alert(err?.message || 'Не удалось начать вход через Discord.');
  }
}

// Выход
async function signOutSupabase() {
  try {
    await sb.auth.signOut();
    // Обновим UI
    updateUserSectionFromSession(null);
    // Опционально обновляем страницу:
    // window.location.reload();
  } catch (err) {
    console.error('Ошибка выхода:', err);
    alert('Не удалось выйти.');
  }
}

// Для совместимости: отключаем старую регистрацию/логин парой ник+пароль.
// Эти функции существуют, но говорят пользователю, что нужно входить через Discord.
function signInWithNick(nick, pwd) {
  return Promise.reject(new Error('Вход по нику/паролю отключён. Пожалуйста, используйте вход через Discord.'));
}
function signUpWithNick(nick, pwd) {
  return Promise.reject(new Error('Регистрация по нику/паролю отключена. Пожалуйста, используйте вход через Discord.'));
}

// Обновляет #userSection: принимает сессию (или null) — используется page кодом
function updateUserSectionFromSession(session) {
  const sec = document.getElementById('userSection');
  if (!sec) return;
  if (session && session.user) {
    // Берём метаданные пользователя, пытаемся получить имя
    const meta = session.user.user_metadata || {};
    // Возможные поля: username, user_name, full_name, etc.
    const name = meta.username || meta.user_name || meta.full_name || session.user.email || 'Игрок';
    // Аватар: Discord может вернуть аватар в user_metadata (если настроено), но чаще нет.
    // Покажем инициал пользователя
    const initials = (name && name[0]) ? name[0].toUpperCase() : 'U';
    sec.innerHTML = `
      <div class="user-info" title="${escapeHtml(name)}">
        <div class="user-avatar" id="userAvatar">${escapeHtml(initials)}</div>
        <div style="margin-left:8px; font-weight:700; color:var(--text)">${escapeHtml(truncate(name, 18))}</div>
      </div>
    `;
    // Навесим клик на аватар для выхода
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
      avatar.addEventListener('click', () => {
        if (confirm('Выйти из аккаунта?')) signOutSupabase();
      });
    }
    // Закрываем модальное окно, если открыто
    hideAuthModalSafe();
  } else {
    // Показываем кнопку входа (сохраняя оригинальный класс и стиль)
    sec.innerHTML = '<button class="login-btn">Войти</button>';
  }
}

// Проверка аутентификации при попытке получить IP: если залогинен — показываем ip modal, иначе показываем auth modal
async function checkAuthAndShowIp() {
  try {
    const { data } = await sb.auth.getSession();
    if (data && data.session && data.session.user) {
      // пользователь есть — показываем IP modal
      showIpModalSafe();
    } else {
      // не залогинен — открываем модалку входа
      showAuthModalSafe();
    }
  } catch (err) {
    console.error('Ошибка проверки сессии:', err);
    showAuthModalSafe();
  }
}

/* Helper UI helpers (взаимодействуют с DOM, определены в index.html, но на случай отсутствия доступны тут) */
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

/* Утилиты */
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function truncate(s, n) {
  s = String(s || '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
