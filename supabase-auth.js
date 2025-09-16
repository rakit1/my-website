// === Настройка Supabase ===
const SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === Вход через Discord ===
async function signInWithDiscord() {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "discord",
      options: {
        redirectTo: window.location.href, // после входа вернёт на текущую страницу
      },
    });
    if (error) throw error;
  } catch (err) {
    console.error("Ошибка входа через Discord:", err);
    alert("Не удалось войти через Discord. Проверьте консоль.");
  }
}

// === Выход ===
async function signOutSupabase() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("Ошибка выхода:", error.message);
    alert("Не удалось выйти из аккаунта.");
  }
}

// === Обновление UI пользователя ===
async function updateUserUI() {
  const userSection = document.getElementById("userSection");
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Имя и аватар
    const name = user.user_metadata?.full_name || user.user_metadata?.global_name || "User";
    const avatarUrl = user.user_metadata?.avatar_url || null;

    userSection.innerHTML = `
      <div class="user-info">
        <div class="user-avatar" title="${name}">
          ${avatarUrl ? `<img src="${avatarUrl}" style="width:100%;height:100%;border-radius:50%;">` : name[0]}
        </div>
        <span>${name}</span>
      </div>
    `;
  } else {
    // Если гость
    userSection.innerHTML = `<button class="login-btn">Войти</button>`;
  }
}

// === Проверка сессии после редиректа ===
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    updateUserUI();
  }
}

// === Модальное окно и кнопки ===
document.addEventListener("DOMContentLoaded", () => {
  checkSession();

  // Открыть модалку авторизации
  document.getElementById('userSection')?.addEventListener('click', (e) => {
    if (e.target.closest('.login-btn')) {
      document.getElementById('authPage').style.display = 'flex';
    }
    if (e.target.closest('.user-avatar')) {
      if (confirm('Выйти из аккаунта?')) signOutSupabase().then(updateUserUI);
    }
  });

  // Закрытие модалки
  document.querySelector('.close-auth')?.addEventListener('click', () => {
    document.getElementById('authPage').style.display = 'none';
  });
  document.getElementById('authPage')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });

  // Кнопка Discord в модалке
  document.getElementById('discordSignIn')?.addEventListener('click', (e) => {
    e.preventDefault();
    signInWithDiscord();
  });
});

// === Следим за изменением статуса авторизации ===
supabase.auth.onAuthStateChange(() => {
  updateUserUI();
});
