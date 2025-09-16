document.addEventListener("DOMContentLoaded", () => {
  // Проверка, что Supabase загружен
  if (typeof Supabase === "undefined") {
    alert("Supabase не загружен. Проверьте подключение скриптов!");
    return;
  }

  // === Настройка Supabase ===
  const SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
  const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // === Вход через Discord ===
  async function signInWithDiscord() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: { redirectTo: window.location.href },
      });
      if (error) throw error;
    } catch (err) {
      console.error("Ошибка входа через Discord:", err);
      alert("Не удалось войти через Discord. Проверьте консоль.");
    }
  }

  // === Выход ===
  async function signOutSupabase() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      updateUserUI();
    } catch (err) {
      console.error("Ошибка выхода:", err);
      alert("Не удалось выйти из аккаунта.");
    }
  }

  // === Обновление UI пользователя ===
  async function updateUserUI() {
    const userSection = document.getElementById("userSection");
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
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
      userSection.innerHTML = `<button class="login-btn">Войти</button>`;
    }
  }

  // === Проверка сессии при загрузке страницы ===
  async function checkSession() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) updateUserUI();
  }

  checkSession();

  // === Обработчики кнопок ===

  // Кнопка Discord в модалке
  document.getElementById('discordSignIn')?.addEventListener('click', (e) => {
    e.preventDefault();
    signInWithDiscord();
  });

  // Кнопка входа/аватар в хедере
  document.getElementById('userSection')?.addEventListener('click', (e) => {
    if (e.target.closest('.login-btn')) {
      document.getElementById('authPage').style.display = 'flex';
    }
    if (e.target.closest('.user-avatar')) {
      if (confirm('Выйти из аккаунта?')) signOutSupabase();
    }
  });

  // Закрытие модалки авторизации
  document.querySelector('.close-auth')?.addEventListener('click', () => {
    document.getElementById('authPage').style.display = 'none';
  });
  document.getElementById('authPage')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.style.display = 'none';
  });

  // Следим за изменением статуса авторизации в реальном времени
  supabase.auth.onAuthStateChange(() => {
    updateUserUI();
  });

  // === Функция для кнопок "Присоединиться к серверу" ===
  document.querySelectorAll('.server-join-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        document.getElementById("ipModal").style.display = "flex";
      } else {
        document.getElementById("authPage").style.display = "flex";
      }
    });
  });

  // === IP-копирование ===
  document.querySelectorAll('.ip-btn').forEach(button => {
    button.addEventListener('click', function() {
      const ip = this.getAttribute('data-ip');
      navigator.clipboard?.writeText(ip).then(() => {
        this.classList.add('copied');
        setTimeout(() => this.classList.remove('copied'), 1200);
      }).catch(() => alert('Не удалось скопировать IP'));
    });
  });

  // Закрытие IP-модалки
  document.querySelector('.close-ip-modal')?.addEventListener('click', () => {
    document.getElementById("ipModal").style.display = "none";
  });
});
