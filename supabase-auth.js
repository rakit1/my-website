// supabase-auth.js
(function() {
  // === Настройка Supabase ===
  const SUPABASE_URL = "https://egskxyxgzdidfbxhjaud.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw";
  let supabase;

  // === Основная инициализация ===
  function initAuth() {
    // Проверка, что Supabase загружен (новый способ)
    if (typeof supabase === "undefined") {
      console.error("Supabase не загружен. Проверьте подключение скриптов!");
      return;
    }

    // Инициализация обработчиков событий
    initEventHandlers();
    
    // Проверка сессии при загрузке страницы
    checkSession();
    
    // Следим за изменением статуса авторизации в реальном времени
    supabase.auth.onAuthStateChange(() => {
      updateUserUI();
    });
  }

  // === Инициализация обработчиков событий ===
  function initEventHandlers() {
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

    // Обработчики для кнопок "Присоединиться к серверу"
    document.querySelectorAll('.server-join-btn').forEach(btn => {
      btn.addEventListener('click', handleServerJoin);
    });

    // IP-копирование
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
  }

  // === Вход через Discord ===
  async function signInWithDiscord() {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "discord",
        options: { 
          redirectTo: window.location.origin,
          scopes: 'identify email' // Добавляем необходимые scope
        }
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
    if (!userSection) return;
    
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error) {
      console.error("Ошибка получения пользователя:", error);
      return;
    }

    if (user) {
      const name = user.user_metadata?.full_name || user.user_metadata?.global_name || user.email || "User";
      const avatarUrl = user.user_metadata?.avatar_url || null;
      
      // Формируем URL аватара правильно
      const finalAvatarUrl = avatarUrl ? 
        (avatarUrl.startsWith('http') ? avatarUrl : `https://cdn.discordapp.com/avatars/${user.id}/${avatarUrl}.png`) 
        : null;

      userSection.innerHTML = `
        <div class="user-info">
          <div class="user-avatar" title="${name}">
            ${finalAvatarUrl ? `<img src="${finalAvatarUrl}" alt="${name}" style="width:100%;height:100%;border-radius:50%;">` : name[0]}
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
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (session?.user) updateUserUI();
    } catch (err) {
      console.error("Ошибка проверки сессии:", err);
    }
  }

  // === Обработка кнопок присоединения к серверу ===
  async function handleServerJoin() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      document.getElementById("ipModal").style.display = "flex";
    } else {
      document.getElementById("authPage").style.display = "flex";
    }
  }

  // Инициализация Supabase и запуск когда все готово
  function initializeApp() {
    // Создаем клиент Supabase
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    
    // Запускаем инициализацию когда DOM готов
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initAuth);
    } else {
      initAuth();
    }
  }

  // Запускаем инициализацию когда Supabase загружен
  if (window.supabase) {
    initializeApp();
  } else {
    window.addEventListener('supabase-loaded', initializeApp);
  }
})();
