function scrollToServers() {
  const el = document.getElementById('servers-section');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Мобильное меню
document.querySelector('.mobile-menu-btn')?.addEventListener('click', () => {
  document.querySelector('nav').classList.toggle('active');
});
