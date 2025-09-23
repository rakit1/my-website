document.addEventListener('DOMContentLoaded', () => {
    // Анимация появления страницы
    document.body.classList.add('fade-in');

    // --- ЛОГИКА МОБИЛЬНОГО МЕНЮ (теперь работает на всех страницах) ---
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    const nav = document.querySelector('nav');

    if (mobileMenuBtn && nav) {
        mobileMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Предотвращаем закрытие по клику на саму кнопку
            nav.classList.toggle('active');
            toggleOverlay(nav.classList.contains('active'));
        });
    }

    const toggleOverlay = (show) => {
        let overlay = document.querySelector('.nav-overlay');
        if (show && !overlay) {
            overlay = document.createElement('div');
            overlay.className = 'nav-overlay';
            overlay.style.cssText = `position: fixed; top: 70px; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 98;`;
            document.body.appendChild(overlay);
            overlay.addEventListener('click', () => {
                nav.classList.remove('active');
                toggleOverlay(false);
            });
        } else if (!show && overlay) {
            overlay.remove();
        }
    };
    // --- КОНЕЦ ЛОГИКИ МОБИЛЬНОГО МЕНЮ ---


    // --- ЛОГИКА ПЕРЕХОДА ПО ССЫЛКАМ ---
    const handleLinkClick = (event) => {
        const link = event.target.closest('a');
        
        if (link && link.href && link.hostname === window.location.hostname && !link.href.includes('#') && link.target !== '_blank') {
            event.preventDefault();
            const destination = link.href;

            document.body.classList.add('fade-out');

            setTimeout(() => {
                window.location.href = destination;
            }, 250);
        }
    };

    document.body.addEventListener('click', handleLinkClick);
});
