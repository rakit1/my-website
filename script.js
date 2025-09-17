// script.js
function scrollToServers() {
  const el = document.getElementById('servers-section');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Мобильное меню
document.querySelector('.mobile-menu-btn')?.addEventListener('click', () => {
  document.querySelector('nav').classList.toggle('active');
});

// Закрытие выпадающего меню при клике вне его
document.addEventListener('click', (e) => {
  const userDropdown = document.querySelector('.user-dropdown');
  if (userDropdown && !userDropdown.contains(e.target)) {
    const dropdownMenu = userDropdown.querySelector('.dropdown-menu');
    if (dropdownMenu) {
      dropdownMenu.style.opacity = '0';
      dropdownMenu.style.visibility = 'hidden';
      dropdownMenu.style.transform = 'translateY(-10px)';
    }
  }
});
