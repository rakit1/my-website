// script.js
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация мобильного меню
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            const nav = document.querySelector('nav');
            if (nav) {
                nav.classList.toggle('active');
                
                // Затемнение фона при открытом меню
                if (nav.classList.contains('active')) {
                    const overlay = document.createElement('div');
                    overlay.className = 'nav-overlay';
                    overlay.style.cssText = `
                        position: fixed;
                        top: 70px;
                        left: 0;
                        width: 100%;
                        height: calc(100% - 70px);
                        background: rgba(0, 0, 0, 0.5);
                        z-index: 98;
                        backdrop-filter: blur(2px);
                    `;
                    overlay.addEventListener('click', function() {
                        nav.classList.remove('active');
                        document.body.removeChild(overlay);
                    });
                    document.body.appendChild(overlay);
                } else {
                    const overlay = document.querySelector('.nav-overlay');
                    if (overlay) {
                        document.body.removeChild(overlay);
                    }
                }
            }
        });
    }
    
    // Закрытие мобильного меню при клике на ссылку
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            const nav = document.querySelector('nav');
            const overlay = document.querySelector('.nav-overlay');
            
            if (nav && nav.classList.contains('active')) {
                nav.classList.remove('active');
            }
            
            if (overlay) {
                document.body.removeChild(overlay);
            }
        });
    });

    // Закрытие мобильного меню при ресайзе окна
    window.addEventListener('resize', function() {
        const nav = document.querySelector('nav');
        const overlay = document.querySelector('.nav-overlay');
        
        if (window.innerWidth > 520 && nav && nav.classList.contains('active')) {
            nav.classList.remove('active');
        }
        
        if (overlay) {
            document.body.removeChild(overlay);
        }
    });
});

// Глобальная функция для прокрутки к серверам
window.scrollToServers = function() {
    const el = document.getElementById('servers-section');
    if (el) {
        el.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
};
