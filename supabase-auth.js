// supabase-auth.js — исправленная версия
(function () {
  'use strict';

  // Конфигурация
  const SUPABASE_URL = 'https://egskxyxgzdidfbxhjaud.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVnc2t4eXhnemRpZGZieGhqYXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwNTA2MDcsImV4cCI6MjA3MzYyNjYwN30.X60gkf8hj0YEKzLdCFOOXRAlfDJ2AoINoJHY8qPeDFw';

  let sb = null;

  // Инициализация Supabase
  function initSupabase() {
    console.log('🔄 Инициализация Supabase...');
    
    // Проверяем доступность SDK
    if (!window.supabase) {
      console.error('❌ Supabase SDK не найден! Проверьте загрузку скрипта.');
      return false;
    }

    if (!window.supabase.createClient) {
      console.error('❌ createClient недоступен в Supabase SDK!');
      return false;
    }

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('❌ Не заданы SUPABASE_URL или SUPABASE_ANON_KEY!');
      return false;
    }

    try {
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ Supabase client успешно создан!');
      console.log('🔗 URL:', SUPABASE_URL);
      return true;
    } catch (err) {
      console.error('❌ Ошибка создания Supabase client:', err);
      return false;
    }
  }

  // Настройка авторизации
  function setupAuth() {
    if (!sb) return;

    console.log('🔧 Настройка авторизации...');
    
    try {
      // Подписка на изменения состояния авторизации
      sb.auth.onAuthStateChange((event, session) => {
        console.log('🔄 Auth state changed:', event);
        if (session) {
          console.log('👤 Пользователь:', session.user.email || 'неизвестен');
        }
        updateUserSection(session);
      });

      // Получаем текущую сессию
      sb.auth.getSession().then(({ data, error }) => {
        if (error) {
          console.error('❌ Ошибка получения сессии:', error);
          return;
        }
        
        if (data.session) {
          console.log('✅ Найдена активная сессия');
          updateUserSection(data.session);
        } else {
          console.log('ℹ️ Активной сессии нет');
          updateUserSection(null);
        }
      });

    } catch (err) {
      console.error('❌ Ошибка настройки auth:', err);
    }
  }

  // Экспорт функций в глобальную область
  window.signInWithDiscord = signInWithDiscord;
  window.signOutSupabase = signOutSupabase;
  window.checkAuthAndShowIp = checkAuthAndShowIp;
  window.updateUserSectionFromSession = updateUserSection;

  // Авторизация через Discord
  async function signInWithDiscord() {
    console.log('🎮 Попытка входа через Discord...');
    
    if (!sb) {
      console.error('❌ Supabase client недоступен!');
      alert('Ошибка: авторизация не настроена. Перезагрузите страницу и попробуйте снова.');
      return;
    }

    try {
      console.log('🔄 Отправляем OAuth запрос...');
      
      const { data, error } = await sb.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          scopes: 'identify email',
          redirectTo: `${window.location.origin}${window.location.pathname}`
        }
      });

      if (error) {
        console.error('❌ Ошибка OAuth:', error);
        if (error.message.includes('Invalid login credentials')) {
          alert('Discord OAuth не настроен. Проверьте конфигурацию в панели Supabase.');
        } else {
          alert(`Ошибка входа: ${error.message}`);
        }
        return;
      }

      console.log('✅ OAuth запрос отправлен, ожидаем редирект...');

    } catch (err) {
      console.error('❌ Исключение при входе:', err);
      alert(`Не удалось войти через Discord: ${err.message}`);
    }
  }

  // Выход из системы
  async function signOutSupabase() {
    if (!sb) {
      console.log('ℹ️ Supabase недоступен для выхода');
      return;
    }
    
    try {
      console.log('🔄 Выполняем выход...');
      const { error } = await sb.auth.signOut();
      
      if (error) {
        console.error('❌ Ошибка выхода:', error);
        alert('Не удалось выйти из системы');
        return;
      }
      
      console.log('✅ Выход выполнен успешно');
      updateUserSection(null);
      
    } catch (err) {
      console.error('❌ Исключение при выходе:', err);
      alert('Ошибка при выходе из системы');
    }
  }

  // Проверка авторизации и показ модала IP
  async function checkAuthAndShowIp() {
    console.log('🔍 Проверяем авторизацию...');
    
    if (!sb) {
      console.log('❌ Supabase недоступен, показываем форму входа');
      showAuthModal();
      return;
    }

    try {
      const { data, error } = await sb.auth.getSession();
      
      if (error) {
        console.error('❌ Ошибка проверки сессии:', error);
        showAuthModal();
        return;
      }

      if (data.session && data.session.user) {
        console.log('✅ Пользователь авторизован, показываем IP');
        showIpModal();
      } else {
        console.log('❌ Пользователь не авторизован');
        showAuthModal();
      }
      
    } catch (err) {
      console.error('❌ Исключение при проверке авторизации:', err);
      showAuthModal();
    }
  }

  // Обновление секции пользователя
  function updateUserSection(session) {
    const userSection = document.getElementById('userSection');
    if (!userSection) {
      console.warn('⚠️ Элемент userSection не найден');
      return;
    }

    if (session && session.user) {
      // Пользователь авторизован
      const user = session.user;
      const meta = user.user_metadata || {};
      const name = meta.username || meta.user_name || meta.full_name || user.email || 'Игрок';
      const initials = name.charAt(0).toUpperCase();

      console.log('👤 Обновляем UI для пользователя:', name);

      userSection.innerHTML = `
        <div class="user-info" title="${escapeHtml(name)}">
          <div class="user-avatar" id="userAvatar">${escapeHtml(initials)}</div>
          <div style="margin-left:8px; font-weight:700; color:var(--text)">${escapeHtml(truncate(name, 18))}</div>
        </div>
      `;

      // Добавляем обработчик клика на аватар
      const avatar = document.getElementById('userAvatar');
      if (avatar) {
        avatar.addEventListener('click', () => {
          if (confirm('Выйти из аккаунта?')) {
            signOutSupabase();
          }
        });
      }

      // Скрываем модал авторизации
      hideAuthModal();
      
    } else {
      // Пользователь не авторизован
      console.log('👤 Показываем кнопку входа');
      userSection.innerHTML = '<button class="login-btn">Войти</button>';
    }
  }

  // Показать модал авторизации
  function showAuthModal() {
    const modal = document.getElementById('authPage');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  // Скрыть модал авторизации
  function hideAuthModal() {
    const modal = document.getElementById('authPage');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  // Показать модал с IP
  function showIpModal() {
    const modal = document.getElementById('ipModal');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  // Утилиты
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text || '';
    return div.innerHTML;
  }

  function truncate(str, length) {
    str = String(str || '');
    return str.length > length ? str.slice(0, length - 1) + '…' : str;
  }

  // Инициализация с повторными попытками
  function tryInit(attempts = 0) {
    const maxAttempts = 3;
    
    if (attempts >= maxAttempts) {
      console.error('❌ Не удалось инициализировать Supabase после всех попыток');
      return;
    }

    if (initSupabase()) {
      setupAuth();
      return;
    }

    // Повторная попытка через небольшую задержку
    setTimeout(() => {
      console.log(`🔄 Повторная попытка инициализации (${attempts + 1}/${maxAttempts})...`);
      tryInit(attempts + 1);
    }, 100 * (attempts + 1));
  }

  // Запуск инициализации
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      console.log('📄 DOM загружен, запускаем инициализацию Supabase');
      tryInit();
    });
  } else {
    console.log('📄 DOM уже готов, запускаем инициализацию Supabase');
    tryInit();
  }

})();
