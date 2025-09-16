// supabase-auth.js — обновлённый: надёжно навешивает обработчики и использует делегирование
// ВАЖНО: заполните SUPABASE_URL и SUPABASE_ANON_KEY корректными значениями
const SUPABASE_URL = 'https://egskxyxgzdidfbxhjaud.supabase.co'; // <-- ваш проект
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw'; // <-- ваш anon key (без <>)

if (!window.supabase) {
  console.warn('Supabase SDK not found - убедитесь, что CDN загружен до этого файла.');
}

const sb = (window.supabase && supabase.createClient)
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

window.signOutSupabase = signOutSupabase;
window.checkAuthAndShowIp = checkAuthAndShowIp;
window.signInWithNick = signInWithNick;
window.signUpWithNick = signUpWithNick;
window.updateUserSectionFromSession = updateUserSectionFromSession;

if (!sb) {
  console.error('Supabase client not initialized. Проверьте SUPABASE_URL и SUPABASE_ANON_KEY.');
} else {
  initAuth();
}

// Инициализация auth. Не полагаемся только на элемент существующий в момент загрузки файла.
async function initAuth() {
  try {
    await sb.auth.getSessionFromUrl({ storeSession: true });
  } catch (err) {
    // нормально, если нет параметров
  }

  sb.auth.onAuthStateChange((_event, session) => {
    updateUserSectionFromSession(session);
  });

  try {
    const { data } = await sb.auth.getSession();
    updateUserSectionFromSession(data.session);
  } catch (err) {
    console.error('Ошибка получения сессии Supabase:', err);
  }

  // Надёжно навешиваем обработчик на кнопку входа:
  // 1) Если кнопка уже есть в DOM — повесим прямо.
  // 2) Также добавляем делегирование кликов на документ — чтобы ловить клики, даже если кнопка добавится поздно.
  attachModalButton();
  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('#discordSignIn');
    if (btn) {
      e.preventDefault();
      signInWithDiscord();
    }
  });
}

// Функция, которая попытается найти кнопку и навесить слушатель (вызовется сразу и после DOMContentLoaded)
function attachModalButton() {
  const tryAttach = () => {
    const modalBtn = document.getElementById('discordSignIn');
    if (modalBtn && !modalBtn._supabaseAttached) {
      modalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        signInWithDiscord();
      });
      modalBtn._supabaseAttached = true;
    }
  };
  tryAttach();
  // На случай, если скрипт загрузился до DOM — привяжем повторно после DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', tryAttach);
  }
}

async function signInWithDiscord() {
  if (!sb) return alert('Авторизация недоступна (ошибка конфигурации).');
  try {
    await sb.auth.signInWithOAuth({
      provider: 'discord',
      options: { scopes: 'identify email' }
    });
    // редирект произойдёт автоматически
  } catch (err) {
    console.error('Ошибка при попытке входа через Discord:', err);
    alert(err?.message || 'Не удалось начать вход через Discord.');
  }
}

async function signOutSupabase() {
  if (!sb) return;
  try {
    await sb.auth.signOut();
    updateUserSectionFromSession(null);
  } catch (err) {
    console.error('Ошибка выхода:', err);
    alert('Не удалось выйти.');
  }
}

function signInWithNick(nick, pwd) {
  return Promise.reject(new Error('Вход по нику/паролю отключён. Используйте Discord.'));
}
function signUpWithNick(nick, pwd) {
  return Promise.reject(new Error('Регистрация по нику/паролю отключена. Используйте Discord.'));
}

function updateUserSectionFromSession(session) {
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
}

async function checkAuthAndShowIp() {
  if (!sb) { showAuthModalSafe(); return; }
  try {
    const { data } = await sb.auth.getSession();
    if (data && data.session && data.session.user) {
      showIpModalSafe();
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
