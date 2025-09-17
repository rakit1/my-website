// script.js
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация мобильного меню
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            const nav = document.querySelector('nav');
            if (nav) {
                nav.classList.toggle('active');
            }
        });
    }
    
    // Закрытие мобильного меню при клике на ссылку
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            const nav = document.querySelector('nav');
            if (nav && nav.classList.contains('active')) {
                nav.classList.remove('active');
            }
        });
    });

    // Функция прокрутки к разделу серверов
    window.scrollToServers = function() {
        const el = document.getElementById('servers-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
});
