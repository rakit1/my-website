// script.js — небольшие улучшения: делегирование клика на nav toggle и аккуратное закрытие dropdown

function scrollToServers() {
  const el = document.getElementById('servers-section');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Мобильное меню: делегирование нажатия
document.addEventListener('click', (e) => {
  const mobileBtn = e.target.closest('.mobile-menu-btn');
  if (mobileBtn) {
    document.querySelector('nav')?.classList.toggle('active');
  }
});

// Закрытие выпадающего меню при клике вне него
document.addEventListener('click', (e) => {
  const userDropdown = document.querySelector('.user-dropdown');
  if (!userDropdown) return;
  // Если клик вне dropdown и вне user-info — скрываем меню (стили CSS управляют показом при hover, но это для безопасности)
  if (!userDropdown.contains(e.target)) {
    const dropdownMenu = userDropdown.querySelector('.dropdown-menu');
    if (dropdownMenu) {
      dropdownMenu.style.opacity = '0';
      dropdownMenu.style.visibility = 'hidden';
      dropdownMenu.style.transform = 'translateY(-10px)';
    }
  } else {
    // При клике внутри user-dropdown — показываем меню явно (для keyboard accessibility)
    const dropdownMenu = userDropdown.querySelector('.dropdown-menu');
    if (dropdownMenu) {
      dropdownMenu.style.opacity = '1';
      dropdownMenu.style.visibility = 'visible';
      dropdownMenu.style.transform = 'translateY(5px)';
    }
  }
});
