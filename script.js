// script.js
document.addEventListener('DOMContentLoaded', function() {
    // Initialize mobile menu
    const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            const nav = document.querySelector('nav');
            if (nav) {
                nav.classList.toggle('active');
            }
        });
    }
    
    // Close mobile menu when clicking a link
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            const nav = document.querySelector('nav');
            if (nav && nav.classList.contains('active')) {
                nav.classList.remove('active');
            }
        });
    });

    // Make scroll functions globally available
    window.scrollToServers = function() {
        const el = document.getElementById('servers-section');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
});
