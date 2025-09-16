// supabase-auth.js
// Подключение к Supabase (вы прислали эти данные)
const SUPABASE_URL = 'https://egskxyxgzdidfbxhjaud.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw';

if (!window.supabase) {
  console.error('Supabase client not found. Убедитесь, что CDN supabase-js загружен.');
}
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Вспомогательная: преобразуем ник в "фиктивный" email для Supabase
function nickToEmail(nick) {
  // минимальная фильтрация: убрать пробелы, привести к нижнему регистру
  const s = (nick || '').trim().toLowerCase().replace(/\s+/g, '');
  // домен можно изменить; важно, чтобы он был уникален для вашего проекта
  return `${s}@local.project`;
}

// Обновление UI при сессии
function updateUserSectionFromSession(session) {
  const user = session?.user ?? null;
  if (user) {
    // username хранится в user.user_metadata.username (если мы сохранили при регистрации)
    const username = (user.user_metadata && user.user_metadata.username) ? user.user_metadata.username : (user.email || 'User');
    // вызываем функцию из index.html
    if (typeof updateUserSection === 'function') updateUserSection(username);
  } else {
    if (typeof updateUserSection === 'function') updateUserSection(null);
  }
}

// Инициализация: проверить текущую сессию и подписаться на изменения
(async function initSupabaseAuth() {
  try {
    const { data } = await sb.auth.getSession();
    updateUserSectionFromSession(data.session);
  } catch (err) {
    console.warn('Ошибка при получении сессии:', err);
  }

  sb.auth.onAuthStateChange((event, session) => {
    // event: SIGNED_IN, SIGNED_OUT, USER_UPDATED и т.д.
    updateUserSectionFromSession(session);
  });

  // Подключаем обработчики кнопок модала (они находятся в index.html)
  document.addEventListener('DOMContentLoaded', () => {
    const signupBtn = document.getElementById('signupBtn');
    const loginBtn = document.getElementById('loginBtn');

    if (signupBtn) {
      signupBtn.addEventListener('click', async () => {
        const nick = document.getElementById('nicknameInput').value.trim();
        const password = document.getElementById('passwordInput').value;
        if (!nick || !password) return alert('Заполните ник и пароль');
        try {
          await signUpWithNick(nick, password);
          // При успешной регистрации Supabase может потребовать подтверждения почты,
          // но т.к. мы используем фиктивный email, подтверждение будет неактивно.
          alert('Регистрация завершена (тестовый режим). Теперь можно войти.');
          hideAuthModal();
        } catch (err) {
          // сообщение уже выводится в функции
        }
      });
    }

    if (loginBtn) {
      loginBtn.addEventListener('click', async () => {
        const nick = document.getElementById('nicknameInput').value.trim();
        const password = document.getElementById('passwordInput').value;
        if (!nick || !password) return alert('Введите ник и пароль');
        try {
          await signInWithNick(nick, password);
          hideAuthModal();
        } catch (err) {
          // сообщение уже выводится в функции
        }
      });
    }
  });

  // Переопределим поведение "Присоединиться": если не залогинен — откроем модал, иначе ip
  window.checkAuthAndShowIp = async function() {
    try {
      const { data } = await sb.auth.getSession();
      if (data?.session) {
        // открыт доступ — показываем IP-модал (функция из index.html)
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

// Регистрация (ник -> фиктивный email)
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
    // UI обновит onAuthStateChange
  } catch (err) {
    console.error('signOut error', err);
    alert('Ошибка выхода');
  }
}

// Экспортим signOutSupabase в глобальную область, чтобы index.html мог вызвать при клике на аватар
window.signOutSupabase = signOutSupabase;
