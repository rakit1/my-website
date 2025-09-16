// supabase-auth.js
// Подключение к Supabase — ваш проект (вы дали URL и ANON KEY)
const SUPABASE_URL = 'https://egskxyxgzdidfbxhjaud.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw';

// создаём клиента
if (!window.supabase) {
  console.error('Supabase CDN не найден. Убедитесь, что `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js"></script>` подключён перед этим файлом.');
}
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// экспортируем ссылку для отладки (не обязательно)
window.sb = sb;

// Утилита: превращаем ник в фиктивный email для Supabase (nick@local.project)
function nickToEmail(nick) {
  const s = (nick || '').trim().toLowerCase().replace(/\s+/g, '');
  return `${s}@local.project`;
}

// Обновление UI: вызывает функцию из index.html
function updateUserSectionFromSession(session) {
  const user = session?.user ?? null;
  if (user) {
    const username = (user.user_metadata && user.user_metadata.username) ? user.user_metadata.username : (user.email || 'User');
    if (typeof updateUserSection === 'function') updateUserSection(username);
  } else {
    if (typeof updateUserSection === 'function') updateUserSection(null);
  }
}

// Инициализация: проверяем сессию и подписываемся на изменения
(async function init() {
  try {
    const { data } = await sb.auth.getSession();
    updateUserSectionFromSession(data.session);
  } catch (err) {
    console.warn('Ошибка получения сессии:', err);
  }

  sb.auth.onAuthStateChange((event, session) => {
    // on signin / signout обновляет UI
    updateUserSectionFromSession(session);
  });

  // Проверка-утилита для кнопки "Присоединиться"
  window.checkAuthAndShowIp = async function() {
    try {
      const { data } = await sb.auth.getSession();
      if (data?.session) {
        if (typeof showIpModal === 'function') showIpModal();
      } else {
        if (typeof showAuthModal === 'function') showAuthModal();
      }
    } catch (err) {
      console.error(err);
      if (typeof showAuthModal === 'function') showAuthModal();
    }
  };
})();

// Регистрация: сохраняем ник в user_metadata
async function signUpWithNick(nick, password) {
  const email = nickToEmail(nick);
  try {
    const { data, error } = await sb.auth.signUp({
      email,
      password
    }, {
      data: { username: nick }
    });
    if (error) {
      throw error;
    }
    return data;
  } catch (err) {
    console.error('signUp error', err);
    alert(err.message || 'Ошибка регистрации');
    throw err;
  }
}

// Вход
async function signInWithNick(nick, password) {
  const email = nickToEmail(nick);
  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email,
      password
    });
    if (error) {
      throw error;
    }
    return data;
  } catch (err) {
    console.error('signIn error', err);
    alert(err.message || 'Ошибка входа');
    throw err;
  }
}

// Выход
async function signOutSupabase() {
  try {
    await sb.auth.signOut();
  } catch (err) {
    console.error('signOut error', err);
    alert('Ошибка выхода');
  }
}

// Экспорт функции в глобальную область, чтобы index.html мог вызвать её
window.signUpWithNick = signUpWithNick;
window.signInWithNick = signInWithNick;
window.signOutSupabase = signOutSupabase;
