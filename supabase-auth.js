// === Настройка Supabase ===
// Замени на свои реальные данные из https://supabase.com/dashboard -> Project settings -> API
const SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// === Авторизация через Discord ===
async function signInWithDiscord() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "discord",
    options: {
      redirectTo: window.location.origin, // после входа вернёт обратно на сайт
    },
  });

  if (error) {
    console.error("Ошибка входа:", error.message);
    alert("Не удалось войти через Discord.");
  }
}

// === Выход ===
async function signOutSupabase() {
  const { error } = await supabase.auth.signOut();
  if (error) console.error("Ошибка выхода:", error.message);
}

// === Проверка авторизации и показ IP ===
async function checkAuthAndShowIp() {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Показываем IP-модал
    document.getElementById("ipModal").style.display = "flex";
  } else {
    // Если не залогинен — открываем авторизацию
    document.getElementById("authPage").style.display = "flex";
  }
}

// === Следим за статусом ===
async function updateUserUI() {
  const userSection = document.getElementById("userSection");
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Аватар или ник
    const name = user.user_metadata?.custom_claims?.global_name || user.user_metadata?.full_name || "User";
    const avatarUrl = user.user_metadata?.avatar_url;

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

// Слушаем изменения статуса
supabase.auth.onAuthStateChange(() => {
  updateUserUI();
});

// При загрузке страницы — сразу обновляем UI
document.addEventListener("DOMContentLoaded", () => {
  updateUserUI();
});
