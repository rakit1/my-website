document.addEventListener('DOMContentLoaded', () => {
    const body = document.body;
    body.classList.add('fade-in');

    const handleLinkClick = (event) => {
        const link = event.target.closest('a');
        
        // Проверяем, что ссылка внутренняя и не является якорем
        if (link && link.href && link.hostname === window.location.hostname && !link.href.includes('#')) {
            event.preventDefault();
            const destination = link.href;

            body.classList.add('fade-out');

            setTimeout(() => {
                window.location.href = destination;
            }, 500); // Задержка соответствует времени анимации
        }
    };

    document.body.addEventListener('click', handleLinkClick);
});
